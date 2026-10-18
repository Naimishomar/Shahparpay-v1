import crypto from 'crypto';

/**
 * Shared-secret check for provider callbacks that cannot carry our JWT.
 * The secret comes from `envName`; when it is unset every callback is refused
 * rather than trusted. Supplied as `?key=` or the `x-callback-key` header.
 */
export const hasCallbackKey = (req, envName) => {
  const expected = process.env[envName];
  if (!expected) {
    console.error(`[Callback] ${envName} is not set — refusing the callback.`);
    return false;
  }
  const supplied = req.query?.key || req.headers['x-callback-key'];
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
