import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

const app = express();
dotenv.config({quiet: true});
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: function(origin, callback) {
        // Allow frontend origins + eSevaTech server-to-server (no origin) calls
        const allowedOrigins = ['http://localhost:5173', 'https://shahparpay-v1.vercel.app'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins for server-to-server webhooks
        }
    },
    credentials: true,
}));

morgan.token('custom-date', () => {
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return formatter.format(new Date()).replace(', ', ' - ').toUpperCase().replace(' PM', 'PM').replace(' AM', 'AM');
});

app.use(morgan(function (tokens, req, res) {
    const status = tokens.status(req, res);
    const statusColor = status >= 500 ? 31 // red
      : status >= 400 ? 33 // yellow
      : status >= 300 ? 36 // cyan
      : status >= 200 ? 32 // green
      : 0; // no color
      
    return [
        `\x1b[90m[${tokens['custom-date'](req, res)}]\x1b[0m`, 
        tokens.method(req, res),
        tokens.url(req, res),
        `\x1b[${statusColor}m${status}\x1b[0m`,
        tokens['response-time'](req, res), 'ms',
        '-',
        tokens.res(req, res, 'content-length')
    ].join(' ');
}));
const SENSITIVE_FIELDS = ['password', 'otp', 'token', 'authorization', 'pin', 'secret', 'api_key', 'apikey'];

function sanitize(body) {
    if (!body || typeof body !== 'object') return body;
    const copy = Array.isArray(body) ? [...body] : { ...body };
    for (const key of Object.keys(copy)) {
        if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
            copy[key] = '[REDACTED]';
        } else if (copy[key] && typeof copy[key] === 'object') {
            copy[key] = sanitize(copy[key]);
        }
    }
    return copy;
}

function logBody(label, body) {
    const text = JSON.stringify(body);
    if (text && text.length > 2000) {
        console.log(`    ${label}: ${text.slice(0, 2000)}... [truncated, ${text.length} chars total]`);
    } else {
        console.log(`    ${label}: ${text}`);
    }
}

app.use((req, res, next) => {
    const started = Date.now();
    console.log(`\n\x1b[36m>>> REQUEST\x1b[0m \x1b[90m[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}]\x1b[0m`);
    console.log(`    ${req.method} ${req.originalUrl}`);
    if (req.method !== 'GET' && Object.keys(req.body || {}).length) logBody('Body', sanitize(req.body));
    if (req.query && Object.keys(req.query).length) logBody('Query', sanitize(req.query));

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseCaptured = false;

    res.json = (body) => {
        logBody('Response', sanitize(body));
        responseCaptured = true;
        return originalJson(body);
    };
    res.send = (body) => {
        if (!responseCaptured && body !== undefined) {
            logBody('Response', sanitize(typeof body === 'object' ? JSON.parse(JSON.stringify(body)) : body));
        }
        return originalSend(body);
    };

    res.on('finish', () => {
        if (!responseCaptured) {
            console.log(`    Response: [no JSON body - status ${res.statusCode}]`);
        }
        console.log(`\x1b[90m<<< RESPONSE\x1b[0m ${req.method} ${req.originalUrl} \x1b[${res.statusCode >= 500 ? 31 : res.statusCode >= 400 ? 33 : res.statusCode >= 300 ? 36 : res.statusCode >= 200 ? 32 : 0}m${res.statusCode}\x1b[0m in ${Date.now() - started}ms\n`);
    });

    next();
});

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

app.get('/', (req,res)=>{
    return res.send("Shahparpay never goes down🚀");
})

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
import itrRouter from './routes/itr.route.js';
import paysprintLedgerRouter from './routes/paysprintLedger.route.js';
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
app.use('/api/itr', itrRouter);
app.use('/api/paysprint', paysprintLedgerRouter);

// eSevaTech may call /api/check-agent-wallet at root level by convention
app.all('/api/check-agent-wallet', checkAgentWallet);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT,()=>{
            console.log(`Server is running on port ${PORT}✅`);
            startReconciliationWorker();
        });
    } catch (error) {
        console.log("Failed to connect to database",error.message);
        process.exit(1);
    }
}

startServer();