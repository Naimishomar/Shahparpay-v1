// Identity, bank and biometric fields: a provider response echoes them back
// (draft-data carries the merchant's Aadhaar, PAN, phone, email and account).
const SENSITIVE_KEYS =
  /mid|mkey|token|key|secret|password|pin|otp|aadhaar|aadhar|account|ifsc|authorization|pan|mobile|phone|email|xml|pid|card/i;

const mask = (value) => {
  const text = String(value ?? '');
  // A one-character value is a flag (phone_verified_at: 1), never a secret.
  if (text.length <= 1 || typeof value === 'boolean') return value;
  if (text.length <= 4) return '***';
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
};

export const redact = (value, key = '') => {
  if (SENSITIVE_KEYS.test(key)) return mask(value);
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  }
  return value;
};

/** Longest provider response logged in full; bank and biller lists run far past it. */
const RESPONSE_LOG_CHARS = 2000;

/**
 * A provider's answer as it may go in a log: redacted, and clipped when long,
 * so the message and status can be read without dumping a whole biller list.
 */
export const loggableResponse = (data) => {
  if (data === undefined || data === null || data === '') return null;
  const safe = redact(data);
  const text = typeof safe === 'string' ? safe : JSON.stringify(safe);
  if (text.length <= RESPONSE_LOG_CHARS) return safe;
  return { truncated: true, chars: text.length, preview: text.slice(0, RESPONSE_LOG_CHARS) };
};

export const logIntegration = (event, fields = {}) => {
  console.log(JSON.stringify({ log: 'integration', event, at: new Date().toISOString(), ...redact(fields) }));
};

export const logIntegrationError = (event, error, fields = {}) => {
  logIntegration(event, {
    ...fields,
    error: {
      message: error?.message || String(error),
      code: error?.code || null,
      providerResponse: redact(error?.response?.data || null),
    },
  });
};
