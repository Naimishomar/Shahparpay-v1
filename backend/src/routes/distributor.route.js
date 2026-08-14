import { Router } from 'express';
import {
  getDashboardStats,
  getRetailers,
  updateRetailer,
  getProfile,
  updateProfile,
} from '../controllers/distributor.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();

// Dashboard
router.get('/stats', authMiddlewares, getDashboardStats);

// Retailers
router.get('/retailers', authMiddlewares, getRetailers);
router.put(
  '/retailers/:id',
  authMiddlewares,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 },
  ]),
  updateRetailer
);

// Profile
router.get('/profile', authMiddlewares, getProfile);
router.put(
  '/profile',
  authMiddlewares,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 },
  ]),
  updateProfile
);

export default router;
