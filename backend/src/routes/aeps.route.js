import express from 'express';
import { balanceEnquiry, getBankList } from '../controllers/aepsPayment.controller.js';

const router = express.Router();

router.get('/banks', getBankList);
router.post('/balance-enquiry', balanceEnquiry);

export default router;
