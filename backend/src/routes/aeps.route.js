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
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Merchant Status
router.get('/merchant-status', getMerchantStatus);

// Core AEPS Services
router.get('/banks', getBankList);
router.post('/balance-enquiry', authMiddlewares, balanceEnquiry);
router.post('/cash-withdrawal', authMiddlewares, cashWithdrawal);
router.post('/cash-deposit', authMiddlewares, cashDeposit);
router.post('/mini-statement', authMiddlewares, miniStatement);
router.post('/txn-status', authMiddlewares, cashWithdrawalTxnStatus);

// Merchant eKYC & Auth
router.post('/kyc/send-otp', sendMerchantOtp);
router.post('/kyc/resend-otp', resendMerchantOtp);
router.post('/kyc/verify-otp', verifyMerchantOtp);
router.post('/daily-auth', dailyAuth);

export default router;
