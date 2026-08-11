import express from 'express';
import {
    applyPanService,
    applyPanCoupon,
    getPanServiceStatus,
    getPanCouponStatus,
    getEsevaPanHistory,
    getMyEsevaPsaId
} from '../controllers/panEseva.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

// eSevaTech PAN Service / PAN Coupon routes (authenticated retailers)
router.post('/eseva/apply-service', authMiddlewares, applyPanService);
router.post('/eseva/apply-coupon', authMiddlewares, applyPanCoupon);
router.post('/eseva/service-status', authMiddlewares, getPanServiceStatus);
router.post('/eseva/coupon-status', authMiddlewares, getPanCouponStatus);
router.get('/eseva/history', authMiddlewares, getEsevaPanHistory);
router.get('/eseva/my-psa', authMiddlewares, getMyEsevaPsaId);

export default router;
