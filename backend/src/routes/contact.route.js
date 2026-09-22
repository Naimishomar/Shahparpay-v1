import express from 'express';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import {
  submitEnquiry,
  listEnquiries,
  updateEnquiryStatus,
} from '../controllers/contact.controller.js';

const router = express.Router();

// These enquiries hold a stranger's name, mobile and message, so reading them is
// an admin-only action. authMiddlewares alone is not enough: it authenticates
// any retailer or distributor too.
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admins only.' });
  }
  return next();
};

// Public: this is the whole point of the form.
router.post('/', submitEnquiry);

router.get('/', authMiddlewares, adminOnly, listEnquiries);
router.patch('/:id', authMiddlewares, adminOnly, updateEnquiryStatus);

export default router;
