import express from 'express';
import { paysprintCallback } from '../controllers/onboardCallback.controller.js';

const router = express.Router();

// Single public callback URL for every PaySprint event. Outside
// authMiddlewares: PaySprint posts server-to-server and authenticates with
// PAYSPRINT_CALLBACK_KEY in the query string instead of a user token.
router.post('/callback', paysprintCallback);

export default router;
