import {
  icchhamatiPost,
  isOk,
  normaliseStatus,
  providerMessage,
} from '../utils/icchhamati.util.js';
import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Retailer from '../models/users/retailer.model.js';

/**
 * Collecting money from a customer, two ways.
 *
 * Payment gateway — the retailer creates an order, hands the customer the
 * checkout link (UPI, card, netbanking), and the retailer's MAIN wallet is
 * credited once the payment verifies. This is an inflow: nothing is locked or
 * debited, and the wallet is only touched after the gateway confirms.
 *
 * Virtual account QR — a permanent UPI QR printed against the retailer's own
 * settlement bank account. Money scanned into it settles to that bank account
 * directly, never through our wallet, so no transaction is recorded for it.
 */

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const normalizePaymentUrl = (rawUrl, transactionId) => {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    // Icchhamati currently returns a hash route whose access_key is not
    // persisted, while its checkout API reliably resolves the same order by
    // txnid. Use the provider's query-based checkout route for that host only.
    if (
      url.hostname === 'icchhamatidataservice.com' &&
      url.pathname.startsWith('/pg/checkout/') &&
      transactionId
    ) {
      return `${url.origin}/pg/checkout?txnid=${encodeURIComponent(transactionId)}`;
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
};

/** The gateway refuses anything smaller: "Minimum amount is 200.00". */
const MIN_ORDER_AMOUNT = 200;

/**
 * Creates the checkout order and returns the link to show the customer.
 */
export const createOrder = async (req, res) => {
  try {
    const { amount, name, mobile, mobile_number, email } = req.body;
    const totalAmount = Number(amount);
    const payerMobile = String(mobile || mobile_number || '').replace(/\D/g, '');

    if (!(totalAmount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }
    // Checked before anything is recorded: the gateway would refuse it anyway,
    // and a rejected order should not leave a dead PENDING row behind.
    if (totalAmount < MIN_ORDER_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `The minimum payment amount is ₹${MIN_ORDER_AMOUNT}.`,
      });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "The payer's name is required" });
    }
    if (!/^[6-9]\d{9}$/.test(payerMobile)) {
      return res
        .status(400)
        .json({ success: false, message: 'Enter a valid 10-digit customer mobile number' });
    }

    // Keep gateway references within the short order-id format used by
    // Icchhamati/BharatPay examples. Recharge/DMT references can be longer,
    // but checkout sessions may be keyed by a provider-limited order ID.
    const referenceId = `PG${Date.now().toString().slice(-12)}${String(
      Math.floor(Math.random() * 10000)
    ).padStart(4, '0')}`;

    // Recorded before the gateway is called: the order id is what the verify
    // step and any later reconciliation key off, and a link handed to a customer
    // for an order we have no record of could never be credited.
    await Transaction.create({
      transactionId: referenceId,
      userId: req.user.id,
      type: 'PG_COLLECTION',
      amount: totalAmount,
      status: 'PENDING',
      metadata: {
        payerName: String(name).trim(),
        payerMobile,
        payerEmail: email || null,
        provider: 'ICCHHAMATI',
      },
    });

    const data = await icchhamatiPost('/api/pg/request', {
      reference_id: referenceId,
      amount: Math.round(totalAmount),
      name: String(name).trim(),
      email: email || undefined,
      mobile_number: payerMobile,
      success_url: `${getFrontendUrl()}/payments/collect?ref=${referenceId}&result=success`,
      failure_url: `${getFrontendUrl()}/payments/collect?ref=${referenceId}&result=failure`,
    });

    // The gateway returns the link at the top level — {status, message,
    // payment_url} — not under `data` as its documentation shows, and sends no
    // order id at all: our own reference is what /pg/verify is queried by.
    const rawPaymentUrl = data?.payment_url || data?.data?.payment_url || null;
    const orderId = data?.order_id || data?.data?.order_id || referenceId;
    const paymentUrl = normalizePaymentUrl(rawPaymentUrl, orderId);

    console.info('Icchhamati payment link created', {
      referenceId,
      providerOrderId: orderId,
      providerStatus: data?.status,
      normalizedPaymentUrl: paymentUrl !== rawPaymentUrl,
      paymentUrlHost: paymentUrl ? (() => {
        try {
          return new URL(paymentUrl).host;
        } catch {
          return 'invalid-url';
        }
      })() : null,
    });

    if (!isOk(data) || !paymentUrl) {
      await Transaction.findOneAndUpdate(
        { transactionId: referenceId, status: 'PENDING' },
        { $set: { status: 'FAILED', 'metadata.apiResponse': data } }
      );
      return res.status(400).json({
        success: false,
        // An accepted-looking message with no link is still a failure, and
        // echoing "Payment initiated successfully" back would be a lie.
        message: isOk(data)
          ? 'The gateway accepted the order but returned no payment link.'
          : providerMessage(data, 'Could not create the payment link.'),
      });
    }

    await Transaction.findOneAndUpdate(
      { transactionId: referenceId },
      {
        $set: {
          'metadata.orderId': orderId,
          'metadata.paymentUrl': paymentUrl,
          'metadata.apiResponse': data,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'Payment link created.'),
      data: {
        transactionId: referenceId,
        orderId,
        paymentUrl,
        amount: totalAmount,
        status: data?.data?.status || 'PENDING',
      },
    });
  } catch (error) {
    console.error('Create Payment Order Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to create payment link' });
  }
};

/**
 * Asks the gateway whether the customer paid, and credits the retailer if so.
 *
 * Idempotent: the transaction is claimed out of PENDING before the wallet is
 * touched, so a customer refreshing the callback page, the retailer polling and
 * a later reconciliation cannot credit the same order twice.
 */
export const verifyOrder = async (req, res) => {
  try {
    const { transactionId, txnid } = req.body;
    const reference = transactionId || txnid;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Transaction id is required' });
    }

    // Scoped to the caller: a retailer must not be able to settle, or read,
    // someone else's order by guessing a reference.
    const txn = await Transaction.findOne({
      transactionId: reference,
      userId: req.user.id,
      type: 'PG_COLLECTION',
    });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }
    if (txn.status !== 'PENDING') {
      return res.status(200).json({ success: true, data: { status: txn.status } });
    }

    const data = await icchhamatiPost('/api/pg/verify', {
      txnid: txn.metadata?.orderId || txn.transactionId,
    });

    const status = isOk(data) ? normaliseStatus(data?.data?.status ?? data?.status) : 'PENDING';

    // An unpaid or still-open order is not a failure: the customer may pay in a
    // minute. Only a definite answer moves it out of PENDING.
    if (status === 'PENDING') {
      return res.status(200).json({
        success: true,
        pending: true,
        message: providerMessage(data, 'Payment not completed yet.'),
        data: { status: 'PENDING' },
      });
    }

    const claimed = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PENDING' },
      {
        $set: {
          status,
          'metadata.gatewayStatus': data?.data?.status ?? null,
          'metadata.verifyResponse': data,
        },
      },
      { new: true }
    );

    if (claimed && status === 'SUCCESS') {
      // An inflow: the customer paid the retailer, so the full amount lands in
      // the retailer's MAIN wallet.
      await MainWallet.findOneAndUpdate(
        { userId: claimed.userId },
        { $inc: { balance: Number(claimed.amount) } },
        { upsert: true }
      );
    }

    return res.status(200).json({
      success: status === 'SUCCESS',
      message: providerMessage(
        data,
        status === 'SUCCESS' ? 'Payment received.' : 'Payment failed.'
      ),
      data: { status, transactionId: txn.transactionId },
    });
  } catch (error) {
    console.error('Verify Payment Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

/**
 * Generates the retailer's UPI QR against a bank account.
 *
 * The documented path and the provider's own client disagree on where this
 * lives, so the documented one is tried first and the other is used if the
 * gateway does not recognise it.
 */
const hasQrData = (data) => Boolean(
  data?.data?.qrcode_image || data?.data?.qrcode_pdf || data?.data?.virtual_upi_handle
);

const generateQrOnEitherPath = async (payload) => {
  // The provider's own live virtual-account client uses /api/va/generate-qr.
  // Keep the docs route as a compatibility fallback because both have existed
  // in different provider deployments.
  const preferred = process.env.ICCHHAMATI_QR_PATH || '/api/va/generate-qr';
  const fallback = preferred === '/api/va/generate-qr'
    ? '/api/v2/generate-qr'
    : '/api/va/generate-qr';
  const first = await icchhamatiPost(preferred, payload);
  const notRouted = /not found|no query results|404|route/i.test(String(first?.message || ''));
  if (isOk(first) && hasQrData(first)) return first;
  if (!notRouted && isOk(first)) {
    // A successful envelope without a QR is not usable for a payment.
    return icchhamatiPost(fallback, payload);
  }
  return notRouted ? icchhamatiPost(fallback, payload) : first;
};

export const generateQr = async (req, res) => {
  try {
    const { name, account_number, accountNumber, account_ifsc, ifsc } = req.body;
    const accountNo = String(account_number || accountNumber || '').trim();
    const accountIfsc = String(account_ifsc || ifsc || '')
      .trim()
      .toUpperCase();

    if (!name || !accountNo || !accountIfsc) {
      return res.status(400).json({
        success: false,
        message: 'Account holder name, account number and IFSC are required',
      });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(accountIfsc)) {
      return res.status(400).json({ success: false, message: 'Enter a valid IFSC code' });
    }

    const data = await generateQrOnEitherPath({
      name: String(name).trim(),
      account_number: accountNo,
      account_ifsc: accountIfsc,
    });

    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'Could not generate the QR code.') });
    }

    const qr = data.data || {};
    // The QR is a standing instrument for this retailer, not a one-off, so it is
    // kept: it does not have to be regenerated on every visit, and support can
    // see which virtual account a retailer is collecting into.
    await Retailer.findByIdAndUpdate(req.user.id, {
      $set: {
        collectionQr: {
          virtualAccountId: qr.virtual_account_id || null,
          upiHandle: qr.virtual_upi_handle || null,
          accountNumber: accountNo,
          ifsc: accountIfsc,
          generatedAt: new Date(),
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'QR code generated.'),
      data: {
        virtualAccountId: qr.virtual_account_id || null,
        upiHandle: qr.virtual_upi_handle || null,
        qrImage: qr.qrcode_image || null,
        qrPdf: qr.qrcode_pdf || null,
      },
    });
  } catch (error) {
    console.error('Generate QR Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
};

export const getCollectionHistory = async (req, res) => {
  try {
    const history = await Transaction.find({ userId: req.user.id, type: 'PG_COLLECTION' })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Collection History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch collections' });
  }
};
