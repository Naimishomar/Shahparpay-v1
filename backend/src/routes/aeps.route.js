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

const router = express.Router();

// Merchant Status
router.get('/merchant-status', getMerchantStatus);

// Core AEPS Services
router.get('/banks', getBankList);
router.post('/balance-enquiry', balanceEnquiry);
router.post('/cash-withdrawal', cashWithdrawal);
router.post('/cash-deposit', cashDeposit);
router.post('/mini-statement', miniStatement);
router.post('/txn-status', cashWithdrawalTxnStatus);

// Merchant eKYC & Auth
router.post('/kyc/send-otp', sendMerchantOtp);
router.post('/kyc/resend-otp', resendMerchantOtp);
router.post('/kyc/verify-otp', verifyMerchantOtp);
router.post('/daily-auth', dailyAuth);

export default router;
