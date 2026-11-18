import mongoose from 'mongoose';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import { icchhamatiPost } from './icchhamati.util.js';
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

/** check-status data.txnStatus, as our ledger reads it. Anything unclear stays PENDING. */
export const upiCwOutcome = (data) => {
  const status = String(data?.data?.txnStatus || '').toUpperCase();
  if (status === 'SUCCESS') return 'SUCCESS';
  if (['FAILED', 'FAILURE', 'DECLINED', 'EXPIRED', 'REJECTED'].includes(status)) return 'FAILED';
  return 'PENDING';
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
  const outcome = upiCwOutcome(data);
  const result = data?.data || {};

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
      { $set: { 'metadata.bankRRN': result.bankRrn, 'metadata.payerName': result.payerName, 'metadata.paymentDate': result.paymentDate } }
    );
    await creditTradeInflow({
      transactionId: txn._id,
      userId: txn.userId,
      amount: txn.amount,
      providerRef: result.bankRrn || fingpayTxnId,
      message: data?.message,
      retailerGross: getUpiCashWithdrawalCommission(txn.amount),
    });
  } else if (outcome === 'FAILED') {
    await Transaction.updateOne(
      { _id: txn._id, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'FAILED', 'metadata.gatewayMessage': data?.message || result.txnStatus } }
    );
  }
  return Transaction.findById(txn._id);
};
