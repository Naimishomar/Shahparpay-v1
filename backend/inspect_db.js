import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import Retailer from './src/models/users/retailer.model.js';
import MainWallet from './src/models/mainWallet.model.js';
import AepsWallet from './src/models/aepsWallet.model.js';

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const retailer = await Retailer.find({ retailerId: 'A2ZB1004' });
    if(!retailer){
        console.log("User not found");
        return; 
    }
    const wallet = await AepsWallet.findOne({ userId: retailer[0]._id });
    if(!wallet){
        console.log("Wallet not found");
        return;
    }
    wallet.balance = 3514.43;
    await wallet.save();
    console.log("AEPS wallet updated", wallet);
    console.log("New balance", wallet.balance);
}

run();
