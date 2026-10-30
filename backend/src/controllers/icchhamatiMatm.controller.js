import mongoose from 'mongoose';
import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import {
  getApiCommission,
  getDistributorCommission,
  getMatmCommission,
  setCommissions,
  settleCommissions,
} from '../utils/wallet.util.js';
import { icchhamatiPost, isOk, providerMessage } from '../utils/icchhamati.util.js';

/**
 * Icchhamati (Fingpay) Micro ATM.
 *
 * The card is read by the provider's MATM driver on the retailer's machine
 * (localhost:8680/matmweb on the web portal). Our part is the two server calls
 * around it: /matm-config hands the driver an encrypted login or transaction
 * request for the retailer's outlet, and /matm-request reports the driver's
 * result back to Icchhamati, which settles it on their side.
 *
 * txnType in the transaction request: 2 cash withdrawal, 1 balance enquiry.
 */

export const MATM_TXN_TYPES = { CW: 2, BE: 1 };
const MAX_AMOUNT = 10000;

const outletOf = (retailer) => retailer.matmOutletId || retailer.icchhamatiAeps?.outletId || null;

const loadOutlet = async (req, res) => {
  const retailer = await Retailer.findById(req.user.id).select('matmOutletId icchhamatiAeps contactNumber');
  if (!retailer) {
    res.status(404).json({ success: false, message: 'Retailer not found' });
    return null;
  }
  if (!outletOf(retailer)) {
    res.status(409).json({ success: false, message: 'Complete AEPS registration first. Micro ATM uses the same outlet.' });
    return null;
  }
  return retailer;
};

/**
 * POST /config { type: 'login' } or { type: 'doTransaction', txnType, mobile, amount?, remarks?, latitude, longitude }
 * Returns the encrypted string the MATM driver takes as its request body.
 */
export const getMatmConfig = async (req, res) => {
  try {
    const retailer = await loadOutlet(req, res);
    if (!retailer) return;
    const { type } = req.body || {};
    const body = { outletId: outletOf(retailer), type };

    if (type === 'doTransaction') {
      const txnType = Number(req.body.txnType);
      const mobile = String(req.body.mobile ?? '').replace(/\D/g, '');
      const amount = Number(req.body.amount);
      if (!Object.values(MATM_TXN_TYPES).includes(txnType)) {
        return res.status(400).json({ success: false, message: 'Choose cash withdrawal or balance enquiry.' });
      }
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Enter the customer’s 10-digit mobile number.' });
      }
      if (txnType === MATM_TXN_TYPES.CW && !(amount >= 1 && amount <= MAX_AMOUNT)) {
        return res.status(400).json({ success: false, message: `Amount must be between ₹1 and ₹${MAX_AMOUNT}.` });
      }
      body.data = {
        mobileNumber: mobile,
        remarks: String(req.body.remarks ?? '').slice(0, 100),
        txnType,
        amount: txnType === MATM_TXN_TYPES.CW ? amount : '',
        latitude: String(req.body.latitude ?? '0.0'),
        longitude: String(req.body.longitude ?? '0.0'),
      };
    } else if (type !== 'login') {
      return res.status(400).json({ success: false, message: "type must be 'login' or 'doTransaction'." });
    }

    const data = await icchhamatiPost('/api/v2/matm-config', body);
    if (!isOk(data) || typeof data.data !== 'string') {
      return res.status(400).json({ success: false, message: providerMessage(data, 'Could not start Micro ATM.') });
    }
    return res.status(200).json({ success: true, data: data.data });
  } catch (error) {
    console.error('Icchhamati MATM config error:', error.message);
    return res.status(502).json({ success: false, message: 'Could not reach the Micro ATM provider. Please try again.' });
  }
};

/**
 * The draft's Fingpay merchant login, as Icchhamati registered it, for the
 * Android Micro ATM SDK. Only the merchant's own login leaves the server: the
 * draft's request_data also carries Icchhamati's super-merchant username and
 * password, which must not. Returns null when the outlet is not on Fingpay yet.
 */
export const sdkCredentials = (draft = {}) => {
  const parse = (v) => {
    if (typeof v !== 'string') return v || {};
    try { return JSON.parse(v); } catch { return {}; }
  };
  const merchant = parse(draft.request_data).merchant || {};
  const created = parse(draft.response_data).data || {};
  const merchantUserId = created.merchantLoginId || merchant.merchantLoginId;
  const superMerchantId = created.superMerchantId ?? parse(draft.request_data).supermerchantId;
  if (!merchantUserId || !merchant.merchantLoginPin || !superMerchantId) return null;
  return { merchantUserId: String(merchantUserId), merchantPassword: String(merchant.merchantLoginPin), superMerchantId: String(superMerchantId) };
};

/**
 * GET /sdk — what the app's Fingpay Micro ATM SDK needs to start: the
 * merchant login and a fresh transaction id. The card result comes back
 * through POST /request like the web driver's.
 */
export const getMatmSdkConfig = async (req, res) => {
  try {
    const retailer = await loadOutlet(req, res);
    if (!retailer) return;
    const data = await icchhamatiPost('/api/v2/aeps/draft-data', { outletId: outletOf(retailer) });
    const credentials = isOk(data) ? sdkCredentials(data.data) : null;
    if (!credentials) {
      return res.status(409).json({ success: false, message: providerMessage(data, 'Your Micro ATM merchant is not active yet. Complete AEPS activation first.') });
    }
    return res.status(200).json({
      success: true,
      data: { ...credentials, txnId: `MATM${Date.now()}${Math.floor(Math.random() * 1000)}` },
    });
  } catch (error) {
    console.error('Icchhamati MATM SDK config error:', error.message);
    return res.status(502).json({ success: false, message: 'Could not reach the Micro ATM provider. Please try again.' });
  }
};

/** What the driver's result says happened. Withdrawals are the only money movement. */
export const readMatmResult = (data = {}) => {
  const amount = Number(data.transactionAmount) || 0;
  const type = String(data.transactionType || '').toUpperCase();
  const withdrawal = amount > 0 && !/BAL|BE|ENQ/.test(type);
  const succeeded =
    String(data.errorCode) === '00' && /^success/i.test(String(data.transactionStatus || data.errorMessage || ''));
  return { amount, type, withdrawal, succeeded, reference: String(data.fpTransactionId || '').trim() };
};

/** Credits a confirmed withdrawal once: principal to the AEPS wallet, commissions per rate card. */
const creditWithdrawal = async (transactionId) => {
  const session = await mongoose.startSession();
  try {
    let claimed = null;
    await session.withTransaction(async () => {
      claimed = await Transaction.findOneAndUpdate(
        { _id: transactionId, status: { $in: ['PENDING', 'PROCESSING'] } },
        { $set: { status: 'SUCCESS' } },
        { session, new: true }
      );
      if (!claimed) return;
      await AepsWallet.findOneAndUpdate(
        { userId: claimed.userId, userModel: 'Retailer' },
        { $inc: { balance: claimed.amount } },
        { upsert: true, session }
      );
      const split = await settleCommissions({
        session,
        retailerId: claimed.userId,
        retailerGross: getMatmCommission(claimed.amount),
        distributorGross: getDistributorCommission('MATM', claimed.amount),
        pool: getApiCommission('MATM', claimed.amount),
        retailerWallet: AepsWallet,
        distributorWallet: AepsWallet,
      });
      setCommissions(claimed, split);
      await claimed.save({ session });
    });
    return claimed;
  } finally {
    session.endSession();
  }
};

/**
 * POST /request { mobile, data } — the driver's result for one transaction.
 *
 * The result comes from the retailer's machine, so on its own it proves
 * nothing. It is reported to Icchhamati, and a withdrawal is credited only
 * when the driver says it succeeded AND Icchhamati accepts the report.
 * ponytail: Icchhamati publishes no MATM status query, so their acceptance is
 * the only check; a successful withdrawal they refuse waits as PROCESSING for
 * an admin. Wire a status query in here if they add one.
 */
export const submitMatmResult = async (req, res) => {
  try {
    const retailer = await loadOutlet(req, res);
    if (!retailer) return;
    const data = req.body?.data;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Micro ATM result is required.' });
    }
    const result = readMatmResult(data);
    if (!result.reference) {
      return res.status(400).json({ success: false, message: 'The Micro ATM result has no transaction id.' });
    }
    const mobile = String(req.body?.mobile ?? '').replace(/\D/g, '');

    // The provider's transaction id is unique, so a resubmitted result is a no-op.
    const existing = await Transaction.findOne({ transactionId: result.reference, type: 'MATM' });
    if (existing) {
      if (String(existing.userId) !== String(req.user.id)) {
        return res.status(409).json({ success: false, message: 'This transaction id is already recorded.' });
      }
      return res.status(200).json({ success: existing.status === 'SUCCESS', status: existing.status, data: existing });
    }

    const record = await Transaction.create({
      transactionId: result.reference,
      userId: req.user.id,
      type: 'MATM',
      amount: result.withdrawal ? result.amount : 0,
      status: 'PENDING',
      metadata: {
        provider: 'icchhamati',
        outletId: outletOf(retailer),
        mobile,
        transactionType: result.type,
        bankRRN: data.bankRRN || null,
        cardNumber: data.cardNumber || null,
        cardType: data.cardType || null,
        bankName: data.bankName || null,
        terminalId: data.terminalId || null,
        bankBalance: Number.isFinite(Number(data.balanceAmount)) ? Number(data.balanceAmount) : null,
        sdkMessage: data.errorMessage || null,
      },
    });

    let reported;
    try {
      reported = await icchhamatiPost('/api/v2/matm-request', {
        outletId: outletOf(retailer),
        mobile,
        data,
        platform: req.get('X-Client') === 'APP' ? 'App' : 'Web',
      });
    } catch (error) {
      console.error('Icchhamati MATM report error:', error.message);
      reported = null;
    }
    const accepted = isOk(reported);

    if (!result.succeeded) {
      record.status = 'FAILED';
      await record.save();
      return res.status(400).json({ success: false, status: 'FAILED', message: data.errorMessage || 'Micro ATM transaction failed.', data: record });
    }
    if (!result.withdrawal) {
      record.status = 'SUCCESS';
      await record.save();
      return res.status(200).json({ success: true, status: 'SUCCESS', message: 'Balance enquiry successful.', data: record });
    }
    if (!accepted) {
      record.status = 'PROCESSING';
      record.metadata = { ...record.metadata, needsReconciliation: true, providerMessage: providerMessage(reported, 'Not confirmed by provider') };
      await record.save();
      return res.status(202).json({
        success: false,
        status: 'PROCESSING',
        message: 'The withdrawal is being verified. The wallet will be credited once it is confirmed.',
        data: record,
      });
    }

    const credited = await creditWithdrawal(record._id);
    return res.status(200).json({
      success: true,
      status: 'SUCCESS',
      message: 'Cash withdrawal successful. Wallet credited.',
      data: credited || record,
    });
  } catch (error) {
    console.error('Icchhamati MATM result error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not record the Micro ATM transaction. Check the report before retrying.' });
  }
};
