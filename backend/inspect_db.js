import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import Retailer from './src/models/users/retailer.model.js';
import MainWallet from './src/models/mainWallet.model.js';

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const retailer = await Retailer.find({ email: 'saudalamcsc@gmail.com' });
    if(!retailer){
        console.log("User not found");
        return; 
    }
    const wallet = await MainWallet.findOne({ userId: retailer[0]._id });
    if(!wallet){
        console.log("Wallet not found");
        return;
    }
    wallet.balance = 100;
    await wallet.save();
    console.log("Main wallet updated", wallet);
    console.log("New balance", wallet.balance);
}

run();
