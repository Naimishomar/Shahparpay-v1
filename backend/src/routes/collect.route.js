import express from 'express';
import {
  createOrder,
  verifyOrder,
  generateQr,
  verifyBankAccount,
  getCollectionHistory,
  collectionWebhook,
} from '../controllers/collect.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Icchhamati posts successful virtual-account QR payments here. The handler
// validates the mapped virtual account and credits the QR wallet idempotently.
router.post('/webhook', collectionWebhook);

// Every route here creates an order against a retailer's wallet or reads their
// collections: none may be reachable unauthenticated.
router.use(authMiddlewares);

router.post('/order', createOrder);
router.post('/verify', verifyOrder);
router.post('/qr', generateQr);
router.post('/verify-bank-account', verifyBankAccount);
router.get('/history', getCollectionHistory);

export default router;
