import express from 'express';
import { generatePanUrl, panCallback } from '../controllers/pan.controller.js';
import { verifyToken, isRetailer } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/generate-url', verifyToken, isRetailer, generatePanUrl);
router.post('/callback', panCallback); // Open webhook

export default router;
