import express from 'express';
import { generateLead, checkStatus, getLeadHistory, leadCallback } from '../controllers/lead.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public webhook endpoint for PaySprint callbacks
router.post('/callback', leadCallback);

// Protected routes for users
router.use(authMiddlewares);

router.post('/generate', generateLead);
router.get('/status/:refid', checkStatus);
router.get('/history', getLeadHistory);

export default router;
