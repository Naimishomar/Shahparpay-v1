import bcrypt from 'bcrypt';
import {
  icchhamatiGet,
  icchhamatiPost,
  icchhamatiDelete,
  isOk,
  normaliseStatus,
  providerMessage,
  makeReferenceId,
} from '../utils/icchhamati.util.js';
import { lockFundsForTransaction, resolveTransaction } from '../utils/wallet.util.js';
import DmtTransaction from '../models/dmtTransaction.model.js';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';

/**
 * Money transfer and beneficiaries, on Icchhamati.
 *
 * There is no remitter to register here: a beneficiary carries the sender's
 * mobile number itself, is created straight away, and is activated by an OTP
 * sent to that number. Only a verified beneficiary can be paid.
 *
 * The provider's beneficiary list is shared by the whole merchant account, so
 * every read is filtered to the sender mobile the retailer is working with —
 * one retailer must not be able to page through another's beneficiaries.
 */

/** The sender's mobile is the only thing tying a beneficiary to a customer. */
const requireMobile = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

const beneficiaryMobile = (row) =>
  String(row.mobile ?? row.mobile_number ?? row.remitter_mobile ?? row.user?.mobile ?? '')
    .replace(/\D/g, '');

// Icchhamati currently returns `id`; retain the aliases used by older account
// responses so OTP, delete, and payout always use the provider's real ID.
const getBeneficiaryId = (row) =>
  row.id ?? row.beneficiary_id ?? row.bene_id ?? row.beneficiaryId ?? row.beneId;

const fetchProviderBeneficiaries = async () => {
  const rows = [];
  let page = 1;
  let lastPage = 1;

  do {
    const data = await icchhamatiGet('/api/v2/beneficiaries', {
      page,
      per_page: 100,
      verified: true,
    });
    if (!isOk(data)) return { rows: [], error: data };

    const pageRows = data.data?.data || data.data || [];
    if (Array.isArray(pageRows)) rows.push(...pageRows);
    lastPage = Math.max(1, Number(data.data?.last_page || 1));
    page += 1;
  } while (page <= lastPage && page <= 100);

  return { rows, error: null };
};

const toBeneficiary = (row) => ({
  id: String(getBeneficiaryId(row) ?? ''),
  beneid: String(getBeneficiaryId(row) ?? ''), // the name the existing screens read
  name: row.name,
  benename: row.name,
  mobile: row.mobile ?? row.mobile_number ?? row.remitter_mobile ?? row.user?.mobile,
  account: row.account ?? row.account_number,
  accno: row.account ?? row.account_number,
  ifsc: row.ifsc ?? row.account_ifsc,
  bank: row.bank || null,
  bankname: row.bank || null,
  branch: row.branch || null,
  status: row.status || null,
  verified:
    row.verified === true || row.account_verified === true || row.ifsc_verified === true ||
    ['verified', 'active', 'approved', '1', 'success'].includes(String(row.status || '').toLowerCase()),
});

export const fetchBeneficiaries = async (req, res) => {
  try {
    const mobile = requireMobile(req.body?.mobile);
    if (!mobile) {
      return res
        .status(400)
        .json({ success: false, message: 'A valid 10-digit sender mobile number is required' });
    }

    // Icchhamati's `search` parameter is unreliable for this endpoint: it can
    // return an empty page even when the beneficiary exists. Fetch the
    // paginated verified list and apply the exact mobile filter ourselves.
    const { rows, error: providerError } = await fetchProviderBeneficiaries();
    if (providerError) {
      return res.status(502).json({
        success: false,
        message: providerMessage(providerError, 'Could not load beneficiaries right now.'),
      });
    }

    const mine = rows.filter((row) => beneficiaryMobile(row) === mobile);

    return res.status(200).json({ success: true, data: mine.map(toBeneficiary) });
  } catch (error) {
    console.error('Fetch Beneficiaries Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch beneficiaries' });
  }
};

export const addBeneficiary = async (req, res) => {
  try {
    const { benename, name, beneaccount, accno, account, ifsc } = req.body;
    const mobile = requireMobile(req.body?.mobile);
    const beneName = benename || name;
    const beneAccount = String(beneaccount || accno || account || '').trim();

    const normalizedIfsc = String(ifsc || '').trim().toUpperCase();
    if (!mobile || !beneName || !beneAccount || !normalizedIfsc) {
      return res.status(400).json({
        success: false,
        message: 'Sender mobile, beneficiary name, account number and IFSC are required',
      });
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
      return res.status(400).json({ success: false, message: 'Enter a valid IFSC code' });
    }

    // Verify the destination account before creating the beneficiary. This is
    // the provider's penny-drop check and prevents an account typo from
    // entering the OTP/payout flow. Credentials are supplied by the existing
    // server-side ICCHHAMATI_MID / ICCHHAMATI_MKEY environment variables.
    const pennyDrop = await icchhamatiPost('/api/v2/verify/bank-account', {
      accountno: beneAccount,
      ifsccode: normalizedIfsc,
    });

    if (!isOk(pennyDrop)) {
      return res.status(400).json({
        success: false,
        message: providerMessage(
          pennyDrop,
          'Bank account verification failed. Check the account number and IFSC code.'
        ),
        data: { pennyDropVerified: false },
      });
    }

    const data = await icchhamatiPost('/api/v2/beneficiaries/create', {
      name: beneName,
      mobile,
      account: beneAccount,
      confirmAccount: beneAccount,
      ifsc: normalizedIfsc,
    });

    if (!isOk(data)) {
      return res.status(400).json({
        success: false,
        message: providerMessage(data, 'Could not add this beneficiary.'),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bank account verified successfully. Beneficiary added; verify it with OTP to pay it.',
      data: {
        ...(data.data ? toBeneficiary(data.data) : {}),
        pennyDropVerified: true,
      },
    });
  } catch (error) {
    console.error('Add Beneficiary Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to add beneficiary' });
  }
};

/** Sends the activation OTP to the sender's registered mobile. */
export const sendBeneficiaryOtp = async (req, res) => {
  try {
    const { beneficiary_id, beneid } = req.body;
    const id = beneficiary_id || beneid;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Beneficiary id is required' });
    }

    const data = await icchhamatiPost('/api/v2/beneficiaries/get-beneficiary-otp', {
      beneficiary_id: String(id),
    });

    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'Could not send the OTP.') });
    }

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'OTP sent to the registered sender mobile.'),
      expiresIn: data?.data?.expires_in ?? data?.expires_in ?? null,
    });
  } catch (error) {
    console.error('Beneficiary OTP Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

/** Icchhamati uses a separate OTP request for beneficiary deletion. */
export const sendBeneficiaryDeleteOtp = async (req, res) => {
  try {
    const data = await icchhamatiPost('/api/v2/beneficiaries/send-otp', {});
    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'Could not send the deletion OTP.') });
    }

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'OTP sent to the registered sender mobile.'),
      expiresIn: data?.data?.expires_in ?? data?.expires_in ?? null,
    });
  } catch (error) {
    console.error('Beneficiary Delete OTP Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to send deletion OTP' });
  }
};

export const verifyBeneficiary = async (req, res) => {
  try {
    const { beneficiary_id, beneid, otp } = req.body;
    const id = beneficiary_id || beneid;
    if (!id || !otp) {
      return res
        .status(400)
        .json({ success: false, message: 'Beneficiary id and OTP are required' });
    }

    const data = await icchhamatiPost('/api/v2/beneficiaries/otp-verify-beneficiary', {
      beneficiary_id: String(id),
      otp: String(otp),
    });

    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'Could not verify that OTP.') });
    }

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'Beneficiary verified and activated.'),
    });
  } catch (error) {
    console.error('Verify Beneficiary Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to verify beneficiary' });
  }
};

/** Deleting a beneficiary is OTP-protected at the provider, same as adding one. */
export const deleteBeneficiary = async (req, res) => {
  try {
    const { beneficiary_id, beneid, otp } = req.body;
    const id = beneficiary_id || beneid;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Beneficiary id is required' });
    }

    const data = await icchhamatiDelete(`/api/v2/beneficiaries/${encodeURIComponent(id)}`, {
      otp: otp ? String(otp) : undefined,
    });

    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'Could not delete beneficiary.') });
    }

    return res
      .status(200)
      .json({ success: true, message: providerMessage(data, 'Beneficiary deleted.') });
  } catch (error) {
    console.error('Delete Beneficiary Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to delete beneficiary' });
  }
};

export const initiateTransfer = async (req, res) => {
  try {
    const retailerId = req.user.id;
    const { beneficiary_id, beneid, amount, pin, transfer_mode, beneaccount, ifsc } = req.body;
    const beneficiaryId = beneficiary_id || beneid;
    const totalAmount = Number(amount);
    const senderMobile = requireMobile(req.body?.mobile);

    if (!beneficiaryId || !senderMobile || !totalAmount || totalAmount <= 0 || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Sender mobile, beneficiary, a valid amount and the transaction PIN are required',
      });
    }

    // The provider beneficiary registry is shared by the merchant account. Do
    // not trust an ID/account supplied by the browser: verify that this exact
    // beneficiary belongs to the sender mobile currently being transferred.
    const { rows: beneficiaryRows, error: beneficiaryError } = await fetchProviderBeneficiaries();
    if (beneficiaryError) {
      return res.status(502).json({
        success: false,
        message: providerMessage(beneficiaryError, 'Could not verify the beneficiary right now.'),
      });
    }
    const providerBeneficiary = beneficiaryRows.find((row) => {
      const rowId = getBeneficiaryId(row);
      const rowMobile = beneficiaryMobile(row);
      return String(rowId) === String(beneficiaryId) && rowMobile === senderMobile;
    });
    if (!providerBeneficiary) {
      return res.status(400).json({
        success: false,
        message: 'This beneficiary does not belong to the selected sender mobile number.',
      });
    }
    const verifiedBeneficiary = toBeneficiary(providerBeneficiary);
    const providerAccount = verifiedBeneficiary.account || String(beneaccount || '');
    const providerIfsc = verifiedBeneficiary.ifsc || String(ifsc || '').toUpperCase();

    // IMPS and NEFT are the only modes the provider settles; anything else would
    // be rejected after the wallet had already been debited.
    const mode = String(transfer_mode || 'IMPS').toUpperCase();
    if (mode !== 'IMPS' && mode !== 'NEFT') {
      return res
        .status(400)
        .json({ success: false, message: 'Transfer mode must be IMPS or NEFT.' });
    }

    const aepsWallet = await AepsWallet.findOne({ userId: retailerId });
    if (!aepsWallet || !aepsWallet.pin) {
      return res.status(400).json({ success: false, message: 'Please set your wallet PIN first.' });
    }
    const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
    if (!isPinValid) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN' });
    }

    const transactionId = makeReferenceId('DMT');

    // Lock the funds as PROCESSING. A payout is accepted before the beneficiary
    // bank confirms it, so the money stays held until there is a final answer —
    // refunding on "Pending" would hand back money that is on its way.
    try {
      await lockFundsForTransaction(retailerId, 'MAIN', -totalAmount, {
        transactionId,
        userId: retailerId,
        type: 'DMT',
        amount: totalAmount,
        metadata: {
          beneficiaryId: String(beneficiaryId),
          beneficiaryAccount: providerAccount || null,
          transferMode: mode,
          provider: 'ICCHHAMATI',
        },
      });
    } catch (walletError) {
      return res.status(400).json({
        success: false,
        message: walletError.message || 'Insufficient Main Wallet balance for this transfer.',
      });
    }

    let data;
    try {
      data = await icchhamatiPost('/api/v2/beneficiaries/beneficiary-payout', {
        beneficiary_id: String(beneficiaryId),
        amount: Math.round(totalAmount),
        transfer_mode: mode,
        transaction_id: transactionId,
        details: `Money transfer ${transactionId}`,
      });
    } catch (providerError) {
      // Do not refund on a timeout: the provider may have accepted the payout.
      return res.status(202).json({
        success: true,
        pending: true,
        message: 'Transfer submitted; provider status is being confirmed.',
        data: { transactionId, status: 'PENDING' },
      });
    }

    // The envelope says whether the payout was accepted; the transaction's own
    // status says whether it has settled. A payout accepted but not yet settled
    // is PENDING, not SUCCESS.
    const status = isOk(data) ? normaliseStatus(data?.data?.status ?? '2') : 'FAILED';
    const message = providerMessage(
      data,
      status === 'FAILED' ? 'The transfer was not accepted.' : ''
    );

    await Transaction.findOneAndUpdate(
      { transactionId },
      {
        $set: {
          'metadata.providerTxnId': data?.data?.txnid || null,
          'metadata.rrn': data?.data?.rrn || null,
          'metadata.apiResponse': data,
        },
      }
    );

    await DmtTransaction.create({
      transactionId,
      retailerId,
      remitterMobile: senderMobile,
      beneficiaryAccount: String(data?.data?.account_no || providerAccount || 'NA'),
      beneficiaryIfsc: String(providerIfsc || 'NA'),
      amount: totalAmount,
      status: status === 'SUCCESS' ? 'SUCCESS' : status === 'FAILED' ? 'FAILED' : 'PENDING',
      apiReference: data?.data?.txnid || data?.data?.rrn || null,
      apiResponse: data,
    });

    if (status === 'PENDING') {
      // ponytail: the provider publishes no payout status endpoint, so a pending
      // transfer stays PROCESSING until it is settled by hand in the admin
      // portal. Wire it into the reconciliation cron once they expose one.
      return res.status(200).json({
        success: true,
        pending: true,
        message: message || 'Transfer accepted and is being processed.',
        data: { ...(data?.data || {}), transactionId },
      });
    }

    // Refunds the locked funds when the status is FAILED.
    await resolveTransaction(transactionId, status, message, 'MAIN');

    return res.status(status === 'SUCCESS' ? 200 : 400).json({
      success: status === 'SUCCESS',
      message: message || (status === 'SUCCESS' ? 'Transfer successful' : 'Transfer failed'),
      data: { ...(data?.data || {}), transactionId },
    });
  } catch (error) {
    console.error('DMT Transfer Error:', error?.response?.data || error?.message || error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDmtHistory = async (req, res) => {
  try {
    const history = await DmtTransaction.find({ retailerId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
