import express from 'express';
import { icchhamatiWebhook } from '../controllers/icchhamatiWebhook.controller.js';

const router = express.Router();

// Single public callback URL for every Icchhamati event — their panel accepts
// only one. Outside authMiddlewares: Icchhamati posts server-to-server and
// authenticates with mid/mkey headers or the collection webhook secret.
router.post('/callback', icchhamatiWebhook);

export default router;
