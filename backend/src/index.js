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
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

app.get('/', (req,res)=>{
    return res.send("Hello World");
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

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT,()=>{
            console.log(`Server is running on port ${PORT}✅`);
        });
    } catch (error) {
        console.log("Failed to connect to database",error.message);
        process.exit(1);
    }
}

startServer();