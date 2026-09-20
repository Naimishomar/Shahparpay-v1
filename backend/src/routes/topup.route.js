import express from 'express';
import {
  createTopupQr,
  getTopupStatus,
  getTopupHistory,
  topupWebhook,
} from '../controllers/topup.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Razorpay posts here. Unauthenticated by necessity: the handler verifies the
// HMAC signature over the raw body instead.
router.post('/webhook', topupWebhook);

// Everything below mints a payment target against a wallet or reads it: none
// may be reachable unauthenticated.
router.use(authMiddlewares);

router.post('/qr', createTopupQr);
router.get('/history', getTopupHistory);
router.get('/status/:transactionId', getTopupStatus);

export default router;
