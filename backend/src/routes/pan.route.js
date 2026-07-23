import express from 'express';
import { registerPsa, panCallback } from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register-psa', authMiddlewares, registerPsa);
router.post('/callback', panCallback); // Open webhook

export default router;
