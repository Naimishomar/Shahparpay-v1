import {
  icchhamatiPost,
  isOk,
  normaliseStatus,
  providerMessage,
} from '../utils/icchhamati.util.js';
import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';

/**
 * Collecting money from a customer through the payment gateway: the retailer
 * creates an order, hands the customer the checkout link (UPI, card,
 * netbanking), and the retailer's Main wallet is credited once the payment
 * verifies. This is an inflow: nothing is locked or debited, and the wallet is
 * only touched after the gateway confirms.
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

export const createOrder = async (req, res) => {
  try {
    const { amount, name, mobile, mobile_number, email } = req.body;
    const totalAmount = Number(amount);
    const payerMobile = String(mobile || mobile_number || '').replace(/\D/g, '');
    const payerEmail = String(email || '').trim();

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
    // The gateway's own documentation marks email optional, but it refuses the
    // order without one — {"status":0,"message":"Validation failed","errors":
    // {"email":["The email field is required."]}} — and an empty string counts
    // as absent. Caught here so the retailer is told which field is missing
    // rather than watching every link fail on a generic validation error.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "The customer's email address is required by the payment gateway" });
    }
    // A collection credits a Main wallet recorded against a Retailer, so only a
    // retailer can raise one.
    if (req.user.role !== 'retailer') {
      return res.status(403).json({
        success: false,
        message: 'A payment link can only be created for a retailer account.',
      });
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
        payerEmail,
        provider: 'ICCHHAMATI',
        collectionChannel: 'PAYMENT_LINK',
      },
    });

    const data = await icchhamatiPost('/api/pg/request', {
      reference_id: referenceId,
      amount: Math.round(totalAmount),
      name: String(name).trim(),
      email: payerEmail,
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

    const { transaction, providerData } = await syncCollectionTransaction(txn);
    const status = transaction.status;

    return res.status(200).json({
      success: status === 'SUCCESS',
      message: providerMessage(
        providerData,
        status === 'SUCCESS'
          ? 'Payment received.'
          : status === 'PENDING'
            ? 'Payment not completed yet.'
            : 'Payment failed.'
      ),
      data: { status, transactionId: txn.transactionId },
    });
  } catch (error) {
    console.error('Verify Payment Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

/**
 * Refreshes one collection against Icchhamati and settles it exactly once.
 *
 * Keeping this operation server-side means the frontend never trusts a
 * customer's redirect or self-reported payment result.
 */
export const syncCollectionTransaction = async (txn) => {
  if (txn.status !== 'PENDING') return { transaction: txn, providerData: null };

  const providerTxnId = txn.metadata?.providerTxnId || txn.metadata?.orderId || txn.transactionId;
  const providerData = await icchhamatiPost('/api/pg/verify', { txnid: providerTxnId });
  const status = isOk(providerData)
    ? normaliseStatus(providerData?.data?.status ?? providerData?.status)
    : 'PENDING';

  // An unpaid or still-open order is not a failure: the customer may pay in a
  // minute. Only a definite answer moves it out of PENDING.
  if (status === 'PENDING') return { transaction: txn, providerData };

  const claimed = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: 'PENDING' },
    {
      $set: {
        status,
        'metadata.gatewayStatus': providerData?.data?.status ?? providerData?.status ?? null,
        'metadata.verifyResponse': providerData,
        'metadata.lastStatusCheckedAt': new Date(),
      },
    },
    { new: true }
  );

  if (claimed && status === 'SUCCESS') {
    // The gateway receives the payment under the platform's Icchhamati merchant
    // account; after the provider confirms success, credit the retailer's Main wallet.
    await MainWallet.findOneAndUpdate(
      { userId: claimed.userId },
      {
        $inc: { balance: Number(claimed.amount) },
        $setOnInsert: { userModel: 'Retailer' },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  return { transaction: claimed || (await Transaction.findById(txn._id)), providerData };
};

export const getCollectionHistory = async (req, res) => {
  try {
    const history = await Transaction.find({ userId: req.user.id, type: 'PG_COLLECTION' })
      .sort({ createdAt: -1 })
      .limit(100);

    // Make the Recent Collections table live: reconcile pending orders every
    // time it is loaded/refreshed instead of returning stale local statuses.
    await Promise.all(history
      .filter((txn) => txn.status === 'PENDING')
      .map(async (txn) => {
        try {
          await syncCollectionTransaction(txn);
        } catch (error) {
          console.error('Collection status refresh failed:', {
            transactionId: txn.transactionId,
            message: error?.response?.data || error?.message,
          });
        }
      }));

    const refreshedHistory = await Transaction.find({ userId: req.user.id, type: 'PG_COLLECTION' })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, data: refreshedHistory });
  } catch (error) {
    console.error('Collection History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch collections' });
  }
};
