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
  bharatPaysCallback,
} from '../controllers/recharge.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// BharatPays posts this one; it carries the provider's shared secret instead of a
// user token, so it has to be mounted above the auth middleware.
router.post('/callback/bharatpays', bharatPaysCallback);

// Every other recharge route touches a wallet or a user's own history: none of
// them may be reachable unauthenticated.
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
