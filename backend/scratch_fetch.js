import mongoose from 'mongoose';
import Transaction from './src/models/transaction.model.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const txns = await Transaction.find().sort({createdAt: -1}).limit(5);
    console.log(JSON.stringify(txns, null, 2));
    process.exit(0);
}
run();
