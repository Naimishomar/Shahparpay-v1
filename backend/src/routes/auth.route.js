import { Router } from 'express';
import {
  loginUser,
  verifyLoginOtp,
  sendVerificationOtp,
  sendPasswordOtp,
  createDistributor,
  createRetailer,
  refreshAccessToken,
  logoutUser,
  verifyEmailOtp,
  generateAadhaarOtp,
  verifyAadhaarOtp,
  verifyPan,
  generateOnboardUrl,
  updateKycStatus,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/login', authLimiter, loginUser);
router.post('/verify-login-otp', authLimiter, verifyLoginOtp);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/send-verification-otp', authLimiter, sendVerificationOtp);
router.post('/send-password-otp', authLimiter, authMiddlewares, sendPasswordOtp);
router.post('/verify-email-otp', authLimiter, verifyEmailOtp);
router.post('/refresh-token', refreshAccessToken);
router.post('/logout', authMiddlewares, logoutUser);
router.put('/update-profile', authMiddlewares, upload.single('profilePicture'), updateProfile);
router.put('/change-password', authLimiter, authMiddlewares, changePassword);

router.post('/paysprint/aadhaar/send-otp', authMiddlewares, generateAadhaarOtp);
router.post('/paysprint/aadhaar/verify-otp', authMiddlewares, verifyAadhaarOtp);
router.post('/paysprint/pan/verify', authMiddlewares, verifyPan);
router.post('/paysprint/get-onboard-url', authMiddlewares, generateOnboardUrl);
router.post('/paysprint/update-kyc-status', authMiddlewares, updateKycStatus);

router.post(
  '/create-distributor',
  authMiddlewares,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 },
  ]),
  createDistributor
);

router.post(
  '/create-retailer',
  authMiddlewares,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 },
  ]),
  createRetailer
);

export default router;
