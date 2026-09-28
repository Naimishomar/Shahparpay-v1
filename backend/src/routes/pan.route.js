import express from 'express';
import {
  getMyPsaStatus,
  registerBiometricPsa,
  buyPsaCoupons,
  setPsaId,
  syncPsaStatus,
  panCallback,
  getStdPsaStatus,
  registerStdPsa,
  updateStdPsa,
  purchaseStdCoupons,
  requestStdPsaPassword,
} from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();

router.get('/my-psa-status', authMiddlewares, requireService('pan'), getMyPsaStatus);
router.post('/register-bio-psa', authMiddlewares, requireService('pan'), registerBiometricPsa);
router.post('/buy-coupons', authMiddlewares, requireService('pan'), buyPsaCoupons);
router.patch('/set-psa-id', authMiddlewares, requireService('pan'), setPsaId);
router.patch('/sync-psa-status', authMiddlewares, requireService('pan'), syncPsaStatus);
router.post('/callback', panCallback); // Webhook callback

// Standard UTI Web PSA Routes
router.get('/my-std-psa-status', authMiddlewares, requireService('pan'), getStdPsaStatus);
router.post('/register-std-psa', authMiddlewares, requireService('pan'), registerStdPsa);
router.post('/update-std-psa', authMiddlewares, requireService('pan'), updateStdPsa);
router.post('/buy-std-coupons', authMiddlewares, requireService('pan'), purchaseStdCoupons);
router.get('/std-psa-password', authMiddlewares, requireService('pan'), requestStdPsaPassword);

export default router;
