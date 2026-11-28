// Run: node src/controllers/adminIcchhamati.test.mjs
import assert from 'node:assert';
import { toWallet, toLedgerRow, getWallets, getWalletLedger, getProviderUpiCwHistory, reconcileDay, getStatusCheck, setLowBalanceAlert } from './adminIcchhamati.controller.js';
import { parseLedgerDetails, pickMatch } from '../utils/icchhamatiLedger.js';
import { lowBalanceChanges } from '../workers/icchhamatiBalance.worker.js';

// Shape as the live /api/accounts answers.
const wallet = toWallet({
  id: 2670, name: 'Utility Wallet', number: '****0985', balance: '₹295', available_balance: '₹295',
  hold_amount: '₹0.00', status: 1, is_primary: false, full_number: '8240039776260985', upi: '8240039776-1@bp',
  raw_balance: '295.25', raw_available_balance: 295.25, raw_hold_amount: '0.00',
});
assert.deepEqual(wallet, {
  id: 2670, name: 'Utility Wallet', number: '****0985', isPrimary: false,
  balance: 295.25, available: 295.25, hold: 0, active: true,
});
assert.ok(!('full_number' in wallet) && !('upi' in wallet), 'full account number and UPI never leave the server');

// The company's float is for admins only.
let code;
await getWallets({ user: { role: 'retailer' } }, { status: (c) => ((code = c), { json: () => {} }) });
assert.equal(code, 403);

let cwCode;
await getProviderUpiCwHistory({ user: { role: 'retailer' } }, { status: (c) => ((cwCode = c), { json: () => {} }) });
assert.equal(cwCode, 403);

// Shape as the live /api/accounts/:id statement answers.
assert.deepEqual(
  toLedgerRow({ id: 373499, details: 'Pan Verification', type: 'DR', pre_balance: '258.28', amount: '-₹4.00', balance: '₹16,254.28', date: '2026-11-28 10:03:19' }),
  { id: 373499, details: 'Pan Verification', type: 'DR', amount: 4, preBalance: 258.28, balance: 16254.28, date: '2026-11-28 10:03:19', label: 'Pan Verification', role: 'internal', ref: null },
);

let ledgerCode;
await getWalletLedger({ user: { role: 'distributor' }, params: { id: '2670' }, query: {} }, { status: (c) => ((ledgerCode = c), { json: () => {} }) });
assert.equal(ledgerCode, 403);
await getWalletLedger({ user: { role: 'admin' }, params: { id: '../payouts' }, query: {} }, { status: (c) => ((ledgerCode = c), { json: () => {} }) });
assert.equal(ledgerCode, 400, 'wallet id never reaches the provider path unless numeric');

// --------------------------------------------- statement lines, as seen live
const parsed = (d) => parseLedgerDetails(d);
assert.deepEqual(parsed('CW - Transaction 568948004766'), { label: 'AEPS cash withdrawal', role: 'principal', ref: '568948004766' });
assert.deepEqual(parsed('CW - Commission 568948004766'), { label: 'AEPS cash withdrawal', role: 'commission', ref: '568948004766' });
assert.deepEqual(parsed('UPICW - Transaction UPICW20261128094531323'), { label: 'UPI cash withdrawal', role: 'principal', ref: 'UPICW20261128094531323' });
assert.deepEqual(parsed('Bill Payment - 67000290849'), { label: 'Bill Payment', role: 'principal', ref: '67000290849' });
assert.deepEqual(parsed('Bill Payment Commission - 67000290849'), { label: 'Bill Payment', role: 'commission', ref: '67000290849' });
assert.deepEqual(parsed('Bill Payment Failed & Refunded - 67000077784'), { label: 'Bill Payment', role: 'refund', ref: '67000077784' });
assert.deepEqual(parsed('Mobile Recharge - 6289089773'), { label: 'Mobile Recharge', role: 'principal', ref: '6289089773' });
assert.deepEqual(parsed('Recharge Commission - 6289089773'), { label: 'Recharge', role: 'commission', ref: '6289089773' });
assert.deepEqual(parsed('MOVE_TO - 426820110000415'), { label: 'Payout', role: 'principal', ref: '426820110000415' });
assert.deepEqual(parsed('MOVE_TO Charge 426820110000415'), { label: 'Payout charge', role: 'charge', ref: '426820110000415' });
assert.deepEqual(parsed('MOVE_TO Failed & Refund - 426820110000415'), { label: 'Payout', role: 'refund', ref: '426820110000415' });
assert.deepEqual(parsed('Refund of Move to Charge 426820110000415'), { label: 'Payout charge', role: 'refund', ref: '426820110000415' });
assert.deepEqual(parsed('Easebuzz Payment TxnID: PG7951472146370365'), { label: 'Payment gateway', role: 'principal', ref: 'PG7951472146370365' });
assert.deepEqual(parsed('Account Verification - 426820110000415'), { label: 'Account verification', role: 'charge', ref: '426820110000415' });
assert.equal(parsed('TDS').role, 'tds');
assert.equal(parsed('VPA Credit Charge').role, 'charge');
assert.deepEqual(parsed('Self Transfer from Primary Account'), { label: 'Self Transfer from Primary Account', role: 'internal', ref: null });

// A customer number repeats: the same amount wins, then the closest in time.
const bills = [
  { _id: 'a', amount: 500, createdAt: '2026-11-28T05:00:00Z', metadata: { caNumber: '67000290849' } },
  { _id: 'b', amount: 100, createdAt: '2026-11-28T09:00:00Z', metadata: { caNumber: '67000290849' } },
  { _id: 'c', amount: 100, createdAt: '2026-11-20T09:00:00Z', metadata: { caNumber: 67000290849 } },
];
const line = { ref: '67000290849', role: 'principal', amount: 100, date: '2026-11-28 14:31:00' };
assert.equal(pickMatch(line, bills)._id, 'b');
assert.equal(pickMatch(line, bills, new Set(['b']))._id, 'c', 'a number stored as a number still matches');
assert.equal(pickMatch({ ...line, ref: null }, bills), null);

// ------------------------------------------------------------ reconciliation
const t = (id, status, amount, extra = {}) => ({ _id: id, transactionId: id, type: 'AEPS_WITHDRAWAL', status, amount, createdAt: '2026-11-28T08:00:00Z', metadata: { bankRRN: id }, ...extra });
const e = (ref, amount, details = 'CW - Transaction') => ({ id: ref, ref, amount, type: 'CR', role: 'principal', date: '2026-11-28 13:30:00', details: `${details} ${ref}`, wallet: 'Trade Wallet' });
const rec = reconcileDay({
  day: '2026-11-28',
  entries: [e('R1', 2000), e('R2', 1000), e('R3', 500), e('R4', 300), e('R5', 100), { ...e('R5', 100), role: 'refund' }, e('R6', 900)],
  candidates: [t('R1', 'SUCCESS', 2000), t('R2', 'PROCESSING', 1000), t('R3', 'FAILED', 500), t('R4', 'SUCCESS', 400), t('R5', 'FAILED', 100)],
  ours: [t('R1', 'SUCCESS', 2000), t('R7', 'SUCCESS', 700)],
  now: Date.parse('2026-11-29T00:00:00Z'),
});
const kinds = Object.fromEntries(rec.issues.map((i) => [i.entry?.ref || i.ours.transactionId, i.kind]));
assert.equal(rec.matched, 2, 'R1 matches, and R5 failed with a refund line is consistent');
assert.deepEqual(kinds, { R2: 'stuck_ours', R3: 'failed_ours', R4: 'amount', R6: 'missing_ours', R7: 'missing_theirs' });
// Created in the last minutes of the day: may be booked tomorrow at Icchhamati, so not flagged.
assert.equal(
  reconcileDay({ day: '2026-11-28', entries: [], candidates: [], ours: [t('late', 'SUCCESS', 1, { createdAt: '2026-11-28T18:25:00Z' })], now: Date.parse('2026-11-30T00:00:00Z') }).issues.length,
  0
);

// ---------------------------------------------------------- low-balance alert
const w = (id, available) => ({ id, name: `W${id}`, available });
let state = lowBalanceChanges([w(1, 900), w(2, 5000)], { thresholds: { 1: 1000, 2: 1000 }, alerted: {} }, new Date('2026-11-28T00:00:00Z'));
assert.deepEqual(state.crossed.map((x) => x.id), [1]);
state = lowBalanceChanges([w(1, 800)], { thresholds: { 1: 1000 }, alerted: state.alerted });
assert.equal(state.crossed.length, 0, 'one alert per drop, not one every ten minutes');
state = lowBalanceChanges([w(1, 1500)], { thresholds: { 1: 1000 }, alerted: state.alerted });
assert.deepEqual(state.alerted, {}, 'back above the line re-arms the alert');

// Admin only.
for (const handler of [getStatusCheck, setLowBalanceAlert]) {
  let c;
  await handler({ user: { role: 'retailer' }, query: {}, body: {} }, { status: (x) => ((c = x), { json: () => {} }) });
  assert.equal(c, 403);
}

console.log('adminIcchhamati tests passed');
