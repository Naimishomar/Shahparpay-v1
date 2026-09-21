import express from 'express';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

const app = express();
dotenv.config({ quiet: true });
const PORT = process.env.PORT || 5000;

// Report payloads are mostly repeated keys and status strings: the 780-row
// AEPS report measures 477 KB raw and 46 KB gzipped. Retailers are on mobile
// data, so this is the difference between a multi-second wait and an instant
// one — on every endpoint, not just reports.
app.use(compression());

// The portal lives on shahparpay.in; shahparpay.com serves the older,
// separate portal. The API stays on api.shahparpay.com for both, so that
// domain is not retired here.
const allowedOrigins = [
  'https://shahparpay.in',
  'https://www.shahparpay.in',
  'https://shahparpay.com',
  'https://www.shahparpay.com',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, server-to-server webhooks)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.shahparpay.in') ||
        origin.endsWith('.shahparpay.com') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      // Fallback: allow all origins
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);

// No explicit app.options() route: the cors() middleware above already answers
// every OPTIONS preflight itself. Express 5 also rejects a bare '*' path.

morgan.token('custom-date', () => {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return formatter
    .format(new Date())
    .replace(', ', ' - ')
    .toUpperCase()
    .replace(' PM', 'PM')
    .replace(' AM', 'AM');
});

app.use(
  morgan(function (tokens, req, res) {
    const status = tokens.status(req, res);
    const statusColor =
      status >= 500
        ? 31 // red
        : status >= 400
          ? 33 // yellow
          : status >= 300
            ? 36 // cyan
            : status >= 200
              ? 32 // green
              : 0; // no color

    return [
      `\x1b[90m[${tokens['custom-date'](req, res)}]\x1b[0m`,
      tokens.method(req, res),
      tokens.url(req, res),
      `\x1b[${statusColor}m${status}\x1b[0m`,
      tokens['response-time'](req, res),
      'ms',
      '-',
      tokens.res(req, res, 'content-length'),
    ].join(' ');
  })
);

// The Razorpay webhook signature is an HMAC over the exact bytes received, so
// the raw body has to survive parsing: re-serialising the parsed object changes
// key order and whitespace and every genuine notification would fail to verify.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/', (req, res) => {
  return res.send('Shahparpay never goes down🚀');
});

// Auto-connect database for serverless invocations
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection failed on request:', error.message);
    next();
  }
});

import aepsRoutes from './routes/aeps.route.js';
import rechargeRoutes from './routes/recharge.route.js';
import authRoutes from './routes/auth.route.js';
import adminRouter from './routes/admin.route.js';
import distributorRouter from './routes/distributor.route.js';
import walletRouter from './routes/wallet.route.js';
import dmtRouter from './routes/dmt.route.js';
import settlementRouter from './routes/settlement.route.js';
import fundRequestRouter from './routes/fundRequest.route.js';
import dashboardRouter from './routes/dashboard.route.js';
import leadRouter from './routes/lead.route.js';
import panRouter from './routes/pan.route.js';
import panEsevaRouter from './routes/panEseva.route.js';
import itrRouter from './routes/itr.route.js';
import collectRouter from './routes/collect.route.js';
import topupRouter from './routes/topup.route.js';
import matmRouter from './routes/matm.route.js';
import notificationRouter from './routes/notification.route.js';
import supportRouter from './routes/support.route.js';
import paysprintRouter from './routes/paysprint.route.js';
import icchhamatiRouter from './routes/icchhamati.route.js';
import { checkAgentWallet } from './controllers/itr.controller.js';
import { startReconciliationWorker } from './workers/reconciliation.worker.js';

app.use('/api/aeps', aepsRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/distributor', distributorRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/dmt', dmtRouter);
app.use('/api/settlement', settlementRouter);
app.use('/api/fund-request', fundRequestRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/lead', leadRouter);
app.use('/api/pan', panRouter);
app.use('/api/pan', panEsevaRouter);
app.use('/api/itr', itrRouter);
app.use('/api/collect', collectRouter);
app.use('/api/topup', topupRouter);
app.use('/api/matm', matmRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/support', supportRouter);
// One URL for every PaySprint event — their panel accepts only a single callback.
app.use('/api/paysprint', paysprintRouter);
// Same story for Icchhamati: one callback URL in their panel for every event.
app.use('/api/icchhamati', icchhamatiRouter);

// eSevaTech may call /api/check-agent-wallet at root level by convention
app.all('/api/check-agent-wallet', checkAgentWallet);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}✅`);
      startReconciliationWorker();
    });
  } catch (error) {
    console.log('Failed to connect to database', error.message);
    process.exit(1);
  }
};

startServer();

export default app;
