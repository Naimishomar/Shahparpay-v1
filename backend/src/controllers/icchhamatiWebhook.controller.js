import Transaction from '../models/transaction.model.js';
import { collectionWebhook } from './collect.controller.js';

// Icchhamati's panel holds exactly ONE callback URL for the whole account
// (Settings -> Callback URL), so QR collection notifications and PAN webhooks
// both land here and are told apart by `type` in the body.
//
// The PAN webhooks authenticate with the account's own mid/mkey in the headers
// rather than the shared secret the collection notifications carry, so the two
// families are checked separately instead of behind one guard.

// Their documented reply shape. Anything else and they keep retrying.
const ack = (res, message) => res.status(200).json({ status: 1, message });

const header = (req, ...names) => {
  for (const name of names) {
    const value = req.get(name);
    if (value) return String(value).trim();
  }
  return '';
};

// Sent as both `mid`/`mkey` and `x-mid`/`x-mkey`; either pair is accepted.
export const isAuthorisedPanWebhook = (req) => {
  const mid = String(process.env.ICCHHAMATI_MID || '').trim();
  const mkey = String(process.env.ICCHHAMATI_MKEY || '').trim();
  if (!mid || !mkey) {
    console.error(
      '[Icchhamati Webhook] ICCHHAMATI_MID / ICCHHAMATI_MKEY are not set — refusing the callback.'
    );
    return false;
  }
  return header(req, 'mid', 'x-mid') === mid && header(req, 'mkey', 'x-mkey') === mkey;
};

// The PSA registration row these webhooks report on. Newest wins: a retailer
// whose first registration was rejected re-registers under the same PAN.
const findPsaTransaction = (query) =>
  Transaction.findOne({ type: 'PAN_CARD', ...query }).sort({ createdAt: -1 });

/** updateAgentStatus — admin approved or rejected the PSA agent registration. */
const updateAgentStatus = async (data) => {
  const panNo = String(data.pan_no || '').trim().toUpperCase();
  if (!panNo) return 'pan_no is required';

  const transaction = await findPsaTransaction({ 'metadata.pan_no': panNo });
  if (!transaction) return `No PSA registration found for ${panNo}`;

  transaction.status = Number(data.status) === 1 ? 'APPROVED' : 'REJECTED';
  transaction.metadata = { ...transaction.metadata, agent_remarks: data.remarks };
  transaction.markModified('metadata');
  await transaction.save();
  return null;
};

/**
 * PanFundStatus — admin approved or rejected a PAN fund request.
 *
 * Recorded only. Crediting a wallet from this would need the amount, which the
 * payload does not carry, and an idempotency key, which it also does not carry
 * — so a retry would pay twice. Funds still move through the normal fund
 * request flow; this just mirrors the decision onto the PSA row.
 */
const panFundStatus = async (data) => {
  const panNo = String(data.pan_no || '').trim().toUpperCase();
  if (!panNo) return 'pan_no is required';

  const transaction = await findPsaTransaction({ 'metadata.pan_no': panNo });
  if (!transaction) return `No PSA registration found for ${panNo}`;

  transaction.metadata = {
    ...transaction.metadata,
    pan_fund_status: Number(data.status) === 1 ? 'APPROVED' : 'REJECTED',
    pan_fund_remarks: data.remarks,
  };
  transaction.markModified('metadata');
  await transaction.save();
  return null;
};

/**
 * PanAplication (their spelling) — a row in the PAN application report was
 * imported or updated.
 *
 * `application_status` is their own vocabulary (PROCESSED_DISPATCHED and so on)
 * and does not map onto the Transaction status enum, so the row is stored
 * as-is under its application number and the transaction status is left alone.
 */
const panApplication = async (data) => {
  const vleId = String(data.vle_id || '').trim();
  const applicationNo = String(data.application_no || '').trim();
  if (!vleId || !applicationNo) return 'vle_id and application_no are required';

  const transaction = await findPsaTransaction({ 'metadata.psa_id': vleId });
  if (!transaction) return `No PSA registration found for ${vleId}`;

  transaction.metadata = {
    ...transaction.metadata,
    applications: { ...(transaction.metadata?.applications || {}), [applicationNo]: data },
  };
  transaction.markModified('metadata');
  await transaction.save();
  return null;
};

export const PAN_WEBHOOK_HANDLERS = {
  updateAgentStatus,
  PanFundStatus: panFundStatus,
  PanAplication: panApplication,
};

export const icchhamatiWebhook = async (req, res) => {
  const type = req.body?.type;
  const panHandler = PAN_WEBHOOK_HANDLERS[type];

  // Not a PAN webhook: it is a QR collection notification, which carries the
  // shared secret and credits a wallet. Left entirely to its own handler.
  if (!panHandler) {
    if (type) console.warn('[Icchhamati Webhook] Unknown type, treating as collection:', type);
    return collectionWebhook(req, res);
  }

  if (!isAuthorisedPanWebhook(req)) {
    return res.status(401).json({ status: 0, message: 'Invalid mid/mkey' });
  }

  try {
    const problem = await panHandler(req.body?.data || {});
    if (problem) {
      // Acknowledged rather than failed: retrying will not conjure the missing
      // row, and an unacknowledged webhook is retried indefinitely.
      console.error(`[Icchhamati Webhook] ${type}: ${problem}`);
      return ack(res, problem);
    }
    return ack(res, 'Webhook processed');
  } catch (error) {
    console.error(`[Icchhamati Webhook] ${type} failed:`, error);
    return res.status(500).json({ status: 0, message: 'Internal server error' });
  }
};
