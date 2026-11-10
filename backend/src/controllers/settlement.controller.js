import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import { checkWalletPin } from '../utils/walletPin.js';
import {
  icchhamatiPost,
  icchhamatiGet,
  isOk,
  payoutOutcome,
  providerMessage,
  makeReferenceId,
} from '../utils/icchhamati.util.js';
import { lockFundsForTransaction, resolveTransaction } from '../utils/wallet.util.js';
import { reconcileIcchhamatiPayout } from '../utils/icchhamatiPayout.js';
import {
  requireMobile,
  beneficiaryMobile,
  getBeneficiaryId,
  addBeneficiary,
  sendBeneficiaryOtp,
  sendBeneficiaryDeleteOtp,
  verifyBeneficiary,
  deleteBeneficiary,
} from './dmt.controller.js';

// Accepted and held: shown as submitted, and as Pending in history until the
// payout listing reports SUCCESS (or FAILED, which refunds).
const pendingPayoutResponse = (res, transactionId, apiMessage) =>
  res.status(202).json({
    success: true,
    pending: true,
    transactionId,
    message: 'Settlement submitted. It shows Pending until the bank confirms it.',
    detail: typeof apiMessage === 'string' ? apiMessage : undefined,
  });

const getUser = async (req) => {
  if (req.user.role === 'distributor') {
    return Distributor.findById(req.user.id);
  }
  return Retailer.findById(req.user.id);
};

/**
 * AEPS settlement pays out on Icchhamati, to the payout (type 3) beneficiaries
 * saved under the retailer's registered mobile number. Nothing else can be
 * picked: the beneficiary is looked up again from the provider at payout time,
 * so an id from the browser is never trusted. Accounts are added here with
 * type 3 (penny drop, then active at once); the provider decides payout vs DMT
 * by the beneficiary's type, not by anything sent with the payout.
 */
/** A provider beneficiary in the shape the settlement screens already read. */
export const toSettlementBank = (row) => {
  const id = String(getBeneficiaryId(row) ?? '');
  return {
    _id: id,
    beneId: id,
    accountHolderName: row.name ?? null,
    accountNumber: String(row.account ?? row.account_number ?? ''),
    ifscCode: row.ifsc ?? row.account_ifsc ?? null,
    bankName: row.bank || row.bank_name || 'Bank account',
    // The provider list is fetched with verified=true: only OTP-verified rows.
    status: 'VERIFIED',
    accountType: 'PRIMARY',
    documentRequired: false,
    provider: 'ICCHHAMATI',
  };
};

/**
 * { mobile, banks } for this user, or { error: { status, message } }.
 * Settlements go out as payouts only, to type 3 beneficiaries. The provider's list
 * endpoint never returns those, so each id saved on the user is fetched on its own;
 * ids the provider no longer knows (deleted) are dropped from the user.
 */
const settlementBanks = async (req) => {
  const user = await getUser(req);
  const mobile = requireMobile(user?.contactNumber);
  if (!mobile) {
    return { error: { status: 400, message: 'Your registered mobile number is missing or invalid. Contact support.' } };
  }
  const ids = user.payoutBeneficiaryIds || [];
  const results = await Promise.all(
    ids.map((id) => icchhamatiGet(`/api/v2/beneficiaries/${encodeURIComponent(id)}`).catch(() => null))
  );
  if (results.some((d) => d === null)) {
    return { error: { status: 502, message: 'Could not load your bank accounts right now.' } };
  }
  const gone = ids.filter((id, i) => !isOk(results[i]) && /not found/i.test(String(results[i]?.message || '')));
  if (gone.length) await user.updateOne({ $pull: { payoutBeneficiaryIds: { $in: gone } } });
  const banks = results
    .map((d) => (isOk(d) ? d.data : null))
    .filter((row) => row && String(row.type) === '3' && beneficiaryMobile(row) === mobile && String(row.status) === '1')
    .map(toSettlementBank);
  return { mobile, banks };
};

export const getSavedBanks = async (req, res) => {
  try {
    const { banks, error } = await settlementBanks(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(200).json({ success: true, data: banks });
  } catch (error) {
    console.error('Error fetching saved banks:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const syncSavedBanks = async (req, res) => {
  try {
    const { banks, error } = await settlementBanks(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(200).json({ success: true, synced: banks.length, data: banks });
  } catch (error) {
    console.error('Error syncing settlement banks:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** Adds a payout (type 3) beneficiary on the retailer's registered mobile and keeps its id. */
export const addSettlementBank = async (req, res) => {
  const user = await getUser(req).catch(() => null);
  const mobile = requireMobile(user?.contactNumber);
  if (!mobile) {
    return res.status(400).json({ success: false, message: 'Your registered mobile number is missing or invalid. Contact support.' });
  }
  res.locals.onBeneficiaryCreated = async (row) => {
    const id = row && getBeneficiaryId(row);
    if (id != null) await user.updateOne({ $addToSet: { payoutBeneficiaryIds: String(id) } });
  };
  req.body = { ...req.body, mobile, type: 3 };
  return addBeneficiary(req, res);
};

export const sendSettlementBankOtp = sendBeneficiaryOtp;
export const sendSettlementBankDeleteOtp = sendBeneficiaryDeleteOtp;
export const verifySettlementBank = verifyBeneficiary;

/** Deletes one of this retailer's own payout beneficiaries; the provider wants the OTP from /bank-otp. */
export const deleteSettlementBank = async (req, res) => {
  try {
    const { banks, error } = await settlementBanks(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    if (!banks.some((b) => b._id === String(req.params.id))) {
      return res.status(404).json({ success: false, message: 'This account is not one of your settlement banks.' });
    }
    if (!req.body?.otp) return res.status(400).json({ success: false, message: 'OTP is required' });
    req.body = { beneficiary_id: req.params.id, otp: req.body.otp };
    return deleteBeneficiary(req, res);
  } catch (error) {
    console.error('Delete settlement bank error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const uploadSettlementDocument = async (req, res) =>
  res.status(400).json({ success: false, message: 'No document is needed: DMT beneficiaries are verified by OTP.' });

export const getSettlementAccountStatus = async (req, res) => {
  try {
    const { banks, error } = await settlementBanks(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    if (!banks.some((b) => b._id === String(req.params.id))) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
    return res.status(200).json({ success: true, accountStatus: 1, message: 'Account is activated' });
  } catch (error) {
    console.error('Error checking account status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Payout (move to bank) charge from the retailer rate card: ₹5 + 18% GST = ₹5.90.
// Configurable with AEPS_SETTLEMENT_BASE_CHARGE and AEPS_SETTLEMENT_GST_RATE.
export const getSettlementFee = () => {
  const baseCharge = Number(process.env.AEPS_SETTLEMENT_BASE_CHARGE ?? 5);
  const gstRate = Number(process.env.AEPS_SETTLEMENT_GST_RATE || 18) / 100;
  const gstAmount = Math.round(baseCharge * gstRate * 100) / 100;
  return {
    baseCharge,
    gstRate,
    gstAmount,
    total: Math.round((baseCharge + gstAmount) * 100) / 100,
  };
};

const getSettlementAmountLimits = () => ({
  // Icchhamati refuses payouts of ₹500 or less ("Amount must be greater than 500").
  min: Number(process.env.AEPS_SETTLEMENT_MIN_AMOUNT || 501),
  max: Number(process.env.AEPS_SETTLEMENT_MAX_AMOUNT || 25000),
});

export const initiateSettlement = async (req, res) => {
  try {
    const { bankId, amount, pin } = req.body;
    const mode = String(req.body.mode || 'IMPS').toUpperCase();
    if (!['IMPS', 'NEFT'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Transfer mode must be IMPS or NEFT.' });
    }

    if (!bankId || !amount || amount <= 0 || !pin) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const { min, max } = getSettlementAmountLimits();
    if (amount < min || amount > max) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount must be between ₹${min} and ₹${max}`,
      });
    }

    // Whole rupees only: the provider is sent an integer amount.
    if (!Number.isInteger(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Amount must be in whole rupees.' });
    }

    const { banks, error: banksError } = await settlementBanks(req);
    if (banksError) return res.status(banksError.status).json({ success: false, message: banksError.message });
    const bank = banks.find((b) => b._id === String(bankId));
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'This account is not a verified beneficiary of your registered mobile number.',
      });
    }

    const aepsWallet = await AepsWallet.findOne({ userId: req.user.id });
    const pinError = await checkWalletPin(aepsWallet, pin);
    if (pinError) return res.status(pinError.status).json({ success: false, message: pinError.message });

    // ₹5 + 18% GST by default (see getSettlementFee).
    const { baseCharge, gstAmount, total: fee } = getSettlementFee();
    const totalDeduction = Number(amount) + fee;

    if (aepsWallet.balance < totalDeduction) {
      return res.status(400).json({
        success: false,
        message: fee ? `Insufficient Trade Wallet balance. (Amount: ₹${amount} + Charge: ₹${fee})` : 'Insufficient Trade Wallet balance.',
      });
    }

    const transactionId = makeReferenceId('SETTLE');

    // Held as PROCESSING from the Trade (AEPS) wallet — the Icchhamati wallet
    // /beneficiary-payout pays from — until the provider gives a final answer.
    try {
      await lockFundsForTransaction(req.user.id, 'AEPS', -totalDeduction, {
        transactionId,
        userId: req.user.id,
        type: 'AEPS_SETTLEMENT',
        amount: totalDeduction,
        metadata: {
          provider: 'ICCHHAMATI',
          refid: transactionId,
          beneficiaryId: bank.beneId,
          bankAccount: bank.accountNumber,
          bankName: bank.bankName,
          beneficiaryName: bank.accountHolderName,
          mode,
          fee,
          baseCharge,
          gstAmount,
          gstRate: Number(process.env.AEPS_SETTLEMENT_GST_RATE || 18),
        },
      });
    } catch (walletError) {
      return res.status(400).json({
        success: false,
        message: walletError.message || 'Insufficient Trade Wallet balance',
      });
    }

    let data;
    try {
      data = await icchhamatiPost('/api/v2/beneficiaries/beneficiary-payout', {
        beneficiary_id: Number(bank.beneId),
        amount: Number(amount),
        transfer_mode: mode,
        transaction_id: transactionId,
        type: '3',
        details: `Trade wallet settlement ${transactionId}`,
      });
    } catch (providerError) {
      await Transaction.updateOne(
        { transactionId },
        { $set: { 'metadata.apiMessage': providerError.message, 'metadata.transportError': true } }
      );
      return pendingPayoutResponse(res, transactionId, providerError.message);
    }

    const status = payoutOutcome(data);
    const apiMessage = providerMessage(
      data,
      status === 'SUCCESS' ? 'Settlement successful' : status === 'FAILED' ? 'Settlement failed' : ''
    );

    await Transaction.updateOne(
      { transactionId },
      {
        $set: {
          'metadata.providerTxnId': data?.data?.txnid || null,
          'metadata.utr': data?.data?.rrn || data?.data?.utr || null,
          'metadata.apiMessage': apiMessage,
          'metadata.apiResponse': data,
        },
      }
    );

    if (status === 'PENDING') return pendingPayoutResponse(res, transactionId, apiMessage);

    // Refunds the held amount + fee when FAILED.
    await resolveTransaction(transactionId, status, apiMessage, 'AEPS');

    return res.status(status === 'SUCCESS' ? 200 : 400).json({
      success: status === 'SUCCESS',
      message: apiMessage,
      data: { ackno: data?.data?.txnid || null, transactionId, response: data?.data ?? null },
    });
  } catch (error) {
    console.error('Settlement Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// STATUS ENQUIRY — Icchhamati settlements read the payout listing. Older ones
// from the previous provider have no status service any more: they are only
// reported as stored, and a held one waits for an admin.
// txnStatus: 0 = Failed & Refunded, 1 = Success, 3 = In Process
export const checkSettlementStatus = async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'transactionId is required' });
    }

    const txn = await Transaction.findOne({
      transactionId: String(transactionId),
      userId: req.user.id,
      type: { $in: ['AEPS_SETTLEMENT', 'DIRECT_PAYOUT'] },
    });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (txn.metadata?.provider === 'ICCHHAMATI') {
      // A settled txn is only re-read; a held one is asked about.
      const { finalStatus, row } =
        txn.status === 'PENDING' || txn.status === 'PROCESSING'
          ? await reconcileIcchhamatiPayout(txn)
          : { finalStatus: txn.status, row: null };
      const txnStatus = finalStatus === 'SUCCESS' ? 1 : finalStatus === 'FAILED' ? 0 : 3;
      return res.status(200).json({
        success: true,
        txnStatus,
        message:
          txnStatus === 1 ? 'Transaction Successful' : txnStatus === 0 ? 'Transaction Failed and Refunded' : 'Transaction In Process',
        data: { transactionId: txn.transactionId, utr: row?.utr ?? txn.metadata?.utr ?? null },
      });
    }

    const txnStatus = txn.status === 'SUCCESS' ? 1 : txn.status === 'FAILED' ? 0 : 3;
    return res.status(200).json({
      success: true,
      txnStatus,
      message:
        txnStatus === 1
          ? 'Transaction Successful'
          : txnStatus === 0
            ? 'Transaction Failed and Refunded'
            : 'This settlement went through our previous provider, which can no longer be asked for its status. It stays Pending; please contact support to have it resolved.',
      data: { transactionId: txn.transactionId, utr: txn.metadata?.utr ?? null },
    });
  } catch (error) {
    console.error('Settlement status enquiry error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getSettlementHistory = async (req, res) => {
  try {
    const { type } = req.query;
    const allowedTypes = ['AEPS_SETTLEMENT', 'DIRECT_PAYOUT', 'AEPSTOMAIN'];
    const selectedType = allowedTypes.includes(type) ? type : 'AEPS_SETTLEMENT';

    const history = await Transaction.find({
      userId: req.user.id,
      type: selectedType,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
