import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

const app = express();
dotenv.config({quiet: true});
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

app.get('/', (req,res)=>{
    return res.send("Hello World");
})

import aepsRoutes from './routes/aeps.route.js';
app.use('/api/aeps', aepsRoutes);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT,()=>{
            console.log(`Server is running on port http://localhost:${PORT}`);
        });
    } catch (error) {
        console.log("Failed to connect to database",error.message);
        process.exit(1);
    }
}

startServer();