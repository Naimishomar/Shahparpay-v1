import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/naimi/OneDrive/Desktop/Shahparpay-v1/backend/.env' });
import { MongoClient } from 'mongodb';

async function resetKyc() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    const code = "A2ZB1004";
    const retailer = await db.collection('retailers').findOneAndUpdate({ retailerId: code }, { $set: { isMerchantKycComplete: false } });
    const dist = await db.collection('distributors').findOneAndUpdate({ distributorId: code }, { $set: { isMerchantKycComplete: false } });
    console.log("Reset successful. Retailer:", !!retailer, "Distributor:", !!dist);
    await client.close();
    process.exit(0);
}
resetKyc();
