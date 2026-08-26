import express from 'express';
import {
  getOperators,
  browsePlans,
  fetchDthInfo,
  doRecharge,
  getHistory,
  checkBalance,
  checkStatus,
  fetchBill,
} from '../controllers/recharge.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Every recharge route touches a wallet or a user's own history: none of them
// may be reachable unauthenticated.
router.use(authMiddlewares);

router.get('/operators/:type', getOperators);
router.post('/browse-plan', browsePlans);
router.post('/dth-info', fetchDthInfo);
router.post('/fetch-bill', fetchBill);
router.post('/do-recharge', doRecharge);
router.get('/history', getHistory);
router.get('/balance', checkBalance);
router.get('/status/:transid', checkStatus);

export default router;
