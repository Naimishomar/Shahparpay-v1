import express from 'express';
import {
  getDashboardStats,
  getDistributors,
  getAdminProfile,
  updateAdminProfile,
  getRecentTransactions,
  liveTransactionsHandler,
  getGlobalSettings,
  updateGlobalSettings,
} from '../controllers/admin.controller.js';
import {
  getOverview,
  getTransactions,
  getUsers,
  getUserDetail,
  setUserStatus,
  setRetailerServices,
  getActivity,
} from '../controllers/adminConsole.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = express.Router();

// All admin routes must be protected by authentication
router.use(authMiddlewares);

router.get('/stats', getDashboardStats);

// Admin console: platform-wide visibility and account controls.
router.get('/console/overview', getOverview);
router.get('/console/transactions', getTransactions);
router.get('/console/users', getUsers);
router.get('/console/users/:role/:id', getUserDetail);
router.patch('/console/users/:role/:id/status', setUserStatus);
router.put('/console/retailers/:id/services', setRetailerServices);
router.get('/console/activity', getActivity);
router.get('/distributors', getDistributors);
router.get('/profile', getAdminProfile);
router.put(
  '/profile',
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 },
  ]),
  updateAdminProfile
);

router.get('/recent-transactions', getRecentTransactions);
router.get('/live-transactions', liveTransactionsHandler);

router.get('/settings', getGlobalSettings);
router.put('/settings', updateGlobalSettings);

export default router;
