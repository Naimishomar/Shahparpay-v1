/**
 * Lets the browser reuse a GET response for `seconds` instead of calling the
 * API again. Only for data that is the same for everyone and rarely changes
 * (bank list, operators, circles, rate card). `private` keeps shared proxies out.
 */
export const cacheFor = (seconds) => (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', `private, max-age=${seconds}`);
  next();
};
