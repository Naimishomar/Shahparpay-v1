import express from 'express';
import { getPublicCommissionRates } from '../controllers/commission.controller.js';

import { cacheFor } from '../middlewares/cache.middleware.js';

const router = express.Router();

// Public: retailers compare rates before they sign up, so this cannot sit
// behind a login. It exposes rate cards only, never anyone's earnings.
router.get('/', cacheFor(3600), getPublicCommissionRates);

export default router;
