import express from 'express';
import {
  createOrder,
  verifyOrder,
  getCollectionHistory,
  getQr,
  generateQr,
} from '../controllers/collect.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();

// Every route here creates an order against a retailer's wallet or reads their
// collections: none may be reachable unauthenticated.
router.use(authMiddlewares);
router.use(requireService('collect'));

router.post('/order', createOrder);
router.post('/verify', verifyOrder);
router.get('/history', getCollectionHistory);
router.get('/qr', getQr);
router.post('/qr', generateQr);

export default router;
