import mongoose from 'mongoose';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import { icchhamatiGet, icchhamatiPost } from './icchhamati.util.js';
import { getUpiCashWithdrawalCommission, settleCommissions, setCommissions } from './wallet.util.js';

/**
 * Credits an inflow once: the full amount to the retailer's Trade (AEPS) wallet,
 * plus `retailerGross` commission (net of TDS) when the rate card pays one.
 * Aadhaar Pay (no commission) and UPI cash withdrawal both land here. Idempotent: only a PENDING
 * or PROCESSING row moves to SUCCESS, so a poll and the worker cannot both credit.
 */
export const creditTradeInflow = async ({ transactionId, userId, amount, providerRef, message, retailerGross = 0 }) => {
  const session = await mongoose.startSession();
  try {
    let claimed = null;
    await session.withTransaction(async () => {
      claimed = await Transaction.findOneAndUpdate(
        { _id: transactionId, status: { $in: ['PENDING', 'PROCESSING'] } },
        {
          $set: {
            status: 'SUCCESS',
            'metadata.providerRef': providerRef,
            'metadata.gatewayMessage': message,
          },
        },
        { session, new: true }
      );
      if (!claimed) return;
      await AepsWallet.findOneAndUpdate(
        { userId, userModel: 'Retailer' },
        { $inc: { balance: Number(amount) } },
        { upsert: true, session }
      );
      if (retailerGross > 0) {
        // ponytail: retailer slab only; the card gives no distributor or platform share for UPI CW.
        const split = await settleCommissions({
          session,
          retailerId: userId,
          retailerGross,
          retailerWallet: AepsWallet,
          distributorWallet: AepsWallet,
        });
        setCommissions(claimed, split);
        await claimed.save({ session });
      }
    });
    return claimed;
  } finally {
    session.endSession();
  }
};

/** A QR lives 3 minutes; past this, "no transaction found" means it was never paid. */
const UNPAID_QR_AFTER_MS = 30 * 60 * 1000;

/** check-status data.txnStatus, as our ledger reads it. Anything unclear stays PENDING. */
export const upiCwOutcome = (data, createdAt) => {
  const status = String(data?.data?.txnStatus || '').toUpperCase();
  if (status === 'SUCCESS') return 'SUCCESS';
  if (['FAILED', 'FAILURE', 'DECLINED', 'EXPIRED', 'REJECTED'].includes(status)) return 'FAILED';
  // MER_4118: the bank has no payment against this QR. Still PENDING inside the
  // QR's life, an expired unpaid QR once it is long gone — nothing was debited.
  if (data?.data?.responseCode === 'MER_4118' && createdAt && Date.now() - new Date(createdAt) > UNPAID_QR_AFTER_MS) {
    return 'FAILED';
  }
  return 'PENDING';
};

/**
 * True when a check-status answer is about this withdrawal. Ids the provider
 * echoes back must be ours: an answer for another retailer's QR never credits.
 */
export const answerIsFor = (txn, data) => {
  const result = data?.data || {};
  const { partnerRequestId, fingpayTxnId } = txn.metadata || {};
  if (!partnerRequestId || !fingpayTxnId) return false;
  if (result.partnerRequestId !== undefined && String(result.partnerRequestId) !== String(partnerRequestId)) return false;
  if (result.fingpayTxnId !== undefined && String(result.fingpayTxnId) !== String(fingpayTxnId)) return false;
  return true;
};

/**
 * Asks Icchhamati about one UPI cash withdrawal and settles it: SUCCESS credits
 * the Trade wallet, FAILED closes it, anything else leaves it PENDING. Used by
 * the retailer's poll and by the reconciliation worker.
 */
export const syncUpiCashWithdrawal = async (txn) => {
  if (txn.status !== 'PENDING' && txn.status !== 'PROCESSING') return txn;
  const { partnerRequestId, fingpayTxnId } = txn.metadata || {};
  const data = await icchhamatiPost('/api/v2/upicw/check-status', { partnerRequestId, fingpayTxnId });
  const result = data?.data || {};
  if (!answerIsFor(txn, data)) {
    await Transaction.updateOne(
      { _id: txn._id },
      { $set: { 'metadata.needsReconciliation': true, 'metadata.gatewayMessage': 'Status answer was for another transaction' } }
    );
    return Transaction.findById(txn._id);
  }
  const outcome = upiCwOutcome(data, txn.createdAt);

  if (outcome === 'SUCCESS') {
    // The QR fixed the amount; a different paid amount is not credited blind.
    if (result.amount !== undefined && Number(result.amount) !== Number(txn.amount)) {
      await Transaction.updateOne(
        { _id: txn._id },
        { $set: { status: 'PROCESSING', 'metadata.needsReconciliation': true, 'metadata.paidAmount': Number(result.amount) } }
      );
      return Transaction.findById(txn._id);
    }
    await Transaction.updateOne(
      { _id: txn._id },
      {
        $set: {
          'metadata.bankRRN': result.bankRrn || result.bankRRN,
          'metadata.accountNumber': result.accountNumber,
          'metadata.payerName': result.payerName,
          'metadata.paymentDate': result.paymentDate,
        },
      }
    );
    await creditTradeInflow({
      transactionId: txn._id,
      userId: txn.userId,
      amount: txn.amount,
      providerRef: result.bankRrn || result.bankRRN || fingpayTxnId,
      message: data?.message,
      retailerGross: getUpiCashWithdrawalCommission(txn.amount),
    });
  } else if (outcome === 'FAILED') {
    await Transaction.updateOne(
      { _id: txn._id, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'FAILED', 'metadata.gatewayMessage': result.responseCode === 'MER_4118' ? 'QR expired unpaid' : data?.message || result.txnStatus } }
    );
  }
  return Transaction.findById(txn._id);
};

/**
 * Asks Icchhamati for its account-level UPI cash withdrawal history.
 * GET /api/v2/upicw/history
 */
export const fetchProviderUpiCwHistory = async (params = {}) => {
  return icchhamatiGet('/api/v2/upicw/history', params);
};

