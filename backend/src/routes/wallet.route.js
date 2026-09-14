import express from 'express';
import {
  getBalances,
  setPin,
  changePin,
  transferQrToMain,
  getTransferHistory,
} from '../controllers/wallet.controller.js';
import { getWalletLedger } from '../controllers/walletLedger.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddlewares);

router.get('/balance', getBalances);
router.post('/set-pin', setPin);
router.post('/change-pin', changePin);
router.post('/transfer', transferQrToMain);
router.get('/history', getTransferHistory);
router.get('/ledger', getWalletLedger);

export default router;
