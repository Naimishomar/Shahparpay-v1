import express from 'express';
// PAYSPRINT-DISABLED: PaySprint withdrew its MATM APIs. Its handlers stay in
// matm.controller.js; restore these imports and routes to switch back.
// import { getMatmConfig, processMatm, checkMatmStatus } from '../controllers/matm.controller.js';
import { getMatmHistory } from '../controllers/matm.controller.js';
import { getMatmConfig, submitMatmResult } from '../controllers/icchhamatiMatm.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();
router.use(authMiddlewares);
router.use(requireService('matm'));
// PAYSPRINT-DISABLED:
// router.post('/config', getMatmConfig);
// router.post('/request', processMatm);
// router.post('/status', checkMatmStatus);

// Icchhamati (Fingpay) Micro ATM.
router.post('/config', getMatmConfig);
router.post('/request', submitMatmResult);
router.get('/history', getMatmHistory);

export default router;
