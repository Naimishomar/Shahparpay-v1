// Run: node src/controllers/adminIcchhamati.test.mjs
import assert from 'node:assert';
import { toWallet, getWallets } from './adminIcchhamati.controller.js';

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

console.log('adminIcchhamati tests passed');
