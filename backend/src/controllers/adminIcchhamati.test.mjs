// Run: node src/controllers/adminIcchhamati.test.mjs
import assert from 'node:assert';
import { toWallet, toLedgerRow, getWallets, getWalletLedger, getProviderUpiCwHistory } from './adminIcchhamati.controller.js';

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
  { id: 373499, details: 'Pan Verification', type: 'DR', amount: 4, preBalance: 258.28, balance: 16254.28, date: '2026-11-28 10:03:19' },
);

let ledgerCode;
await getWalletLedger({ user: { role: 'distributor' }, params: { id: '2670' }, query: {} }, { status: (c) => ((ledgerCode = c), { json: () => {} }) });
assert.equal(ledgerCode, 403);
await getWalletLedger({ user: { role: 'admin' }, params: { id: '../payouts' }, query: {} }, { status: (c) => ((ledgerCode = c), { json: () => {} }) });
assert.equal(ledgerCode, 400, 'wallet id never reaches the provider path unless numeric');

console.log('adminIcchhamati tests passed');
