import axios from 'axios';
import { logIntegration, logIntegrationError } from './integrationLogger.js';

/**
 * Icchhamati Data Service ("Banking Service") API.
 *
 * One host, https://icchhamatidataservice.com, serves every service: recharge,
 * BBPS, payment gateway, virtual-account QR and money transfer. Partner calls
 * authenticate with the merchant id and key as plain headers — `mid`/`mkey`,
 * which the gateway also accepts as `x-mid`/`x-mkey`. There is no token to mint
 * and nothing to encrypt, so a call is just a JSON POST with those two headers.
 *
 * Auth failures are distinguishable and worth recognising in logs:
 *   no headers   -> {"status":0,"message":"No token or MID\/MKEY provided"}
 *   wrong values -> {"status":0,"message":"Invalid MID or MKEY"}
 */
const getBase = () => process.env.ICCHHAMATI_BASE_URL || 'https://icchhamatidataservice.com';

const getHeaders = () => {
  const mid = process.env.ICCHHAMATI_MID;
  const mkey = process.env.ICCHHAMATI_MKEY;
  if (!mid || !mkey) {
    throw new Error('ICCHHAMATI_MID / ICCHHAMATI_MKEY are not configured');
  }
  return {
    mid,
    mkey,
    'x-mid': mid,
    'x-mkey': mkey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};

/**
 * Operational refusals — insufficient provider float, biller down, a validation
 * complaint — come back with a non-2xx status and a message that explains why.
 * Letting axios throw on those loses the message in a catch and leaves the
 * retailer with a generic 500, so every call reads the body instead.
 */
export const icchhamatiPost = async (path, body = {}) => {
  const startedAt = Date.now();
  try {
    const response = await axios.post(`${getBase()}${path}`, body, {
      headers: getHeaders(), validateStatus: () => true, timeout: 60000,
    });
    logIntegration('provider_response', { provider: 'icchhamati', method: 'POST', path, httpStatus: response.status, providerStatus: response.data?.status, durationMs: Date.now() - startedAt, transactionId: body?.transaction_id || body?.txnid || null });
    // Non-enumerable, so it stays out of anything that spreads or stores the body.
    if (response.data && typeof response.data === 'object') {
      Object.defineProperty(response.data, 'httpStatus', { value: response.status });
    }
    return response.data;
  } catch (error) {
    logIntegrationError('provider_request_error', error, { provider: 'icchhamati', method: 'POST', path, durationMs: Date.now() - startedAt, transactionId: body?.transaction_id || body?.txnid || null });
    throw error;
  }
};

/** Multipart POST (file uploads). The runtime sets the boundary, so no Content-Type. */
export const icchhamatiPostForm = async (path, form) => {
  const startedAt = Date.now();
  const { 'Content-Type': _json, ...headers } = getHeaders();
  try {
    const response = await axios.post(`${getBase()}${path}`, form, {
      headers, validateStatus: () => true, timeout: 120000, maxBodyLength: Infinity,
    });
    logIntegration('provider_response', { provider: 'icchhamati', method: 'POST', path, httpStatus: response.status, providerStatus: response.data?.status, durationMs: Date.now() - startedAt });
    return response.data;
  } catch (error) {
    logIntegrationError('provider_request_error', error, { provider: 'icchhamati', method: 'POST', path, durationMs: Date.now() - startedAt });
    throw error;
  }
};

/** Deleting a beneficiary carries its OTP in the body, so DELETE needs one too. */
export const icchhamatiDelete = async (path, body = {}) => {
  const startedAt = Date.now();
  try {
    const response = await axios.delete(`${getBase()}${path}`, { headers: getHeaders(), data: body, validateStatus: () => true, timeout: 60000 });
    logIntegration('provider_response', { provider: 'icchhamati', method: 'DELETE', path, httpStatus: response.status, providerStatus: response.data?.status, durationMs: Date.now() - startedAt });
    return response.data;
  } catch (error) {
    logIntegrationError('provider_request_error', error, { provider: 'icchhamati', method: 'DELETE', path, durationMs: Date.now() - startedAt });
    throw error;
  }
};

export const icchhamatiGet = async (path, params = {}) => {
  const startedAt = Date.now();
  try {
    const response = await axios.get(`${getBase()}${path}`, { headers: getHeaders(), params, validateStatus: () => true, timeout: 60000 });
    logIntegration('provider_response', { provider: 'icchhamati', method: 'GET', path, httpStatus: response.status, providerStatus: response.data?.status, durationMs: Date.now() - startedAt });
    return response.data;
  } catch (error) {
    logIntegrationError('provider_request_error', error, { provider: 'icchhamati', method: 'GET', path, durationMs: Date.now() - startedAt });
    throw error;
  }
};

/**
 * `status` is 1 for accepted, 2 for accepted-but-not-settled and 0 for refused,
 * but the same gateway also answers some read endpoints with the string
 * "success". Both spellings mean the same thing, so both are accepted.
 */
export const isOk = (data) => {
  const status = data?.status;
  return status === 1 || status === '1' || status === true || status === 'success';
};

/**
 * A recharge or payout status, as our wallet understands it.
 *
 * PENDING is not FAILED: the money has left our wallet and the provider has not
 * yet said where it landed, so those funds stay locked until it does. Refunding
 * on a pending answer would hand back money for a recharge still being
 * delivered.
 */
export const normaliseStatus = (status) => {
  const value = String(status ?? '')
    .trim()
    .toUpperCase();
  if (['1', 'SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED', 'CAPTURED', 'SETTLED', 'TRUE'].includes(value)) return 'SUCCESS';
  if (value === '2' || value === 'PENDING' || value === 'PROCESSING' || value === 'INITIATED') {
    return 'PENDING';
  }
  return 'FAILED';
};

/**
 * Strip any markup a provider message carries and collapse the padding it
 * leaves; these strings are shown to a retailer as a toast, tags and all.
 */
export const cleanProviderMessage = (raw) =>
  String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    // Biller templates leak an unfilled "{ParamKey}" placeholder.
    .replace(/\{ParamKey\}\s*\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The message a retailer should see for this response.
 *
 * The gateway is a Laravel app that answers its own faults with an unhandled
 * exception dump — message, class name, source file, full stack trace. At the
 * time of writing every endpoint returns one:
 *
 *   {"status":0,"message":"Class \"App\\Http\\Middleware\\Subscription\" not
 *    found","file":"...\/app\/Http\/Middleware\/ApiTokenAuth.php","line":270}
 *
 * That is the provider's own deployment fault, it tells a retailer nothing, and
 * it leaks their server paths through our UI. So a response carrying an
 * exception is logged in full and shown as the caller's fallback instead.
 */
export const providerMessage = (data, fallback) => {
  if (data?.exception || data?.trace || data?.file) {
    console.error('Icchhamati provider fault:', data?.message, data?.file, data?.line);
    return fallback;
  }
  return cleanProviderMessage(data?.message) || fallback;
};

/**
 * The gateway fell over while handling the call: an HTTP 5xx, or its Laravel
 * "An unexpected error occurred: ..." answer. It can crash after the operator
 * has already been paid (seen: 24 s, then 'Attempt to read property "mid" on
 * null', and the recharge was delivered), so the outcome is unknown, not failed.
 */
export const providerCrashed = (data) =>
  Number(data?.httpStatus) >= 500 ||
  Boolean(data?.exception) ||
  /^An unexpected error occurred/i.test(String(data?.message ?? ''));

/**
 * `type` on the recharge and bill endpoints: 1 prepaid, 2 DTH, 3 bill payment.
 * Anything with a bill behind it — postpaid mobile included — is a 3 and goes
 * through /api/v2/bill-payment, which is the only path that can fetch a bill
 * before the wallet is debited.
 */
export const RECHARGE_TYPE = { prepaid: 1, dth: 2 };

export const rechargeTypeCode = (type) => RECHARGE_TYPE[String(type || '').toLowerCase()] || 3;

export const isBillType = (type) => rechargeTypeCode(type) === 3;

/**
 * Operator lists come from two different places. Prepaid, postpaid and DTH have
 * their own operator registry; every other category is a BBPS biller and comes
 * out of the biller registry, keyed by the provider's own category name.
 *
 * These three names are the only ones the operator registry answers to. It was
 * asked for "MobilePrepaid" and "MobilePostpaid" for a long time, and that
 * never looked like a refusal: both are accepted and both answer `status: 1`,
 * but "MobilePrepaid" comes back with an empty list and "MobilePostpaid" with
 * one operator out of four.
 */
export const OPERATOR_CATEGORY = {
  prepaid: 'Prepaid',
  postpaid: 'Postpaid',
  dth: 'DTH',
};

/**
 * A client transaction id. Unique per call: transactionId is a unique index, so
 * two recharges landing in the same millisecond must not also draw the same
 * suffix.
 */
export const makeReferenceId = (prefix = 'SPP') => {
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  return `${prefix}${Date.now()}${suffix}`;
};

/**
 * Asks the provider where a money transfer ended up.
 *
 * Returns PROCESSING for anything short of a definite answer, including a
 * payout the listing does not know about yet: refunding on a non-answer hands
 * a retailer back money that may already have reached the beneficiary.
 */
export const fetchPayoutStatus = async (transactionId) => {
  try {
    // There is no per-transaction payout status endpoint; the payout listing is
    // the only place a settled state is published, so ours is looked up by the
    // client reference we sent with it.
    const data = await icchhamatiGet('/api/v2/payouts', {
      search: transactionId,
      per_page: 50,
    });
    if (!isOk(data)) return { finalStatus: 'PROCESSING', data };

    const rows = data.data?.data || data.data || [];
    // The search is free text, so a row is only ours if a reference on it is an
    // exact match. Settling a transfer against someone else's row would refund
    // money that is on its way to a beneficiary.
    const mine = rows.find((row) =>
      [row.transaction_id, row.client_ref_id, row.reference_id, row.txnid, row.order_id]
        .filter(Boolean)
        .some((ref) => String(ref) === String(transactionId))
    );
    if (!mine) return { finalStatus: 'PROCESSING', data };

    const status = normaliseStatus(mine.status);
    return { finalStatus: status === 'PENDING' ? 'PROCESSING' : status, data: mine };
  } catch (error) {
    console.error(`Icchhamati payout status check failed for ${transactionId}:`, error.message);
    return { finalStatus: 'PROCESSING', data: null };
  }
};

/**
 * Asks the provider where a recharge or bill payment ended up.
 *
 * Returns PROCESSING for anything that is not a definite answer — still
 * pending, refused, gateway down — so an unanswered check leaves the funds
 * locked for the next run rather than refunding a transaction that may yet be
 * delivered.
 */
export const fetchRechargeStatus = async (txnid) => {
  try {
    // /api/v2/bill-status answers for recharges as well as bills, and it is the
    // only status route the gateway actually serves. The published
    // /api/v2/recharge-status is not routed at all: a POST is refused with
    // "The POST method is not supported for route api/v2/recharge-status", and
    // a GET falls through to their single-page app and answers with HTML. Every
    // recharge queried there came back PROCESSING, so the debit stayed locked
    // and the commission was never credited.
    const data = await icchhamatiPost('/api/v2/bill-status', { txnid });
    if (!isOk(data) && normaliseStatus(data?.status) !== 'PENDING') {
      // The gateway loads the recharge row and then crashes on its own
      // 'Attempt to read property "mid" on null', answering status 0 with the
      // row still attached. That row is the real outcome, so a row for this
      // txnid with a definite status settles it; anything else stays pending.
      const row = data?.data;
      const rowStatus = String(row?.status ?? '').trim().toUpperCase();
      if (row && [row.txnid, row.oid].map(String).includes(String(txnid))) {
        if (rowStatus === 'SUCCESS') return { finalStatus: 'SUCCESS', data };
        if (['FAILED', 'FAILURE', 'FAIL'].includes(rowStatus)) return { finalStatus: 'FAILED', data };
      }
      return { finalStatus: 'PROCESSING', data };
    }

    // A status check answers with the transaction's own status where it has one,
    // and falls back to the envelope status otherwise.
    const status = normaliseStatus(data?.data?.status ?? data?.status);
    return { finalStatus: status === 'PENDING' ? 'PROCESSING' : status, data };
  } catch (error) {
    console.error(`Icchhamati status check failed for ${txnid}:`, error.message);
    return { finalStatus: 'PROCESSING', data: null };
  }
};
