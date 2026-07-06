import express from 'express';
import { getOperators, browsePlans, fetchDthInfo, doRecharge, getHistory, checkBalance, checkStatus, fetchBill } from '../controllers/recharge.controller.js';

const router = express.Router();

router.get('/operators/:type', getOperators);
router.post('/browse-plan', browsePlans);
router.post('/dth-info', fetchDthInfo);
router.post('/fetch-bill', fetchBill);
router.post('/do-recharge', doRecharge);
router.get('/history', getHistory);
router.get('/balance', checkBalance);
router.get('/status/:transid', checkStatus);

export default router;
