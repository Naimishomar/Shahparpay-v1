import express from 'express';
import {
  getPaysprintCreditLedger,
  downloadPaysprintCreditLedger,
} from '../controllers/paysprintLedger.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddlewares);

router.get('/credit-ledger', getPaysprintCreditLedger);
router.get('/credit-ledger/download', downloadPaysprintCreditLedger);

export default router;
