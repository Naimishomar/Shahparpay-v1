import express from 'express';
import { 
    createFundRequest, 
    getRetailerFundRequests, 
    getDistributorFundRequests, 
    updateFundRequestStatus,
    createDistributorFundRequest,
    getDistributorOwnFundRequests,
    getAdminFundRequests,
    updateAdminFundRequestStatus,
    deleteFundRequest
} from '../controllers/fundRequest.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = express.Router();

const verifyRole = (role) => (req, res, next) => {
    if (req.user && req.user.role === role) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
};

// ================= RETAILER -> DISTRIBUTOR =================
router.post('/create', authMiddlewares, verifyRole('retailer'), upload.fields([{ name: 'depositSlip', maxCount: 1 }]), createFundRequest);
router.get('/retailer', authMiddlewares, verifyRole('retailer'), getRetailerFundRequests);

router.get('/distributor', authMiddlewares, verifyRole('distributor'), getDistributorFundRequests);
router.put('/update', authMiddlewares, verifyRole('distributor'), updateFundRequestStatus);

// ================= DISTRIBUTOR -> ADMIN =================
router.post('/distributor/create', authMiddlewares, verifyRole('distributor'), upload.fields([{ name: 'depositSlip', maxCount: 1 }]), createDistributorFundRequest);
router.get('/distributor/mine', authMiddlewares, verifyRole('distributor'), getDistributorOwnFundRequests);

router.get('/admin', authMiddlewares, verifyRole('admin'), getAdminFundRequests);
router.put('/admin/update', authMiddlewares, verifyRole('admin'), updateAdminFundRequestStatus);

// ================= COMMON =================
router.delete('/delete/:id', authMiddlewares, deleteFundRequest);

export default router;
