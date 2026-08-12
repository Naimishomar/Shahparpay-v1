import axios from 'axios';
import { generatePaySprintToken, getOnboardStatusEndpoint } from '../utils/paysprint.util.js';
import Retailer from '../models/users/retailer.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Transaction from '../models/transaction.model.js';

const getUpiBase = () => process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const getUpiHeaders = () => ({
  Token: generatePaySprintToken(),
  Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
  'Content-Type': 'application/json',
  'User-Agent': process.env.PAYSPRINT_PARTNER_ID || 'PS001',
  Accept: 'application/json',
});

// PaySprint UPI Cashout txn_status codes (from the UPI-CASHOUT callback docs):
//   '0' = FAILED at bank, '1' = SUCCESS, '2' = QR initiated, '3' = QR generated,
//   '4' = QR expired. Everything non-final maps to PROCESSING.
const mapUpiStatus = (code) => {
  switch (String(code ?? '').trim()) {
    case '1':
      return 'SUCCESS';
    case '0':
    case '4':
      return 'FAILED';
    case '2':
    case '3':
    default:
      return 'PROCESSING';
  }
};

// Checks whether the retailer's merchant is onboarded & accepted on Bank 6,
// which is a mandatory prerequisite for UPI Cashout.
const isBank6Onboarded = async (merchantCode, mobile) => {
  try {
    const response = await axios.post(
      getOnboardStatusEndpoint('bank6'),
      {
        merchantcode: merchantCode,
        mobile: String(mobile),
        pipe: 'bank6',
      },
      { headers: getUpiHeaders(), validateStatus: () => true }
    );
    const data = response.data || {};
    return data.response_code === 1 && data.is_approved === 'Accepted';
  } catch (error) {
    console.warn(`[upi] bank6 status check failed (${merchantCode}):`, error.message);
    return null; // Unknown — let PaySprint validate during token generation.
  }
};

// Atomically finalizes a UPI_CASHOUT transaction. Idempotent: only a PENDING or
// PROCESSING transaction may transition, so concurrent webhook + status polling
// can never double-credit the MAIN wallet.
const finalizeUpiCashout = async (txn, gatewayData = {}) => {
  const status = mapUpiStatus(gatewayData.txn_status ?? gatewayData.paysprintStatus);
  if (status !== 'SUCCESS' && status !== 'FAILED') {
    return { updated: false, status };
  }

  const claimed = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: { $in: ['PENDING', 'PROCESSING'] } },
    {
      $set: {
        status,
        'metadata.refid': gatewayData.refid || txn.metadata?.refid,
        'metadata.paysprintRef': gatewayData.ackno || txn.metadata?.paysprintRef,
        'metadata.paysprintStatus': gatewayData.txn_status,
        'metadata.comm': gatewayData.comm ?? txn.metadata?.comm,
        'metadata.customerName': gatewayData.customer_name || txn.metadata?.customerName,
        'metadata.gatewayMessage':
          gatewayData.message || gatewayData.remarks || txn.metadata?.gatewayMessage || '',
      },
    },
    { new: true }
  );

  if (!claimed) return { updated: false, status: txn.status };

  if (status === 'SUCCESS') {
    // UPI Cashout is an inflow: the customer paid the retailer via UPI QR,
    // so the full amount is credited to the retailer's MAIN wallet.
    const creditAmount = Number(claimed.amount);
    await MainWallet.findOneAndUpdate(
      { userId: claimed.userId },
      { $inc: { balance: creditAmount } },
      { upsert: true }
    );
  }

  return { updated: true, status };
};

// Generates the PaySprint hosted UPI Cashout QR page URL for a customer.
export const generateToken = async (req, res) => {
  try {
    const { mobile, amount, redirectUrl } = req.body;

    if (!mobile || !/^\d{10}$/.test(String(mobile))) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter a valid 10-digit customer mobile number' });
    }
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }
    const merchantCode = String(retailer.retailerId);

    // Bank 6 onboarding is a hard prerequisite for UPI Cashout.
    const onboarded = await isBank6Onboarded(merchantCode, retailer.contactNumber);
    if (onboarded === false) {
      return res.status(400).json({
        success: false,
        message:
          'Your merchant is not onboarded for UPI Cashout (Bank 6). Please complete onboarding first.',
      });
    }

    // Create a PENDING transaction so webhooks/polling can correlate results.
    const localId = `UPI${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await Transaction.create({
      transactionId: localId,
      userId: retailer._id,
      type: 'UPI_CASHOUT',
      amount: amountNum,
      status: 'PENDING',
      metadata: {
        mobile: String(mobile),
        amount: amountNum,
        merchantCode,
      },
    });

    // The customer is redirected here after paying on the PaySprint page.
    const finalRedirectUrl = redirectUrl || `${getFrontendUrl()}/upi-payments?txn=${localId}`;

    const payload = {
      merchant_code: merchantCode,
      redirect_url: finalRedirectUrl,
    };

    const response = await axios.post(`${getUpiBase()}/service/upi/cashout/get_token`, payload, {
      headers: getUpiHeaders(),
      validateStatus: () => true,
    });

    const data = response.data || {};
    if (data.response_code === 1 || data.status === true) {
      if (!data.url) {
        await Transaction.findOneAndUpdate(
          { transactionId: localId },
          {
            status: 'FAILED',
            'metadata.apiMessage': 'PaySprint returned success without a cashout URL',
          }
        );
        return res
          .status(500)
          .json({ success: false, message: 'PaySprint returned success without a cashout URL' });
      }
      return res.status(200).json({
        success: true,
        message: data.message || 'UPI Cashout QR page generated',
        data: { url: data.url, transactionId: localId, token: data.token },
      });
    }

    await Transaction.findOneAndUpdate(
      { transactionId: localId },
      { status: 'FAILED', 'metadata.apiMessage': data.message || 'Token generation failed' }
    );
    return res
      .status(400)
      .json({ success: false, message: data.message || 'Failed to generate UPI cashout token' });
  } catch (error) {
    console.error('UPI Cashout generateToken Error:', error?.response?.data || error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to generate UPI cashout token' });
  }
};

// Returns the live status of a UPI Cashout transaction. Accepts the local
// transactionId, the PaySprint refid, or both.
export const getTxnStatus = async (req, res) => {
  try {
    const { transactionId, refid } = req.body;
    if (!transactionId && !refid) {
      return res
        .status(400)
        .json({ success: false, message: 'transactionId or refid is required' });
    }

    let local = null;
    if (transactionId) {
      local = await Transaction.findOne({ transactionId, userId: req.user.id });
    }

    // Already final — no need to hit PaySprint again.
    if (local && ['SUCCESS', 'FAILED'].includes(local.status)) {
      return res
        .status(200)
        .json({ success: true, data: { status: local.status, transaction: local } });
    }

    const refToQuery = refid || local?.metadata?.refid;
    if (!refToQuery) {
      return res.status(200).json({
        success: true,
        data: {
          status: local ? local.status : 'PENDING',
          message: 'Awaiting PaySprint callback with transaction refid',
          transaction: local,
        },
      });
    }

    const retailer = await Retailer.findById(req.user.id);
    const merchantCode = String(retailer?.retailerId || local?.metadata?.merchantCode || '');

    const response = await axios.post(
      `${getUpiBase()}/service/upi/cashout/txn_status`,
      { merchant_code: merchantCode, refid: refToQuery },
      { headers: getUpiHeaders(), validateStatus: () => true }
    );

    const data = response.data || {};
    const gatewayData = {
      ...(data.data || {}),
      message: data.message || data.data?.remarks || '',
    };

    let finalStatus = mapUpiStatus(gatewayData.txn_status);
    if (local) {
      const result = await finalizeUpiCashout(local, gatewayData);
      if (result.updated) finalStatus = result.status;
    }

    return res.status(200).json({ success: true, data: { status: finalStatus, raw: data } });
  } catch (error) {
    console.error('UPI Cashout status Error:', error?.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch UPI cashout status' });
  }
};

// PaySprint UPI-CASHOUT / UPI-CASHOUT-2FA webhook. Must answer quickly with the
// acknowledgment contract: { status: 200, refid, message }.
export const webhook = async (req, res) => {
  const body = req.body || {};
  const event = body.event;
  let param = body.param;

  if (!param && body.param_enc) {
    try {
      const { decryptPayload } = await import('../utils/paysprint.util.js');
      param = JSON.parse(decryptPayload(body.param_enc));
    } catch (err) {
      console.error('UPI webhook decrypt failed:', err.message);
      return res.status(200).json({ status: 200, message: 'invalid payload' });
    }
  }

  const data = param?.data || param || {};
  const refid = data.refid;
  const mobile = data.mobile;

  // 2FA callbacks carry no refid/txn_status — just acknowledge.
  if (event === 'UPI-CASHOUT-2FA' || (!data.txn_status && !refid)) {
    return res.status(200).json({ status: 200, message: 'acknowledged' });
  }

  const gatewayData = { ...data, message: data.message || param?.message || '' };

  try {
    // Locate the pending local transaction (by refid, then by mobile).
    let txn = null;
    if (refid) {
      txn = await Transaction.findOne({ type: 'UPI_CASHOUT', 'metadata.refid': refid });
    }
    if (!txn && mobile) {
      txn = await Transaction.findOne({
        type: 'UPI_CASHOUT',
        status: { $in: ['PENDING', 'PROCESSING'] },
        'metadata.mobile': String(mobile),
      }).sort({ createdAt: -1 });
    }

    if (txn) {
      await finalizeUpiCashout(txn, gatewayData);
    } else {
      console.warn(`[upi webhook] no matching transaction for refid=${refid}, mobile=${mobile}`);
    }

    return res
      .status(200)
      .json({ status: 200, refid, message: 'Transaction completed successfully' });
  } catch (error) {
    console.error('UPI webhook processing error:', error.message);
    return res
      .status(200)
      .json({ status: 200, refid, message: 'Transaction completed successfully' });
  }
};

// Reports whether the retailer's merchant is onboarded & accepted on Bank 6.
export const merchantStatus = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const merchantCode = String(retailer.retailerId);
    const response = await axios.post(
      getOnboardStatusEndpoint('bank6'),
      {
        merchantcode: merchantCode,
        mobile: String(retailer.contactNumber),
        pipe: 'bank6',
      },
      { headers: getUpiHeaders(), validateStatus: () => true }
    );

    const data = response.data || {};
    return res.status(200).json({
      success: true,
      data: {
        merchantCode,
        pipe: 'bank6',
        onboarded: data.response_code === 1 && data.is_approved === 'Accepted',
        is_approved: data.is_approved,
        message: data.message,
      },
    });
  } catch (error) {
    console.error('UPI merchant status error:', error?.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to check merchant status' });
  }
};
