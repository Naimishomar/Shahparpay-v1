/**
 * Fixed-window rate limiter keyed by client IP and route.
 * ponytail: in-memory, so limits are per process; move to Redis if the API ever runs on more than one instance.
 */
export const rateLimit = ({ windowMs, max, message = 'Too many attempts. Please try again later.' }) => {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
};

// Password and OTP guesses: 10 per 15 minutes per IP per endpoint.
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
