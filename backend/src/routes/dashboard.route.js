import express from 'express';
import { getRetailerStats, getRecentTransactions } from '../controllers/dashboard.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();

const verifyRole = (role) => (req, res, next) => {
    if (req.user && req.user.role === role) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
};

router.get('/retailer', authMiddlewares, verifyRole('retailer'), getRetailerStats);
router.get('/recent-transactions', authMiddlewares, getRecentTransactions);

export default router;
