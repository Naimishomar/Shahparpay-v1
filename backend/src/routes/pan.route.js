import express from 'express';
import { getMyPsaStatus, registerBiometricPsa, buyPsaCoupons, setPsaId, syncPsaStatus, panCallback } from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/my-psa-status', authMiddlewares, getMyPsaStatus);
router.post('/register-bio-psa', authMiddlewares, registerBiometricPsa);
router.post('/buy-coupons', authMiddlewares, buyPsaCoupons);
router.patch('/set-psa-id', authMiddlewares, setPsaId);
router.patch('/sync-psa-status', authMiddlewares, syncPsaStatus);
router.post('/callback', panCallback); // Webhook callback

export default router;
