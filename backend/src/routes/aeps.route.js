import express from 'express';
import icchhamatiAepsRoutes from './icchhamatiAeps.route.js';

const router = express.Router();

// Icchhamati (Fingpay) AEPS.
router.use('/icchhamati', icchhamatiAepsRoutes);

export default router;
