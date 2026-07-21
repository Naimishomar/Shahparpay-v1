import express from 'express';
import { generatePanUrl, panCallback } from '../controllers/pan.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/generate-url', authMiddlewares, generatePanUrl);
router.post('/callback', panCallback); // Open webhook

export default router;
