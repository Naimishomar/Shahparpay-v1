import express from 'express';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { 
    queryRemitter, 
    registerRemitter, 
    verifyRemitter, 
    fetchBeneficiaries, 
    addBeneficiary, 
    deleteBeneficiary, 
    initiateTransfer, 
    getDmtHistory,
    fetchBankList
} from '../controllers/dmt.controller.js';

const router = express.Router();

router.use(authMiddlewares);

router.post('/banks', fetchBankList);

router.post('/remitter/query', queryRemitter);
router.post('/remitter/register', registerRemitter);
router.post('/remitter/verify', verifyRemitter);

router.post('/beneficiary/fetch', fetchBeneficiaries);
router.post('/beneficiary/add', addBeneficiary);
router.post('/beneficiary/delete', deleteBeneficiary);

router.post('/transfer', initiateTransfer);
router.get('/history', getDmtHistory);

export default router;
