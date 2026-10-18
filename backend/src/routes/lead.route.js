import express from 'express';
import {
  generateLead,
  checkStatus,
  getLeadHistory,
} from '../controllers/lead.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();

// No public /callback here: PaySprint delivers LEAD_GENERATION_CALLBACK to the
// key-checked /api/paysprint/callback. An unsigned route let retailers approve
// their own leads and collect the commission.

// Protected routes for users
router.use(authMiddlewares);
router.use(requireService('lead'));

router.post('/generate', generateLead);
router.get('/status/:refid', checkStatus);
router.get('/history', getLeadHistory);

export default router;
