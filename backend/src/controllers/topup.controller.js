import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Retailer from '../models/users/retailer.model.js';
import { sendSignupAlertEmail } from '../utils/email.js';
import axios from 'axios';
import sharp from 'sharp';
import jsQR from 'jsqr';
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

/**
 * The onboarding charge: a self-signed-up retailer pays this once, by the same
 * UPI QR, before an admin reviews them. SIGNUP_FEE_CREDIT of it lands in their Utility (MAIN) wallet so
 * the AEPS onboarding fee can be paid from it.
 */
const SIGNUP_FEE = 99;
const SIGNUP_FEE_CREDIT = 10;
const QR_TYPES = ['WALLET_TOPUP', 'SIGNUP_FEE'];

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
  const paid = toRupees(paidPaise);
  if (!Number.isFinite(paid) || paid <= 0) return { credited: false, transaction: txn };
  // The fee row books only the wallet credit; the ₹99 paid stays in metadata.
  const isFee = txn.type === 'SIGNUP_FEE';
  if (isFee && paid < SIGNUP_FEE) return { credited: false, transaction: txn };
  const amount = isFee ? SIGNUP_FEE_CREDIT : paid;

  const claimed = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: 'PENDING' },
    {
      $set: {
        status: 'SUCCESS',
        amount,
        'metadata.razorpayPaymentId': paymentId,
        'metadata.paymentMethod': method || 'upi',
        'metadata.payerVpa': vpa || null,
        'metadata.paidAmount': paid,
        'metadata.creditedAt': new Date(),
        // Retailers load money into the Trade (AEPS) wallet, as on Icchhamati;
        // distributors keep theirs in Main, which their fund transfers draw on.
        'metadata.walletType': isFee || txn.metadata?.userModel === 'Distributor' ? 'MAIN' : 'AEPS',
      },
    },
    { new: true }
  );
  if (!claimed) return { credited: false, transaction: await Transaction.findById(txn._id) };

  try {
    if (isFee) {
      // Paying is what sends the signup to the admin: the queue lists only paid
      // self signups, and the alert email goes out here rather than at signup.
      const r = await Retailer.findByIdAndUpdate(
        claimed.userId,
        { $set: { signupFeePaidAt: new Date() } },
        { new: true }
      );
      if (r) {
        // Not awaited: the alert must not slow or fail the credit.
        sendSignupAlertEmail('retailer', {
          id: r.retailerId,
          name: r.name,
          businessName: r.businessName,
          contactNumber: r.contactNumber,
          email: r.email,
        });
      }
    }
    const Wallet = claimed.metadata.walletType === 'MAIN' ? MainWallet : AepsWallet;
    await Wallet.findOneAndUpdate(
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
 * Records a PENDING row and mints the single-use Razorpay QR it settles against.
 * Answers the request itself on a provider refusal and returns null; returns the
 * row on success. Throws are left to the caller, which closes `txn` if set.
 */
const openQrTransaction = async (res, { prefix, type, name, amount, user }) => {
  const referenceId = `${prefix}${Date.now()}${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}`;

  // Recorded before Razorpay is called: the webhook settles against this row,
  // and a QR handed out for a payment we have no record of could never be
  // credited.
  const txn = await Transaction.create({
    transactionId: referenceId,
    userId: user.id,
    type,
    amount,
    status: 'PENDING',
    metadata: {
      provider: 'RAZORPAY',
      channel: 'UPI_QR',
      userModel: userModelFor(user.role),
    },
  });

  let ok, data;
  try {
    ({ ok, data } = await razorpayPost('/payments/qr_codes', {
      type: 'upi_qr',
      name,
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: toPaise(amount),
      description: `${name} ${referenceId}`,
      close_by: Math.floor(Date.now() / 1000) + QR_TTL_SECONDS,
      // The only link between an incoming payment and a wallet. Razorpay echoes
      // notes back on the webhook, so nothing has to be provisioned per user.
      notes: { reference: referenceId, userId: String(user.id) },
    }));
  } catch (error) {
    // A provider call that blows up (bad credentials, a timeout) must not leave
    // a PENDING row behind that no QR was ever minted for.
    await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PENDING' },
      {
        $set: {
          status: 'FAILED',
          'metadata.failureReason': error?.message || 'QR creation failed',
        },
      }
    ).catch(() => {});
    throw error;
  }

  if (!ok || !data?.id || !data?.image_url) {
    await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PENDING' },
      { $set: { status: 'FAILED', 'metadata.apiResponse': data } }
    );
    res.status(400).json({
      success: false,
      message: razorpayMessage(data, 'Could not generate the payment QR. Please try again.'),
    });
    return null;
  }

  // Razorpay's QR create response carries no raw `upi://pay?...` string —
  // `image_url` is a hosted poster with its branding on it. The UPI string is
  // read back out of that poster so clients can draw a bare QR; the poster
  // stays as the fallback when it cannot be read.
  const qrUpi = await readUpiFromPoster(data.image_url);
  return Transaction.findOneAndUpdate(
    { _id: txn._id },
    {
      $set: {
        'metadata.qrCodeId': data.id,
        'metadata.qrImageUrl': data.image_url,
        'metadata.qrUpi': qrUpi,
        // Recorded so a pending row can be closed once the QR can no longer
        // be paid, instead of being polled forever.
        'metadata.expiresAt': new Date((data.close_by || 0) * 1000).toISOString(),
      },
    },
    { new: true }
  );
};

/** Decodes the `upi://` string out of Razorpay's QR poster; null when unreadable. */
export const readUpiFromPoster = async (url) => {
  try {
    const { data: img } = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: 'attemptBoth' });
    return /^upi:/i.test(code?.data || '') ? code.data : null;
  } catch {
    return null;
  }
};

const qrView = (txn) => ({
  transactionId: txn.transactionId,
  qrCodeId: txn.metadata.qrCodeId,
  qrImage: txn.metadata.qrImageUrl,
  qrUpi: txn.metadata.qrUpi || null,
  amount: txn.amount,
  expiresAt: txn.metadata.expiresAt,
});

/**
 * Mints the QR the retailer scans.
 */
export const createTopupQr = async (req, res) => {
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

    const txn = await openQrTransaction(res, {
      prefix: 'TOP',
      type: 'WALLET_TOPUP',
      name: 'Wallet Top-up',
      amount,
      user: req.user,
    });
    if (!txn) return;
    return res.status(200).json({
      success: true,
      message: 'Scan the QR with any UPI app to add money.',
      data: qrView(txn),
    });
  } catch (error) {
    return qrError(res, error);
  }
};

/**
 * The one answer for a QR that could not be minted because of a throw.
 */
const qrError = (res, error) => {
  // A missing key is an operator error, not a provider outage, and the two
  // look identical in a log that only prints "failed". Say which it is: this
  // is the difference between checking the server's environment and opening a
  // ticket with Razorpay.
  const misconfigured = String(error?.message || '').includes('are not configured');
  if (misconfigured) {
    console.error(
      "[Topup] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing from this server's environment — no QR can be minted until they are set."
    );
  } else {
    console.error('Create Topup QR Error:', error?.response?.data || error?.message);
  }

  return res.status(misconfigured ? 503 : 500).json({
    success: false,
    message: misconfigured
      ? 'UPI payment is not configured on this server yet. Please contact support.'
      : 'Failed to generate the payment QR',
  });
};

/**
 * POST /api/auth/signup-fee/qr: the ₹99 onboarding charge QR a self-signed-up retailer pays
 * while awaiting verification. Under /api/auth because every other route
 * refuses a pending account.
 */
export const createSignupFeeQr = async (req, res) => {
  try {
    if (req.user.role !== 'retailer') {
      return res
        .status(403)
        .json({ success: false, message: 'Only a retailer pays the signup fee.' });
    }
    const retailer = await Retailer.findById(req.user.id).select('signupSource signupFeePaidAt');
    if (!retailer || retailer.signupSource !== 'self') {
      return res
        .status(400)
        .json({ success: false, message: 'No signup fee is due on this account.' });
    }
    if (retailer.signupFeePaidAt) {
      return res.status(200).json({ success: true, data: { status: 'SUCCESS' } });
    }

    // A retailer who paid and closed the app before the poll saw it, or who
    // asks again while a QR is still live, must not be handed a second QR:
    // paying both would take twice the charge. Settle or reuse the open one first
    // (a QR opened before the charge changed keeps its own amount, which the
    // screen reads from `amount`).
    // ponytail: two simultaneous requests can still mint two QRs; a unique
    // partial index on (userId, type: SIGNUP_FEE, status: PENDING) closes that.
    const open = await Transaction.find({
      userId: req.user.id,
      type: 'SIGNUP_FEE',
      status: 'PENDING',
    });
    for (const row of open) {
      const synced = await syncTopupTransaction(row);
      if (synced.status === 'SUCCESS') {
        return res.status(200).json({ success: true, data: { status: 'SUCCESS' } });
      }
      if (synced.status === 'PENDING') {
        return res
          .status(200)
          .json({ success: true, data: { status: 'PENDING', ...qrView(synced) } });
      }
    }

    const txn = await openQrTransaction(res, {
      prefix: 'SUF',
      type: 'SIGNUP_FEE',
      name: 'Signup Fee',
      amount: SIGNUP_FEE,
      user: req.user,
    });
    if (!txn) return;
    return res.status(200).json({ success: true, data: { status: 'PENDING', ...qrView(txn) } });
  } catch (error) {
    return qrError(res, error);
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
        {
          $set: { status: 'FAILED', 'metadata.failureReason': 'No QR was created for this top-up' },
        },
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
      type: { $in: QR_TYPES },
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
      return res
        .status(400)
        .json({ success: false, message: 'Payment carries no top-up reference' });
    }
    if (payment.status && payment.status !== 'captured') {
      return res.status(200).json({ success: true, credited: false, status: payment.status });
    }

    const txn = await Transaction.findOne({ transactionId: reference, type: { $in: QR_TYPES } });
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
