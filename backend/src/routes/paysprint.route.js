import express from 'express';
import { paysprintCallback } from '../controllers/lead.controller.js';

const router = express.Router();

// PaySprint's one account-wide callback URL, used only for Lead Generation.
// Outside authMiddlewares: PaySprint posts server-to-server and authenticates
// with PAYSPRINT_CALLBACK_KEY in the query string instead of a user token.
router.post('/callback', paysprintCallback);

export default router;
