import express from 'express';
import { registerBiometricPsa, panCallback } from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register-bio-psa', authMiddlewares, registerBiometricPsa);
router.post('/callback', panCallback); // Webhook callback

export default router;
