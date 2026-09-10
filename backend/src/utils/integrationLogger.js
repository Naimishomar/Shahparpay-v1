const SENSITIVE_KEYS = /mid|mkey|token|key|secret|password|pin|otp|aadhaar|account|ifsc|authorization/i;

const mask = (value) => {
  const text = String(value ?? '');
  if (!text) return text;
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
