import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const TransactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.model('Transaction', TransactionSchema, 'transactions');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const txns = await Transaction.find({ type: 'PAN_CARD', 'metadata.psa_id': 'ANNECHM-808' }).sort({ createdAt: -1 });
    console.log("Found:", txns.length);
    txns.forEach(t => {
        console.log(`ID: ${t._id}, Status: "${t.status}", CreatedAt: ${t.createdAt}, metadata:`, t.metadata);
    });
    process.exit(0);
}
run();
