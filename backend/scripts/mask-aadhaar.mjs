// One-off: mask full Aadhaar numbers already stored on transactions.
// Usage: node scripts/mask-aadhaar.mjs            (dry run, prints the count)
//        node scripts/mask-aadhaar.mjs --apply    (rewrites them as XXXXXXXX1234)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const Transaction = (await import('../src/models/transaction.model.js')).default;

await mongoose.connect(process.env.MONGO_URI);
const filter = { 'metadata.aadhaar': { $regex: /^\d{12}$/ } };
const count = await Transaction.countDocuments(filter);
console.log(`${count} transactions hold a full Aadhaar number`);

if (process.argv.includes('--apply') && count) {
  const result = await Transaction.updateMany(filter, [
    { $set: { 'metadata.aadhaar': { $concat: ['XXXXXXXX', { $substrCP: ['$metadata.aadhaar', 8, 4] }] } } },
  ]);
  console.log(`masked ${result.modifiedCount}`);
}
await mongoose.disconnect();
