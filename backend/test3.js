import 'dotenv/config';
import mongoose from 'mongoose';
import Retailer from './src/models/users/retailer.model.js';
import { fetchAepsBalance } from './src/utils/paysprint.util.js';

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Get any retailer with a retailerId
    const retailer = await Retailer.findOne({ retailerId: { $exists: true, $ne: "" } });
    
    if (retailer) {
        console.log(`Found retailer: ${retailer.name}, Merchant Code: ${retailer.retailerId}`);
        const { generatePaySprintToken } = await import('./src/utils/paysprint.util.js');
        const token = generatePaySprintToken();
        const response = await fetch(`https://api.paysprint.in/api/v1/service/balance/balance/cashbalance`, {
            method: 'POST',
            headers: {
                'Token': token,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ merchant_code: retailer.retailerId })
        });
        const data = await response.json();
        console.log("RAW AEPS PAYSPRINT RESPONSE:", JSON.stringify(data, null, 2));
    } else {
        console.log("No retailer with retailerId found.");
    }
    
    mongoose.disconnect();
}

test();
