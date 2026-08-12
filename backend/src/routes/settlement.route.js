import express from 'express';
import multer from 'multer';
import {
  getSavedBanks,
  syncSavedBanks,
  addSettlementBank,
  deleteSettlementBank,
  getSettlementAccountStatus,
  uploadSettlementDocument,
  initiateSettlement,
  initiateDirectPayout,
  checkSettlementStatus,
  getSettlementHistory,
} from '../controllers/settlement.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddlewares);

router.get('/saved-banks', getSavedBanks);
router.get('/sync-banks', syncSavedBanks);
router.post('/add-bank', addSettlementBank);
router.delete('/bank/:id', deleteSettlementBank);
router.get('/account-status/:id', getSettlementAccountStatus);
router.post(
  '/upload-document',
  upload.fields([
    { name: 'passbook', maxCount: 1 },
    { name: 'panimage', maxCount: 1 },
    { name: 'front_aadhar', maxCount: 1 },
    { name: 'back_aadhar', maxCount: 1 },
  ]),
  uploadSettlementDocument
);
router.post('/initiate', initiateSettlement);
router.post('/direct-payout', initiateDirectPayout);
router.post('/status', checkSettlementStatus);
router.get('/history', getSettlementHistory);

export default router;
