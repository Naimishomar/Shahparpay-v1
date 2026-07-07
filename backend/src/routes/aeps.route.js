import express from 'express';
import { 
    balanceEnquiry, 
    getBankList, 
    cashWithdrawal,
    cashDeposit,
    miniStatement,
    cashWithdrawalTxnStatus,
    sendMerchantOtp,
    resendMerchantOtp,
    verifyMerchantOtp,
    dailyAuth,
    getMerchantStatus
} from '../controllers/aepsPayment.controller.js';

import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Merchant Status
router.get('/merchant-status', verifyToken, getMerchantStatus);

// Core AEPS Services
router.get('/banks', verifyToken, getBankList);
router.post('/balance-enquiry', verifyToken, balanceEnquiry);
router.post('/cash-withdrawal', verifyToken, cashWithdrawal);
router.post('/cash-deposit', verifyToken, cashDeposit);
router.post('/mini-statement', verifyToken, miniStatement);
router.post('/txn-status', verifyToken, cashWithdrawalTxnStatus);

// Merchant eKYC & Auth
router.post('/kyc/send-otp', verifyToken, sendMerchantOtp);
router.post('/kyc/resend-otp', verifyToken, resendMerchantOtp);
router.post('/kyc/verify-otp', verifyToken, verifyMerchantOtp);
router.post('/daily-auth', verifyToken, dailyAuth);

export default router;
