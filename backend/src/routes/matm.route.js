import express from 'express';
import { getMatmConfig, processMatm, getMatmHistory } from '../controllers/matm.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();
router.use(authMiddlewares);
router.post('/config', getMatmConfig);
router.post('/request', processMatm);
router.get('/history', getMatmHistory);

export default router;
