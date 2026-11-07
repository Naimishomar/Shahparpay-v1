import express from 'express';
import {
  createOrder,
  verifyOrder,
  paymentReturn,
  getCollectionHistory,
} from '../controllers/collect.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// The customer's browser, back from checkout: public, and it only verifies
// that one order with the gateway. Limited, since each hit asks the gateway.
router.all('/return/:ref', rateLimit({ windowMs: 60 * 1000, max: 20 }), paymentReturn);

// Every route here creates an order against a retailer's wallet or reads their
// collections: none may be reachable unauthenticated.
router.use(authMiddlewares);
router.use(requireService('collect'));

router.post('/order', createOrder);
router.post('/verify', verifyOrder);
router.get('/history', getCollectionHistory);
// Counter QR/UPI is withdrawn: Icchhamati's charge on it is too high. Payment
// links stay. The QR webhook still credits a QR printed before this.
// router.get('/qr', getQr);
// router.post('/qr', generateQr);

export default router;
