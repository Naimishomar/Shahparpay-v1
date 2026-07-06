import express from 'express';
import { getBalances, setPin, transferAepsToMain, getTransferHistory } from '../controllers/wallet.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddlewares);

router.get('/balance', getBalances);
router.post('/set-pin', setPin);
router.post('/transfer', transferAepsToMain);
router.get('/history', getTransferHistory);

export default router;
