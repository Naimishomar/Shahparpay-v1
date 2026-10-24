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
import { getBaseLocation, updateBaseLocation } from '../controllers/aepsLocation.controller.js';
import icchhamatiAepsRoutes from './icchhamatiAeps.route.js';
import { cacheFor } from '../middlewares/cache.middleware.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService, requireAepsProvider } from '../middlewares/service.middleware.js';

const router = express.Router();

// Icchhamati (Fingpay) AEPS, for retailers onboarded there.
router.use('/icchhamati', icchhamatiAepsRoutes);

// Everything that moves money or onboards is PaySprint's; an Icchhamati retailer
// is sent to /api/aeps/icchhamati instead.
const paysprint = requireAepsProvider('paysprint');

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
router.get('/banks', cacheFor(6 * 3600), getBankList);
router.post('/balance-enquiry', authMiddlewares, requireService('aeps'), paysprint, balanceEnquiry);
router.post('/initiate-otp', authMiddlewares, requireService('aeps'), paysprint, initiateAepsTxnOtp);
router.post('/cash-withdrawal', authMiddlewares, requireService('aeps'), paysprint, cashWithdrawal);
router.post('/cash-deposit', authMiddlewares, requireService('aeps'), paysprint, cashDeposit);
router.post('/aadhaar-pay', authMiddlewares, requireService('aeps'), paysprint, aadhaarPay);
router.post('/mini-statement', authMiddlewares, requireService('aeps'), paysprint, miniStatement);
router.post('/txn-status', authMiddlewares, cashWithdrawalTxnStatus);

// Merchant eKYC & Auth
router.post('/kyc/send-otp', authMiddlewares, paysprint, sendMerchantOtp);
router.post('/kyc/resend-otp', authMiddlewares, paysprint, resendMerchantOtp);
router.post('/kyc/verify-otp', authMiddlewares, paysprint, verifyMerchantOtp);
router.post('/kyc/activate-merchant', authMiddlewares, paysprint, activateMerchant);
router.post('/daily-auth', authMiddlewares, paysprint, dailyAuth);

// Shop location registered with PaySprint for geo-fencing. Capped by the
// provider at three changes per calendar year, so the GET reports what is left.
router.get('/base-location', authMiddlewares, getBaseLocation);
router.post('/base-location', authMiddlewares, updateBaseLocation);

export default router;
