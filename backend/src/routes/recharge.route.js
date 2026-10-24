import express from 'express';
import {
  getOperators,
  getCircles,
  getBillCategories,
  browsePlans,
  fetchDthInfo,
  doRecharge,
  getHistory,
  checkStatus,
  fetchBill,
} from '../controllers/recharge.controller.js';
import { cacheFor } from '../middlewares/cache.middleware.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';
import { isBillType } from '../utils/icchhamati.util.js';

const router = express.Router();

// Every recharge route touches a wallet or a user's own history: none of them
// may be reachable unauthenticated.
router.use(authMiddlewares);
// One router, two services: a bill payment is BBPS, anything else a recharge.
router.use(
  requireService((req) => {
    if (req.path === '/fetch-bill') return 'bbps';
    if (req.path === '/do-recharge') return isBillType(req.body?.type) ? 'bbps' : 'recharge';
    return 'recharge';
  })
);

router.get('/circles', cacheFor(24 * 3600), getCircles);
router.get('/bill-categories', cacheFor(6 * 3600), getBillCategories);
router.get('/operators/:type', cacheFor(6 * 3600), getOperators);
router.post('/browse-plan', browsePlans);
// PAYSPRINT-DISABLED: DTH customer details came from PaySprint's HLR lookup.
// Icchhamati has no equivalent (fetch-bill answers "Invalid Service Provider"
// for DTH billers); DTH recharge itself runs on Icchhamati.
// router.post('/dth-info', fetchDthInfo);
router.post('/fetch-bill', fetchBill);
router.post('/do-recharge', doRecharge);
router.get('/history', getHistory);
router.get('/status/:transid', checkStatus);

export default router;
