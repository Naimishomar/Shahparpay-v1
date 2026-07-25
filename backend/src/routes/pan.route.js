import express from 'express';
import { getMyPsaStatus, registerBiometricPsa, buyPsaCoupons, panCallback } from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/my-psa-status', authMiddlewares, getMyPsaStatus);
router.post('/register-bio-psa', authMiddlewares, registerBiometricPsa);
router.post('/buy-coupons', authMiddlewares, buyPsaCoupons);
router.post('/callback', panCallback); // Webhook callback

export default router;
