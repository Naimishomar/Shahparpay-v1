import jwt from 'jsonwebtoken';
import Retailer from '../models/users/retailer.model.js';
import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import { generatePaySprintToken } from '../utils/paysprint.util.js';

// PaySprint calls these endpoints server-to-server, so they cannot sit behind
// the retailer JWT middleware. The shared secret below is the only thing
// standing between the public internet and a wallet debit, so it is required:
// with PAYSPRINT_CALLBACK_KEY unset every callback is refused rather than
// silently trusted. Register the URL with PaySprint as
//   https://<host>/api/aeps/onboard/callback/transaction?key=<PAYSPRINT_CALLBACK_KEY>
export const isAuthorisedCallback = (req) => {
  const expected = process.env.PAYSPRINT_CALLBACK_KEY;
  if (!expected) {
    console.error(
      '[Onboard Callback] PAYSPRINT_CALLBACK_KEY is not set — refusing the callback. ' +
        'Set it and register the callback URL with that key in the query string.'
    );
    return false;
  }
  const supplied = req.query?.key || req.headers['x-callback-key'];
  return typeof supplied === 'string' && supplied === expected;
};

// PaySprint mirrors `param` into `param_enc` as a JWT signed with our API key.
// When it is present and parses, it is the authoritative copy: the plaintext
// `param` travels alongside it and must never be the one we bill against.
export const authoritativeParam = (body) => {
  const enc = body?.param_enc;
  if (typeof enc !== 'string' || enc.split('.').length !== 3) return body?.param;
  try {
    const decoded = jwt.verify(enc, process.env.PAYSPRINT_JWT_KEY, { algorithms: ['HS256'] });
    return decoded?.param || decoded;
  } catch (error) {
    console.error('[Onboard Callback] param_enc failed verification:', error.message);
    return null;
  }
};

// PaySprint's documented reply shape. Anything else and it keeps retrying.
const ack = (res, status, message) => res.status(200).json({ status, message });

/**
 * MERCHANT_ONBOARDING — PaySprint has charged us a one-time verification fee
 * for this merchant and expects us to pass it on to the retailer.
 *
 * The ledger row is written before the debit and keyed on PaySprint's
 * request_id, so a retried callback collides on the unique transactionId and
 * is acknowledged without charging twice.
 */
export const onboardTransactionCallback = async (req, res) => {
  try {
    if (!isAuthorisedCallback(req)) return ack(res, 400, 'Unauthorized callback');

    const { event } = req.body || {};
    const param = authoritativeParam(req.body);
    if (event !== 'MERCHANT_ONBOARDING' || !param) {
      return ack(res, 400, 'Unsupported event');
    }

    const { merchant_id: merchantId, request_id: requestId, amount } = param;
    const charge = Number(amount);
    if (!merchantId || !requestId || !Number.isFinite(charge) || charge <= 0) {
      return ack(res, 400, 'merchant_id, request_id and a positive amount are required');
    }

    const retailer = await Retailer.findOne({ retailerId: merchantId });
    if (!retailer) return ack(res, 400, `Unknown merchant ${merchantId}`);

    const transactionId = `ONBRD${requestId}`;
    let ledger;
    try {
      ledger = await Transaction.create({
        transactionId,
        userId: retailer._id,
        type: 'MERCHANT_ONBOARDING_CHARGE',
        amount: charge,
        status: 'PROCESSING',
        metadata: { requestId, partnerId: param.partner_id, merchantId },
      });
    } catch (error) {
      // Duplicate transactionId means PaySprint is retrying a callback we
      // already handled. Acknowledge it instead of charging the retailer again.
      if (error?.code === 11000) return ack(res, 200, 'Already processed');
      throw error;
    }

    // Debited straight against the wallet rather than through
    // updateWalletAtomically, which would log a second transaction row and
    // double-count the charge in every report that sums by type.
    const debited = await MainWallet.findOneAndUpdate(
      { userId: retailer._id, balance: { $gte: charge } },
      { $inc: { balance: -charge } },
      { returnDocument: 'after' }
    );

    if (!debited) {
      ledger.status = 'FAILED';
      ledger.metadata = { ...ledger.metadata, error: 'Insufficient MAIN wallet balance' };
      await ledger.save();
      console.error(`[Onboard Callback] ₹${charge} charge failed for ${merchantId}: no balance`);
      return ack(res, 400, 'Insufficient balance for the onboarding charge');
    }

    ledger.status = 'SUCCESS';
    ledger.metadata = {
      ...ledger.metadata,
      note: `PaySprint merchant onboarding charge (₹${charge})`,
    };
    await ledger.save();
    return ack(res, 200, 'Transaction completed successfully');
  } catch (error) {
    console.error('[Onboard Callback] Error:', error);
    return ack(res, 400, 'Transaction failed');
  }
};

// `param.bank` is flat: { Bank6: 'Active', Bank6_remarks: '...', Bank6_dmt: ... }.
// Only the bare BankN keys carry the onboarding status we act on.
const reportedPipes = (bank = {}) =>
  Object.entries(bank)
    .filter(([key]) => /^bank\d+$/i.test(key))
    .map(([key, value]) => [key.toLowerCase(), String(value).toLowerCase() === 'active']);

// A callback only reports the banks it has news about, so the pipes it does not
// mention must survive untouched — overwriting the list with just this
// callback's actives would silently switch off a pipe the retailer is using.
export const mergeActivePipes = (current = [], bank = {}) => {
  const merged = new Set(current);
  for (const [pipe, active] of reportedPipes(bank)) {
    if (active) merged.add(pipe);
    else merged.delete(pipe);
  }
  return [...merged];
};

/**
 * MERCHANT_STATUS_ONBOARD — the bank finished (or refused) onboarding. Mirrors
 * the per-pipe result onto the retailer so the app does not have to wait for
 * the next live status poll to unlock a pipe.
 */
export const onboardStatusCallback = async (req, res) => {
  try {
    if (!isAuthorisedCallback(req)) return ack(res, 400, 'Unauthorized callback');

    const { event } = req.body || {};
    const param = authoritativeParam(req.body);
    if (event !== 'MERCHANT_STATUS_ONBOARD' || !param) {
      return ack(res, 400, 'Unsupported event');
    }

    const merchantcode = param.merchantcode;
    if (!merchantcode) return ack(res, 400, 'merchantcode is required');

    const retailer = await Retailer.findOne({ retailerId: merchantcode });
    if (!retailer) return ack(res, 400, `Unknown merchant ${merchantcode}`);

    const activePipes = mergeActivePipes(retailer.activeAepsPipes, param.bank);
    retailer.activeAepsPipes = activePipes;
    // A pipe only reaches Active after the merchant's eKYC cleared on it.
    if (activePipes.length) retailer.isMerchantKycComplete = true;
    await retailer.save();

    console.log(
      `[Onboard Status Callback] ${merchantcode}: ${param.status} — active pipes:`,
      activePipes.join(', ') || 'none'
    );
    return ack(res, 200, 'Transaction completed successfully');
  } catch (error) {
    console.error('[Onboard Status Callback] Error:', error);
    return ack(res, 400, 'Transaction failed');
  }
};

/**
 * Launch parameters for PaySprint's Android onboarding SDK (HostActivity).
 * The app supplies lat/lng itself; everything here is merchant identity plus
 * the partner credentials, which must never be compiled into the APK.
 */
export const getOnboardSdkParams = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const jwtKeyBase64 = process.env.PAYSPRINT_JWT_KEY;
    if (!jwtKeyBase64) {
      return res.status(500).json({ success: false, message: 'PaySprint key is not configured' });
    }
    // Same derivation generatePaySprintToken uses for the token's partnerId claim.
    const partnerId =
      process.env.PAYSPRINT_PARTNER_ID ||
      Buffer.from(jwtKeyBase64, 'base64').toString('utf8').substring(0, 8);

    return res.status(200).json({
      success: true,
      data: {
        pId: partnerId,
        pApiKey: generatePaySprintToken(),
        mCode: retailer.retailerId,
        mobile: String(retailer.contactNumber || ''),
        email: retailer.email,
        firm: retailer.businessName || retailer.name,
        pipe: String(req.query.pipe || 'bank2').toLowerCase(),
      },
    });
  } catch (error) {
    console.error('[Onboard SDK Params] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
