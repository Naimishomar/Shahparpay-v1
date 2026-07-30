import express from 'express';
import { launchItrFiling, checkAgentWallet, itrWebhook, getItrHistory } from '../controllers/itr.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Authenticated routes for retailers
router.post('/launch', authMiddlewares, launchItrFiling);
router.get('/history', authMiddlewares, getItrHistory);

// Public callback routes from eSevaTech
router.post('/check-agent-wallet', checkAgentWallet);
router.post('/webhook', itrWebhook);

export default router;
