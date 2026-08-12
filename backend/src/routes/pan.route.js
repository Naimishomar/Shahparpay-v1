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

const router = express.Router();

router.get('/my-psa-status', authMiddlewares, getMyPsaStatus);
router.post('/register-bio-psa', authMiddlewares, registerBiometricPsa);
router.post('/buy-coupons', authMiddlewares, buyPsaCoupons);
router.patch('/set-psa-id', authMiddlewares, setPsaId);
router.patch('/sync-psa-status', authMiddlewares, syncPsaStatus);
router.post('/callback', panCallback); // Webhook callback

// Standard UTI Web PSA Routes
router.get('/my-std-psa-status', authMiddlewares, getStdPsaStatus);
router.post('/register-std-psa', authMiddlewares, registerStdPsa);
router.post('/update-std-psa', authMiddlewares, updateStdPsa);
router.post('/buy-std-coupons', authMiddlewares, purchaseStdCoupons);
router.get('/std-psa-password', authMiddlewares, requestStdPsaPassword);

export default router;
