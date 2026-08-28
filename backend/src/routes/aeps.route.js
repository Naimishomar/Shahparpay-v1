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
  getMerchantStatus,
  aadhaarPay,
  getPidOptions,
  activateMerchant,
  initiateAepsTxnOtp,
  verifyAllPipes,
  getPipeOnboardingPlan,
} from '../controllers/aepsPayment.controller.js';
import {
  onboardTransactionCallback,
  onboardStatusCallback,
  getOnboardSdkParams,
} from '../controllers/onboardCallback.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// PaySprint server-to-server onboarding callbacks. Deliberately outside
// authMiddlewares — they carry PAYSPRINT_CALLBACK_KEY instead of a user token.
router.post('/onboard/callback/transaction', onboardTransactionCallback);
router.post('/onboard/callback/status', onboardStatusCallback);

// Merchant Status
router.get('/merchant-status', authMiddlewares, getMerchantStatus);
router.get('/pipes/verify', authMiddlewares, verifyAllPipes);
router.get('/onboarding/plan', authMiddlewares, getPipeOnboardingPlan);
router.get('/onboard/sdk-params', authMiddlewares, getOnboardSdkParams);
router.post('/get-pid-options', authMiddlewares, getPidOptions);

// Core AEPS Services
router.get('/banks', getBankList);
router.post('/balance-enquiry', authMiddlewares, balanceEnquiry);
router.post('/initiate-otp', authMiddlewares, initiateAepsTxnOtp);
router.post('/cash-withdrawal', authMiddlewares, cashWithdrawal);
router.post('/cash-deposit', authMiddlewares, cashDeposit);
router.post('/aadhaar-pay', authMiddlewares, aadhaarPay);
router.post('/mini-statement', authMiddlewares, miniStatement);
router.post('/txn-status', authMiddlewares, cashWithdrawalTxnStatus);

// Merchant eKYC & Auth
router.post('/kyc/send-otp', authMiddlewares, sendMerchantOtp);
router.post('/kyc/resend-otp', authMiddlewares, resendMerchantOtp);
router.post('/kyc/verify-otp', authMiddlewares, verifyMerchantOtp);
router.post('/kyc/activate-merchant', authMiddlewares, activateMerchant);
router.post('/daily-auth', authMiddlewares, dailyAuth);

export default router;
