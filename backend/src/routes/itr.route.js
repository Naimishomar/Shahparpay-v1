import express from 'express';
import { launchItrFiling, checkAgentWallet, itrWebhook, getItrHistory } from '../controllers/itr.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Authenticated routes for retailers
router.post('/launch', authMiddlewares, launchItrFiling);
router.get('/history', authMiddlewares, getItrHistory);

// Public callback routes from eSevaTech
router.all('/check-agent-wallet', checkAgentWallet);
router.post('/webhook', itrWebhook);
// eSevaTech appends /check-agent-wallet to the webhook URL for wallet checks
router.all('/webhook/check-agent-wallet', checkAgentWallet);

export default router;
