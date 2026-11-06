// Run: node src/screens/retailer/DashboardScreen.test.mjs
// The dashboard's date ranges must match the web portal's applyDateFilter
// (frontend/src/pages/Dashboard.tsx) day for day.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DashboardScreen.tsx', import.meta.url), 'utf8');
const body = src
  .slice(src.indexOf('export const rangeFor'), src.indexOf('/** Bucket i of'))
  .replace(/export const rangeFor = \(type: string, today = new Date\(\)\) =>/, 'const rangeFor = (type, today = new Date()) =>');

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const rangeFor = new Function('isoDate', `${body}; return rangeFor;`)(isoDate);

const today = new Date(2026, 2, 3, 10); // 3 Mar 2026
assert.deepStrictEqual(rangeFor('Today', today), { start: '2026-03-03', end: '2026-03-03' });
assert.deepStrictEqual(rangeFor('Yesterday', today), { start: '2026-03-02', end: '2026-03-02' });
assert.deepStrictEqual(rangeFor('Last 7 Days', today), { start: '2026-02-24', end: '2026-03-03' });
assert.deepStrictEqual(rangeFor('Last 30 Days', today), { start: '2026-02-01', end: '2026-03-03' });
assert.deepStrictEqual(rangeFor('This Month', today), { start: '2026-03-01', end: '2026-03-03' });
assert.deepStrictEqual(rangeFor('Last Month', today), { start: '2026-02-01', end: '2026-02-28' });
assert.deepStrictEqual(rangeFor('Last Month', new Date(2026, 0, 15)), { start: '2025-12-01', end: '2025-12-31' });

console.log('DashboardScreen ranges: ok');
