import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import Retailer from './src/models/users/retailer.model.js';
import MainWallet from './src/models/mainWallet.model.js';
import AepsWallet from './src/models/aepsWallet.model.js';
import Distributor from './src/models/users/distributor.model.js';

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const retailer = await Retailer.find({ email: 'naimishomar11@gmail.com' });
    if(!retailer){
        console.log("User not found");
        return; 
    }
    const AEPSWallet = await AepsWallet.findOne({ userId: retailer[0]._id });
    if(!AEPSWallet){
        console.log("AEPS Wallet not found");
        return;
    }
    AEPSWallet.balance = 5000;
    await AEPSWallet.save();
    console.log("AEPS wallet updated", AEPSWallet);
    console.log("New balance", AEPSWallet.balance);
    const Mainwallet = await MainWallet.findOne({ userId: retailer[0]._id });
    if(!Mainwallet){
        console.log("Main wallet not found");
        return;
    }
    Mainwallet.balance = 5000;
    await Mainwallet.save();
    console.log("Main wallet updated", Mainwallet);
    console.log("New balance", Mainwallet.balance);
}

run();
