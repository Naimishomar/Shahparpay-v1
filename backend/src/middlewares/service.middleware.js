import { SERVICES } from '../utils/services.js';

/**
 * Refuses a retailer's request for a service their distributor has switched
 * off. Runs after authMiddlewares, which has already loaded the retailer.
 *
 * `service` is a key, or a function of the request for routers that serve two
 * services (recharge vs BBPS). Reads (GET) pass so history stays viewable.
 */
export const requireService = (service) => (req, res, next) => {
  if (req.method === 'GET' || req.user?.role !== 'retailer') return next();
  const key = typeof service === 'function' ? service(req) : service;
  if (key && req.user.disabledServices?.includes(key)) {
    return res.status(403).json({
      success: false,
      code: 'SERVICE_DISABLED',
      message: `${SERVICES[key]} is not enabled for your account. Please contact your distributor.`,
    });
  }
  return next();
};
