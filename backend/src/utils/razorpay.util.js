import axios from 'axios';
import crypto from 'node:crypto';
import { logIntegration, logIntegrationError } from './integrationLogger.js';

/**
 * Razorpay, used only for retailer wallet top-ups.
 *
 * A retailer asks to add money, we mint a single-use UPI QR for that exact
 * amount, and Razorpay tells us over a signed webhook when it is paid. The
 * retailer id travels in the QR's `notes`, so the notification carries back
 * whose wallet to credit — no virtual account has to be provisioned per
 * retailer, which is what blocks the Icchhamati QR route.
 *
 * Auth is HTTP Basic with the key id and secret; nothing to mint, nothing to
 * encrypt.
 */
const BASE_URL = 'https://api.razorpay.com/v1';

const getAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured');
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
};

/**
 * Razorpay reports refusals as 4xx with `{error: {code, description}}`. Letting
 * axios throw on those buries the description in a catch, so the body is read
 * either way and the caller decides.
 */
const call = async (method, path, { body, params } = {}) => {
  const startedAt = Date.now();
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data: body,
      params,
      headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 30000,
    });
    const ok = response.status >= 200 && response.status < 300;
    logIntegration('provider_response', {
      provider: 'razorpay',
      method,
      path,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      // Razorpay puts the only useful part of a refusal in `error`. Logging the
      // status alone says a call failed but never why, which is the difference
      // between "their outage" and "this product is not enabled on the account".
      ...(ok
        ? {}
        : {
            errorCode: response.data?.error?.code ?? null,
            errorDescription: response.data?.error?.description ?? null,
            errorReason: response.data?.error?.reason ?? null,
            errorSource: response.data?.error?.source ?? null,
            errorField: response.data?.error?.field ?? null,
          }),
    });
    return { ok, data: response.data };
  } catch (error) {
    logIntegrationError('provider_request_error', error, {
      provider: 'razorpay',
      method,
      path,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
};

export const razorpayPost = (path, body) => call('post', path, { body });
export const razorpayGet = (path, params) => call('get', path, { params });

/** The message a retailer should see for a refused Razorpay call. */
export const razorpayMessage = (data, fallback) =>
  String(data?.error?.description || '').trim() || fallback;

/**
 * Verifies a webhook came from Razorpay.
 *
 * The signature is an HMAC-SHA256 of the *raw* request body keyed by the
 * webhook secret, so it must be checked against the exact bytes received —
 * re-serialising the parsed object changes key order and whitespace and every
 * genuine call would fail. `timingSafeEqual` because a plain `===` on a
 * signature leaks how much of a guess was right.
 */
export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = String(signature).trim();
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
};

/** Razorpay works in paise. Rupees never reach it and never leave it. */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const toRupees = (paise) => Math.round(Number(paise)) / 100;
