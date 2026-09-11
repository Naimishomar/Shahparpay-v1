import express from 'express';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import {
  fetchBeneficiaries,
  addBeneficiary,
  sendBeneficiaryOtp,
  sendBeneficiaryDeleteOtp,
  verifyBeneficiary,
  deleteBeneficiary,
  initiateTransfer,
  getDmtHistory,
} from '../controllers/dmt.controller.js';

const router = express.Router();

router.use(authMiddlewares);

router.post('/beneficiary/fetch', fetchBeneficiaries);
router.post('/beneficiary/add', addBeneficiary);
router.post('/beneficiary/otp', sendBeneficiaryOtp);
router.post('/beneficiary/delete-otp', sendBeneficiaryDeleteOtp);
router.post('/beneficiary/verify', verifyBeneficiary);
router.post('/beneficiary/delete', deleteBeneficiary);

router.post('/transfer', initiateTransfer);
router.get('/history', getDmtHistory);

export default router;
