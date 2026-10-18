/**
 * Refuses request bodies that carry MongoDB operators.
 * Controllers pass body fields straight into filters (`findOne({ email })`), so
 * `{"email":{"$ne":null}}` would match someone else's record. No legitimate
 * client or provider callback sends a key starting with `$`.
 */
const hasOperatorKey = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$')) return true;
    if (hasOperatorKey(value[key], depth + 1)) return true;
  }
  return false;
};

export const rejectMongoOperators = (req, res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query) || hasOperatorKey(req.params)) {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  return next();
};
