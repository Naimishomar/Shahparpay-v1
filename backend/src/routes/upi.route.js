import express from 'express';
import { generateToken, getTxnStatus, webhook, merchantStatus } from '../controllers/upi.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/cashout/merchant-status', authMiddlewares, merchantStatus);
router.post('/cashout/generate-token', authMiddlewares, generateToken);
router.post('/cashout/status', authMiddlewares, getTxnStatus);
router.post('/webhook', webhook);

export default router;
