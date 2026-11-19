import express from 'express';
import {
  getDashboardStats,
  getDistributors,
  getAdminProfile,
  updateAdminProfile,
  getRecentTransactions,
  liveTransactionsHandler,
} from '../controllers/admin.controller.js';
import {
  getOverview,
  getTransactions,
  getUsers,
  getUserDetail,
  setUserStatus,
  setRetailerServices,
  setRetailerVerification,
  getRetailerAepsStatus,
  updateRetailerAepsAddress,
  getActivity,
  impersonateUser,
  getNoticeReasons,
  sendUserNotice,
} from '../controllers/adminConsole.controller.js';
import { getWallets, getPayouts, selfTransfer } from '../controllers/adminIcchhamati.controller.js';
import {
  getAnalytics,
  getHealth,
  getLogs,
  sendActionOtp,
  restartServer,
  getDeploys,
  triggerDeploy,
  getPlatformServices,
  setPlatformService,
} from '../controllers/system.controller.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
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
router.post('/console/users/:role/:id/impersonate', impersonateUser);
router.get('/console/notice-reasons', getNoticeReasons);
router.post('/console/users/:role/:id/notice', sendUserNotice);
router.put('/console/retailers/:id/services', setRetailerServices);
router.patch('/console/retailers/:id/verification', setRetailerVerification);
router.get('/console/retailers/:id/aeps-status', getRetailerAepsStatus);
router.put('/console/retailers/:id/aeps-address', updateRetailerAepsAddress);
router.get('/console/activity', getActivity);

// Shahparpay's own Icchhamati account: wallets, payouts sent from it, and
// transfers between its wallets. Admin only.
router.get('/icchhamati/wallets', getWallets);
router.get('/icchhamati/payouts', getPayouts);
router.post('/icchhamati/self-transfer', selfTransfer);
// System: visitors, server health and logs, restart, deploy, platform-wide service switches.
// Restart and deploy need an emailed code (authLimiter caps the guesses).
router.get('/system/analytics', getAnalytics);
router.get('/system/health', getHealth);
router.get('/system/logs', getLogs);
router.post('/system/otp', authLimiter, sendActionOtp);
router.post('/system/restart', authLimiter, restartServer);
router.get('/system/deploys', getDeploys);
router.post('/system/deploy', authLimiter, triggerDeploy);
router.get('/system/services', getPlatformServices);
router.put('/system/services/:key', setPlatformService);

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

export default router;
