import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import {
  getStatus,
  getStates,
  register,
  verifyStep,
  VERIFY_STEP_ROUTES,
  uploadVideoKyc,
  uploadShopImage,
  onboard,
  ekycSendOtp,
  ekycVerifyOtp,
  ekycBiometric,
  twoFactor,
  changeDevice,
  getBanks,
  sendTxnOtp,
  doTransaction,
} from '../controllers/icchhamatiAeps.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import { requireService, requireAepsProvider } from '../middlewares/service.middleware.js';

// Mounted at /api/aeps/icchhamati. Only retailers onboarded with Icchhamati get in.
const router = express.Router();
router.use(authMiddlewares, requireAepsProvider('icchhamati'));

// The provider takes MP4 up to 20 MB; the shared upload middleware is images only.
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'public', 'temp'),
    // The extension rides into the stored file's URL, which Icchhamati's
    // reviewers open; a phone's MP4 must not arrive as ".video".
    filename: (req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${crypto.randomUUID()}${file.mimetype === 'video/quicktime' ? '.mov' : '.mp4'}`
      ),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    file.mimetype?.startsWith('video/')
      ? cb(null, true)
      : cb(new Error('Only video files are allowed')),
});

router.get('/status', getStatus);
router.get('/states', getStates);
router.post('/register', register);
for (const route of VERIFY_STEP_ROUTES) router.post(`/${route}`, verifyStep(route));
router.post('/shop-image', upload.single('image'), uploadShopImage);
router.post('/video-kyc', videoUpload.single('video'), uploadVideoKyc);
router.post('/onboard', onboard);
router.post('/ekyc/send-otp', ekycSendOtp);
router.post('/ekyc/verify-otp', ekycVerifyOtp);
router.post('/ekyc/biometric', ekycBiometric);
router.post('/2fa', twoFactor);
router.post('/device', changeDevice);

router.get('/banks', getBanks);
router.post('/txn-otp', requireService('aeps'), sendTxnOtp);
router.post('/transaction', requireService('aeps'), doTransaction);

export default router;
