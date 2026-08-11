import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const Retailer = (await import('../src/models/users/retailer.model.js')).default;
const MainWallet = (await import('../src/models/mainWallet.model.js')).default;
const AepsWallet = (await import('../src/models/aepsWallet.model.js')).default;
const Transaction = (await import('../src/models/transaction.model.js')).default;

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const retailer = await Retailer.findOne({ retailerId: 'A2ZB1004' }).lean();
    if (!retailer) { console.log('Retailer not found'); process.exit(); }
    console.log('Retailer:', retailer.retailerId, '| _id:', retailer._id.toString(), '| distributorId:', retailer.distributorId);

    const main = await MainWallet.findOne({ userId: retailer._id }).lean();
    const aeps = await AepsWallet.findOne({ userId: retailer._id }).lean();
    console.log('MainWallet.balance =', main?.balance, '| AepsWallet.balance =', aeps?.balance);
    if (main) console.log('MainWallet createdAt/updatedAt:', main.createdAt, main.updatedAt);

    const txns = await Transaction.find({ userId: retailer._id }).sort({ createdAt: 1 }).lean();
    console.log('\n=== ALL TRANSACTIONS ===');
    let runningAeps = 0;
    let runningMain = 0;
    for (const t of txns) {
        console.log(
            t.createdAt.toISOString(),
            '|', t.type.padEnd(22),
            '| status', String(t.status).padEnd(10),
            '| amount', (t.amount ?? 0).toFixed(2).padStart(10),
            '| comm', (t.commissions?.retailerEarned ?? 0).toFixed(2).padStart(7),
            '| txnId', String(t.transactionId).padEnd(22),
            '| meta.ps', t.metadata?.paysprintRef || '',
            '| meta.refundStatus', t.metadata?.refundStatus || '',
            '| meta.orig', t.metadata?.originalTxn || ''
        );
    }
    console.log('\ntotal txns:', txns.length);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });