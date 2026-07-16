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
    origin: ['http://localhost:5173', 'https://shahparpay-v1.vercel.app'],
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