import express from 'express';
import {
  getMatmConfig,
  getMatmSdkConfig,
  submitMatmResult,
  getMatmHistory,
} from '../controllers/icchhamatiMatm.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();
router.use(authMiddlewares);
router.use(requireService('matm'));

// Icchhamati (Fingpay) Micro ATM.
router.post('/config', getMatmConfig);
router.post('/request', submitMatmResult);
router.get('/sdk', getMatmSdkConfig);
router.get('/history', getMatmHistory);

export default router;
