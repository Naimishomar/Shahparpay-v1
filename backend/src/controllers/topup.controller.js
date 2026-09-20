import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import {
  razorpayPost,
  razorpayGet,
  razorpayMessage,
  verifyWebhookSignature,
  toPaise,
  toRupees,
} from '../utils/razorpay.util.js';

/**
 * Self-service wallet top-up over a Razorpay UPI QR.
 *
 * The retailer (or distributor) enters an amount, gets a single-use QR for
 * exactly that amount, and pays it from any UPI app. Razorpay's signed
 * `qr_code.credited` webhook credits the main wallet. This replaces the manual
 * fund-request path — deposit slip, UTR, someone approving it by hand — for
 * anyone who would rather pay by UPI.
 *
 * Nothing here trusts the client: the amount that is credited is the amount
 * Razorpay says was captured, never the amount the app asked for.
 */

/** Below this a UPI top-up costs more in support than it is worth. */
const MIN_TOPUP = 100;
/** NPCI caps a P2M UPI payment at ₹1,00,000; a larger QR could never be paid. */
const MAX_TOPUP = 100000;
/** An unpaid QR is closed rather than left standing as a live payment target. */
const QR_TTL_SECONDS = 30 * 60;

const userModelFor = (role) => (role === 'distributor' ? 'Distributor' : 'Retailer');

/**
 * Credits a top-up exactly once.
 *
 * The transaction is claimed out of PENDING before the wallet is touched, so
 * the webhook, a webhook retry and a status poll racing each other still credit
 * a single time. If the wallet write then fails the claim is released, because
 * a SUCCESS row with no money behind it is a top-up the retailer paid for and
 * never received.
 */
const creditTopup = async (txn, { paymentId, paidPaise, method, vpa }) => {
  const amount = toRupees(paidPaise);
  if (!Number.isFinite(amount) || amount <= 0) return { credited: false, transaction: txn };

  const claimed = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: 'PENDING' },
    {
      $set: {
        status: 'SUCCESS',
        amount,
        'metadata.razorpayPaymentId': paymentId,
        'metadata.paymentMethod': method || 'upi',
        'metadata.payerVpa': vpa || null,
        'metadata.creditedAt': new Date(),
      },
    },
    { new: true }
  );
  if (!claimed) return { credited: false, transaction: await Transaction.findById(txn._id) };

  try {
    await MainWallet.findOneAndUpdate(
      { userId: claimed.userId },
      {
        $inc: { balance: amount },
        $setOnInsert: { userModel: claimed.metadata?.userModel || 'Retailer' },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Put it back so the next webhook retry or status poll can settle it,
    // rather than leaving a paid top-up marked SUCCESS with no balance.
    await Transaction.findOneAndUpdate(
      { _id: claimed._id, status: 'SUCCESS' },
      { $set: { status: 'PENDING' }, $unset: { 'metadata.creditedAt': '' } }
    );
    console.error('[Topup] wallet credit failed, transaction released back to PENDING', {
      transactionId: claimed.transactionId,
      paymentId,
      message: error?.message,
    });
    throw error;
  }

  return { credited: true, transaction: claimed };
};

/**
 * Mints the QR the retailer scans.
 */
export const createTopupQr = async (req, res) => {
  // Held outside the try so a throw can still close the row it opened. A
  // provider call that blows up — bad credentials, a timeout — used to leave a
  // PENDING top-up behind that no QR was ever minted for and nothing could
  // ever settle.
  let txn = null;
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }
    if (amount < MIN_TOPUP) {
      return res
        .status(400)
        .json({ success: false, message: `The minimum top-up amount is ₹${MIN_TOPUP}.` });
    }
    if (amount > MAX_TOPUP) {
      return res.status(400).json({
        success: false,
        message: `UPI allows at most ₹${MAX_TOPUP.toLocaleString('en-IN')} in one payment. Split it into smaller top-ups.`,
      });
    }
    if (!['retailer', 'distributor'].includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: 'Only a retailer or distributor can top up a wallet.' });
    }

    const referenceId = `TOP${Date.now()}${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}`;

    // Recorded before Razorpay is called: the webhook settles against this row,
    // and a QR handed out for a top-up we have no record of could never be
    // credited.
    txn = await Transaction.create({
      transactionId: referenceId,
      userId: req.user.id,
      type: 'WALLET_TOPUP',
      amount,
      status: 'PENDING',
      metadata: {
        provider: 'RAZORPAY',
        channel: 'UPI_QR',
        userModel: userModelFor(req.user.role),
      },
    });

    const { ok, data } = await razorpayPost('/payments/qr_codes', {
      type: 'upi_qr',
      name: 'Wallet Top-up',
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: toPaise(amount),
      description: `Wallet top-up ${referenceId}`,
      close_by: Math.floor(Date.now() / 1000) + QR_TTL_SECONDS,
      // The only link between an incoming payment and a wallet. Razorpay echoes
      // notes back on the webhook, so nothing has to be provisioned per user.
      notes: { reference: referenceId, userId: String(req.user.id) },
    });

    if (!ok || !data?.id || !data?.image_url) {
      await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'PENDING' },
        { $set: { status: 'FAILED', 'metadata.apiResponse': data } }
      );
      return res.status(400).json({
        success: false,
        message: razorpayMessage(data, 'Could not generate the payment QR. Please try again.'),
      });
    }

    await Transaction.findOneAndUpdate(
      { _id: txn._id },
      {
        $set: {
          'metadata.qrCodeId': data.id,
          'metadata.qrImageUrl': data.image_url,
          // Recorded so a pending row can be closed once the QR can no longer
          // be paid, instead of being polled forever.
          'metadata.expiresAt': new Date((data.close_by || 0) * 1000).toISOString(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Scan the QR with any UPI app to add money.',
      data: {
        transactionId: referenceId,
        qrCodeId: data.id,
        qrImage: data.image_url,
        amount,
        expiresAt: new Date((data.close_by || 0) * 1000).toISOString(),
      },
    });
  } catch (error) {
    if (txn) {
      await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'PENDING' },
        { $set: { status: 'FAILED', 'metadata.failureReason': error?.message || 'QR creation failed' } }
      ).catch(() => {});
    }

    // A missing key is an operator error, not a provider outage, and the two
    // look identical in a log that only prints "failed". Say which it is: this
    // is the difference between checking the server's environment and opening a
    // ticket with Razorpay.
    const misconfigured = String(error?.message || '').includes('are not configured');
    if (misconfigured) {
      console.error(
        '[Topup] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing from this server\'s environment — no QR can be minted until they are set.'
      );
    } else {
      console.error('Create Topup QR Error:', error?.response?.data || error?.message);
    }

    return res.status(misconfigured ? 503 : 500).json({
      success: false,
      message: misconfigured
        ? 'UPI top-up is not configured on this server yet. Please contact support.'
        : 'Failed to generate the payment QR',
    });
  }
};

/**
 * Refreshes one pending top-up against Razorpay and settles it exactly once.
 *
 * The webhook is the faster path, but it is not the only one: until the backend
 * is served over HTTPS no webhook can be registered at all, and even afterwards
 * a notification can be missed. Asking Razorpay directly is what makes a paid
 * top-up impossible to strand — the retailer's money is already gone, so the
 * credit cannot depend on a callback arriving.
 */
export const syncTopupTransaction = async (txn) => {
  if (txn.status !== 'PENDING') return txn;

  // A pending row with no QR behind it is an attempt that died before Razorpay
  // answered, so there is nothing to poll and nothing anyone could have paid.
  // Closing it here keeps the list honest and sweeps up rows left by earlier
  // failures.
  if (!txn.metadata?.qrCodeId) {
    return (
      (await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'PENDING' },
        { $set: { status: 'FAILED', 'metadata.failureReason': 'No QR was created for this top-up' } },
        { new: true }
      )) || txn
    );
  }

  const { ok, data } = await razorpayGet(`/payments/qr_codes/${txn.metadata.qrCodeId}/payments`);
  const captured = ok ? (data?.items || []).find((payment) => payment.status === 'captured') : null;

  if (captured) {
    const { transaction } = await creditTopup(txn, {
      paymentId: captured.id,
      paidPaise: captured.amount,
      method: captured.method,
      vpa: captured.vpa,
    });
    return transaction;
  }

  // An unpaid QR is not a failure until it expires — the retailer may still be
  // opening their UPI app. Once Razorpay has closed it nothing can be paid into
  // it any more, so the row is failed rather than left pending forever. A
  // provider call that errored tells us nothing, so it never fails a row.
  const expiresAt = Date.parse(txn.metadata?.expiresAt || '');
  if (ok && Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return (
      (await Transaction.findOneAndUpdate(
        { _id: txn._id, status: 'PENDING' },
        { $set: { status: 'FAILED', 'metadata.failureReason': 'QR expired unpaid' } },
        { new: true }
      )) || txn
    );
  }

  return txn;
};

/**
 * Asks Razorpay whether this QR was paid, and credits it if so.
 *
 * Polled by the app while the QR is on screen, so the retailer sees the credit
 * land without refreshing anything.
 */
export const getTopupStatus = async (req, res) => {
  try {
    const reference = String(req.params.transactionId || '').trim();
    // Scoped to the caller: a retailer must not settle or read someone else's
    // top-up by guessing a reference.
    const txn = await Transaction.findOne({
      transactionId: reference,
      userId: req.user.id,
      type: 'WALLET_TOPUP',
    });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Top-up not found' });
    }

    const transaction = await syncTopupTransaction(txn);
    return res.status(200).json({
      success: true,
      data: { status: transaction.status, amount: transaction.amount },
    });
  } catch (error) {
    console.error('Topup Status Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to check the payment status' });
  }
};

/**
 * Razorpay's `qr_code.credited` notification.
 *
 * This endpoint mints wallet balance on an unauthenticated POST, so it settles
 * nothing until the HMAC over the raw body matches the configured webhook
 * secret. With no secret configured there is nothing to verify, and treating
 * that as "skip the check" would make a missing environment variable an open
 * door — so it refuses instead.
 */
export const topupWebhook = async (req, res) => {
  try {
    if (!String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim()) {
      console.error(
        '[Topup Webhook] RAZORPAY_WEBHOOK_SECRET is not set — refusing the callback. Set it to the secret registered on the Razorpay webhook.'
      );
      return res.status(503).json({ success: false, message: 'Webhook is not configured' });
    }
    if (!verifyWebhookSignature(req.rawBody, req.get('x-razorpay-signature'))) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const body = req.body || {};
    if (body.event !== 'qr_code.credited') {
      // Razorpay delivers every subscribed event to the same URL. Anything else
      // is acknowledged so it is not retried forever, and ignored.
      return res.status(200).json({ success: true, ignored: body.event || null });
    }

    const payment = body.payload?.payment?.entity || {};
    const qrCode = body.payload?.qr_code?.entity || {};
    const reference = String(payment.notes?.reference || qrCode.notes?.reference || '').trim();
    if (!reference) {
      console.error('[Topup Webhook] credited event carries no reference note', body.payload);
      return res.status(400).json({ success: false, message: 'Payment carries no top-up reference' });
    }
    if (payment.status && payment.status !== 'captured') {
      return res.status(200).json({ success: true, credited: false, status: payment.status });
    }

    const txn = await Transaction.findOne({ transactionId: reference, type: 'WALLET_TOPUP' });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Top-up not found' });
    }
    // The QR is single-use and minted for one transaction; a payment arriving
    // against a different QR than the one we recorded is not this top-up.
    if (txn.metadata?.qrCodeId && qrCode.id && txn.metadata.qrCodeId !== qrCode.id) {
      console.error('[Topup Webhook] QR id does not match the recorded top-up', {
        reference,
        expected: txn.metadata.qrCodeId,
        received: qrCode.id,
      });
      return res.status(409).json({ success: false, message: 'QR does not match this top-up' });
    }

    const { credited, transaction } = await creditTopup(txn, {
      paymentId: payment.id,
      paidPaise: payment.amount,
      method: payment.method,
      vpa: payment.vpa,
    });

    return res.status(200).json({
      success: true,
      credited,
      transactionId: transaction.transactionId,
    });
  } catch (error) {
    console.error('Topup Webhook Error:', error?.response?.data || error?.message);
    // A 5xx makes Razorpay retry, which is what a transient database failure
    // needs: the credit is idempotent, so a retry cannot double-pay.
    return res.status(500).json({ success: false, message: 'Top-up reconciliation failed' });
  }
};

export const getTopupHistory = async (req, res) => {
  try {
    const history = await Transaction.find({ userId: req.user.id, type: 'WALLET_TOPUP' })
      .sort({ createdAt: -1 })
      .limit(100);

    // Reconcile pending rows every time the list is opened. Without this, a
    // retailer who pays and then closes the app before the on-screen poll
    // catches it has a real payment sitting uncredited until someone notices —
    // and with no webhook registered, nobody would.
    await Promise.all(
      history
        .filter((txn) => txn.status === 'PENDING')
        .map(async (txn) => {
          try {
            await syncTopupTransaction(txn);
          } catch (error) {
            console.error('Top-up status refresh failed:', {
              transactionId: txn.transactionId,
              message: error?.response?.data || error?.message,
            });
          }
        })
    );

    const refreshed = await Transaction.find({ userId: req.user.id, type: 'WALLET_TOPUP' })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, data: refreshed });
  } catch (error) {
    console.error('Topup History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch top-ups' });
  }
};
