import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import {
  getStatus,
  getStates,
  getSettlementBanks,
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

// Up to 100 MB: Android cameras ignore any quality setting, so a 30-second
// clip is often 30-60 MB. Icchhamati takes 20 MB as a file; anything larger is
// hosted by us and registered by URL (see uploadVideoKyc). The shared upload
// middleware is images only.
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
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    file.mimetype?.startsWith('video/')
      ? cb(null, true)
      : cb(new Error('Only video files are allowed')),
});

/**
 * Runs a multer middleware, answering its refusals (too large, wrong type) as
 * our usual JSON instead of Express's HTML error page, which the app could
 * only show as "Request failed with status code 500".
 */
const acceptFile = (middleware, tooLarge) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? tooLarge : err.message || 'The file could not be read.';
    return res.status(400).json({ success: false, message });
  });

router.get('/status', getStatus);
router.get('/states', getStates);
router.post('/register', register);
for (const route of VERIFY_STEP_ROUTES) router.post(`/${route}`, verifyStep(route));
router.post(
  '/shop-image',
  acceptFile(upload.single('image'), 'The photo must be 10 MB or smaller.'),
  uploadShopImage
);
router.post(
  '/video-kyc',
  acceptFile(
    videoUpload.single('video'),
    'The video must be 100 MB or smaller. Record a shorter clip.'
  ),
  uploadVideoKyc
);
router.post('/onboard', onboard);
router.post('/ekyc/send-otp', ekycSendOtp);
router.post('/ekyc/verify-otp', ekycVerifyOtp);
router.post('/ekyc/biometric', ekycBiometric);
router.post('/2fa', twoFactor);
router.post('/device', changeDevice);

router.get('/banks', getBanks);
router.get('/settlement-banks', getSettlementBanks);
router.post('/txn-otp', requireService('aeps'), sendTxnOtp);
router.post('/transaction', requireService('aeps'), doTransaction);

export default router;
