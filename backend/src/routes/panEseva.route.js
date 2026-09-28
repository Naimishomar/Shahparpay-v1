import express from 'express';
import {
  applyPanService,
  applyPanCoupon,
  getPanServiceStatus,
  getPanCouponStatus,
  getEsevaPanHistory,
  getMyEsevaPsaId,
} from '../controllers/panEseva.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { requireService } from '../middlewares/service.middleware.js';

const router = express.Router();

// eSevaTech PAN Service / PAN Coupon routes (authenticated retailers)
router.post('/eseva/apply-service', authMiddlewares, requireService('pan'), applyPanService);
router.post('/eseva/apply-coupon', authMiddlewares, requireService('pan'), applyPanCoupon);
router.post('/eseva/service-status', authMiddlewares, requireService('pan'), getPanServiceStatus);
router.post('/eseva/coupon-status', authMiddlewares, requireService('pan'), getPanCouponStatus);
router.get('/eseva/history', authMiddlewares, requireService('pan'), getEsevaPanHistory);
router.get('/eseva/my-psa', authMiddlewares, requireService('pan'), getMyEsevaPsaId);

export default router;
