import { SERVICES } from '../utils/services.js';
import Setting from '../models/setting.model.js';

// Services the admin has switched off for everyone (provider down, maintenance).
// Kept in memory so the check stays synchronous: loaded at startup, replaced on every write.
// ponytail: per process; a second API instance would need to re-read on change.
let platformOff = [];
export const getPlatformDisabled = () => platformOff;
export const setPlatformDisabled = (list) => { platformOff = list; };
export const loadPlatformDisabled = async () => {
  const doc = await Setting.findOne({ key: 'disabledServices' }).lean();
  platformOff = Array.isArray(doc?.value) ? doc.value : [];
};

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
  if (key && platformOff.includes(key)) {
    return res.status(503).json({
      success: false,
      code: 'SERVICE_PAUSED',
      message: `${SERVICES[key]} is temporarily unavailable. Please try again later.`,
    });
  }
  if (key && req.user.disabledServices?.includes(key)) {
    return res.status(403).json({
      success: false,
      code: 'SERVICE_DISABLED',
      message: `${SERVICES[key]} is not enabled for your account. Please contact your distributor.`,
    });
  }
  return next();
};
