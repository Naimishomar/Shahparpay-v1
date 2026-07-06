import express from 'express';
import { getDashboardStats, getDistributors, getAdminProfile, updateAdminProfile } from '../controllers/admin.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = express.Router();

// All admin routes must be protected by authentication
router.use(authMiddlewares);

router.get('/stats', getDashboardStats);
router.get('/distributors', getDistributors);
router.get('/profile', getAdminProfile);
router.put('/profile', upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarPicture', maxCount: 1 },
    { name: 'panPicture', maxCount: 1 }
]), updateAdminProfile);

export default router;
