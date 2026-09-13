import express from 'express';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { supportUpload } from '../middlewares/multer.middleware.js';
import { listTickets, createTicket, addTicketMessage, updateTicket } from '../controllers/support.controller.js';

const router = express.Router();
router.use(authMiddlewares);
router.get('/', listTickets);
router.post('/', supportUpload.single('attachment'), createTicket);
router.post('/:id/messages', supportUpload.single('attachment'), addTicketMessage);
router.patch('/:id', updateTicket);

export default router;
