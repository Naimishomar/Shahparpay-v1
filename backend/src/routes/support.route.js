import express from 'express';
import { authMiddlewares } from '../middlewares/auth.middleware.js';
import { listTickets, createTicket, addTicketMessage, updateTicket } from '../controllers/support.controller.js';

const router = express.Router();
router.use(authMiddlewares);
router.get('/', listTickets);
router.post('/', createTicket);
router.post('/:id/messages', addTicketMessage);
router.patch('/:id', updateTicket);

export default router;
