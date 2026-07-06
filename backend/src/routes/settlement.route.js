import express from 'express';
import { getSavedBanks, addSettlementBank, initiateSettlement, getSettlementHistory, initiateDirectPayout } from '../controllers/settlement.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddlewares);

router.get('/saved-banks', getSavedBanks);
router.post('/add-bank', addSettlementBank);
router.post('/initiate', initiateSettlement);
router.post('/direct-payout', initiateDirectPayout);
router.get('/history', getSettlementHistory);

export default router;
