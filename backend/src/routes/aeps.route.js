import express from 'express';
import { balanceEnquiry, getBankList, cashWithdrawal } from '../controllers/aepsPayment.controller.js';

const router = express.Router();

router.get('/banks', getBankList);
router.post('/balance-enquiry', balanceEnquiry);
router.post('/cash-withdrawal', cashWithdrawal);

export default router;
