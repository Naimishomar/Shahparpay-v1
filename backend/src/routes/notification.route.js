import express from 'express';
import {
  listNotifications,
  listTickerUpdates,
  markNotificationRead,
  createNotification,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { authMiddlewares } from '../middlewares/auth.middleware.js';

const router = express.Router();
router.use(authMiddlewares);

router.get('/', listNotifications);
router.get('/ticker', listTickerUpdates);
router.post('/', createNotification);
router.post('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);

export default router;
