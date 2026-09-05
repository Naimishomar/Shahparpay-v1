// Run: node src/screens/retailer/DashboardScreen.test.mjs
// Home shows a retailer what they earned today. Getting the day boundary or
// the refund rule wrong misstates real money, so the bucketing is checked here.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DashboardScreen.tsx', import.meta.url), 'utf8');
const body = src
  .slice(src.indexOf('export const bucketByDay'), src.indexOf('export const DashboardScreen'))
  .replace('export const bucketByDay = (transactions: any[], keys: string[]) => {', 'const bucketByDay = (transactions, keys) => {')
  .replace('const byDay = new Map<string, { commission: number; count: number; rows: any[] }>();', 'const byDay = new Map();');

// Same local-date formatter the screen imports from Screen.tsx.
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const bucketByDay = new Function('isoDate', `${body}; return bucketByDay;`)(isoDate);

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d;
};
const at = (offset, hour, minute = 0) => {
  const d = day(offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const keys = [2, 1, 0].map((offset) => isoDate(day(offset)));

const rows = [
  { transactionId: 'T1', status: 'SUCCESS', createdAt: at(0, 10), commissions: { retailerEarned: 12.5 } },
  { transactionId: 'T2', status: 'SUCCESS', createdAt: at(0, 23, 45), commissions: { retailerEarned: 7.5 } },
  // Failed: shown in the list, never counted as earnings.
  { transactionId: 'T3', status: 'FAILED', createdAt: at(0, 11), commissions: { retailerEarned: 99 } },
  // A refund reverses T1's sale — its commission must not be counted again.
  { transactionId: 'REFUND-T1', status: 'SUCCESS', createdAt: at(0, 12), commissions: { retailerEarned: 12.5 } },
  { transactionId: 'T4', status: 'SUCCESS', createdAt: at(1, 9), commissions: { retailerEarned: 5 } },
  // Outside the window: dropped entirely.
  { transactionId: 'T5', status: 'SUCCESS', createdAt: at(9, 9), commissions: { retailerEarned: 500 } },
];

const byDay = bucketByDay(rows, keys);
const today = byDay.get(keys[2]);
const yesterday = byDay.get(keys[1]);
const older = byDay.get(keys[0]);

assert.strictEqual(today.commission, 20, 'today counts only successful, non-refund earnings');
assert.strictEqual(today.count, 2, 'failed and refund rows are not earning transactions');
assert.strictEqual(today.rows.length, 4, 'every row of the day still shows in the list');
assert.strictEqual(yesterday.commission, 5);
assert.strictEqual(older.commission, 0);
assert.strictEqual(older.rows.length, 0, 'rows outside the window are dropped');

// A late-evening transaction belongs to its LOCAL day. With toISOString-based
// bucketing this lands on tomorrow in IST and today's earnings read short.
const late = { transactionId: 'T6', status: 'SUCCESS', createdAt: at(0, 23, 59), commissions: { retailerEarned: 3 } };
assert.strictEqual(bucketByDay([late], keys).get(keys[2]).commission, 3, 'late-night rows stay on the local day');

console.log('Dashboard: day-wise commission bucketing OK');
