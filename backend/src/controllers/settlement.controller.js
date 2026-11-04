import axios from 'axios';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';
import { generatePaySprintToken } from '../utils/paysprint.util.js';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import { checkWalletPin } from '../utils/walletPin.js';
import {
  icchhamatiPost,
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
  fetchProviderBeneficiaries,
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

const getPaySprintHeaders = () => {
  return {
    Token: generatePaySprintToken(),
    Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
    'Content-Type': 'application/json',
  };
};

const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

const getUser = async (req) => {
  if (req.user.role === 'distributor') {
    return Distributor.findById(req.user.id);
  }
  return Retailer.findById(req.user.id);
};

/**
 * AEPS settlement pays out on Icchhamati, to the beneficiaries saved under the
 * retailer's registered mobile number — the same list DMT shows for that
 * number. Nothing else can be picked: the beneficiary is looked up again from
 * the provider at payout time, so an id from the browser is never trusted.
 * Accounts are added, verified (OTP + penny drop) and removed in DMT; the old
 * PaySprint add / document / delete steps have nothing to do here.
 */
const registeredMobile = async (req) => requireMobile((await getUser(req))?.contactNumber);

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

/** { mobile, banks } for this user, or { error: { status, message } }. */
const settlementBanks = async (req) => {
  const mobile = await registeredMobile(req);
  if (!mobile) {
    return { error: { status: 400, message: 'Your registered mobile number is missing or invalid. Contact support.' } };
  }
  const { rows, error } = await fetchProviderBeneficiaries();
  if (error) {
    return { error: { status: 502, message: providerMessage(error, 'Could not load your bank accounts right now.') } };
  }
  const banks = rows.filter((row) => beneficiaryMobile(row) === mobile).map(toSettlementBank);
  return { mobile, banks };
};

const DMT_ONLY = (mobile) =>
  `Settlement accounts are the verified DMT beneficiaries of your registered mobile${
    mobile ? ` (******${mobile.slice(-4)})` : ''
  }. Add or remove the account in DMT and it shows here.`;

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

export const addSettlementBank = async (req, res) =>
  res.status(400).json({ success: false, message: DMT_ONLY(await registeredMobile(req).catch(() => null)) });

export const deleteSettlementBank = addSettlementBank;

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

// AEPS Settlement flat fee: ₹5 base charge + 18% GST on that charge (₹0.90).
// All values configurable via env.
const getSettlementFee = () => {
  const baseCharge = Number(process.env.AEPS_SETTLEMENT_BASE_CHARGE || 5);
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
  min: Number(process.env.AEPS_SETTLEMENT_MIN_AMOUNT || 100),
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

    // Flat fee: ₹5 base charge + 18% GST on that charge (e.g. ₹5 + ₹0.90 = ₹5.90)
    const { baseCharge, gstAmount, total: fee } = getSettlementFee();
    const totalDeduction = Number(amount) + fee;

    if (aepsWallet.balance < totalDeduction) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Trade Wallet balance. (Amount: ₹${amount} + Charge: ₹${fee})`,
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
        details: `Trade wallet settlement ${transactionId}`,
      });
    } catch (providerError) {
      // Timeout / network: the provider may have accepted it, so hold the funds.
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

// STATUS ENQUIRY — Icchhamati settlements read the payout listing; older
// PaySprint ones (pre-Icchhamati, still pending) ask PaySprint.
// txn_status: 0 = Failed & Refunded, 1 = Success, 2 = Pending, 3 = In Process, 4 = On Hold
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

    const refid = txn.metadata?.refid || txn.transactionId;
    const ackno = txn.metadata?.ackno || null;

    const payload = { refid };
    if (ackno) payload.ackno = ackno;

    let apiResponse;
    try {
      apiResponse = await axios.post(`${baseUrl}/service/payout/payout/status`, payload, {
        headers: getPaySprintHeaders(),
        validateStatus: () => true,
      });
    } catch (err) {
      console.error('Payout Status API Error:', err?.response?.data || err.message);
      return res
        .status(502)
        .json({ success: false, message: 'Failed to fetch status from PaySprint' });
    }

    const resData = apiResponse.data;
    if (resData?.status === false) {
      return res.status(400).json({
        success: false,
        message: resData?.message || 'Status enquiry failed',
        data: resData,
      });
    }

    const statusData = resData?.data || {};
    const txnStatus = statusData.txn_status;

    let finalStatus = txn.status;
    if (txnStatus === 1) finalStatus = 'SUCCESS';
    else if (txnStatus === 0) finalStatus = 'FAILED';
    else if (txnStatus === 2 || txnStatus === 3 || txnStatus === 4) finalStatus = 'PROCESSING';

    if (finalStatus === 'FAILED' && (txn.status === 'PROCESSING' || txn.status === 'PENDING')) {
      const { resolveTransaction } = await import('../utils/wallet.util.js');
      await resolveTransaction(
        txn.transactionId,
        'FAILED',
        statusData.status || 'Transaction failed & refunded',
        // Older direct payouts carry metadata.walletType = MAIN, which wins.
        'AEPS'
      );
    } else if (finalStatus === 'SUCCESS') {
      await Transaction.updateOne(
        { _id: txn._id },
        {
          $set: {
            status: 'SUCCESS',
            transactionId: statusData.ackno || ackno || txn.transactionId,
            'metadata.ackno': statusData.ackno || ackno,
            'metadata.utr': statusData.utr || txn.metadata?.utr,
            'metadata.charges': statusData.charges,
            'metadata.apiMessage': statusData.status || 'Settlement successful',
          },
        }
      );
    } else if (finalStatus === 'PROCESSING') {
      await Transaction.updateOne(
        { _id: txn._id },
        {
          $set: {
            status: 'PROCESSING',
            'metadata.apiMessage': statusData.status || 'Transaction is in process',
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      txnStatus,
      message:
        txnStatus === 1
          ? 'Transaction Successful'
          : txnStatus === 0
            ? 'Transaction Failed and Refunded'
            : txnStatus === 2
              ? 'Transaction Pending'
              : txnStatus === 3
                ? 'Transaction In Process'
                : 'Transaction On Hold',
      data: {
        ...statusData,
        transactionId: txn.transactionId,
      },
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
