// Run: node src/utils/rechargeCommission.test.mjs
// The commission slab is keyed on the operator brand. The recharge screens send
// the provider's operator code ("2"), which names no brand, so a slab that only
// matched brand names paid every retailer ₹0. These guard the brand lookup
// against the labels the provider's own operator registry actually returns.
import assert from 'node:assert';
import { getRechargeCommissionRate, getRechargeCommission } from './wallet.util.js';

// Provider labels, not tidy brand names.
assert.strictEqual(getRechargeCommissionRate('BSNL TOPUP', 'prepaid'), 3);
assert.strictEqual(getRechargeCommissionRate('Reliance Jio', 'prepaid'), 0.5);
assert.strictEqual(getRechargeCommissionRate('Airtel Prepaid', 'prepaid'), 1);
assert.strictEqual(getRechargeCommissionRate('Vodafone Idea', 'prepaid'), 2);
assert.strictEqual(getRechargeCommissionRate('MTNL Delhi', 'prepaid'), 4);

assert.strictEqual(getRechargeCommissionRate('Airtel Digital TV', 'dth'), 3);
assert.strictEqual(getRechargeCommissionRate('Videocon D2H', 'dth'), 3);
assert.strictEqual(getRechargeCommissionRate('Dish TV', 'dth'), 3);
assert.strictEqual(getRechargeCommissionRate('Tata Play', 'dth'), 2);
assert.strictEqual(getRechargeCommissionRate('Sun Direct', 'dth'), 3);

// A bare provider code names no brand and must not be guessed at.
assert.strictEqual(getRechargeCommissionRate('2', 'prepaid'), 0);
assert.strictEqual(getRechargeCommissionRate('', 'prepaid'), 0);

// ₹199 on Airtel prepaid is ₹1.99, not ₹0.
assert.strictEqual(getRechargeCommission(199, 'Airtel Prepaid', 'prepaid'), 1.99);
assert.strictEqual(getRechargeCommission(199, '2', 'prepaid'), 0);

console.log('recharge commission slab: all assertions passed');
