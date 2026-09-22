// Run: node src/controllers/commissionRates.test.mjs
// These rates are published to retailers as what they will earn, so the page
// must never advertise a number the wallet does not actually credit. The
// controller derives everything from wallet.util; this checks it still lines up
// with the functions that do the crediting.
import assert from 'node:assert';
import {
  getAepsWithdrawalCommission,
  getAepsDepositCommission,
  getRechargeCommissionRate,
  getBbpsCommissionRule,
} from '../utils/wallet.util.js';
import { getPublicCommissionRates } from './commission.controller.js';

const res = () => {
  const captured = {};
  return {
    captured,
    status(code) {
      captured.code = code;
      return this;
    },
    json(payload) {
      captured.payload = payload;
      return this;
    },
  };
};

const r = res();
await getPublicCommissionRates({}, r);
assert.strictEqual(r.captured.code, 200);
const data = r.captured.payload.data;

// ------------------------------------------------------------------- AEPS
// Each published slab figure is what the real function pays at that amount.
for (const slab of data.aeps.withdrawal) {
  assert.strictEqual(
    slab.earns,
    getAepsWithdrawalCommission(slab.sample),
    `withdrawal slab "${slab.label}" is out of step with getAepsWithdrawalCommission`
  );
}
for (const slab of data.aeps.deposit) {
  assert.strictEqual(
    slab.earns,
    getAepsDepositCommission(slab.sample),
    `deposit slab "${slab.label}" is out of step with getAepsDepositCommission`
  );
}

// The no-commission floors must stay visible rather than quietly disappear: a
// retailer who does not know about them reads every small withdrawal as a loss.
assert.strictEqual(data.aeps.withdrawal[0].earns, 0, 'the sub-₹300 floor must be shown as ₹0');
assert.strictEqual(data.aeps.deposit[0].earns, 0, 'the sub-₹500 floor must be shown as ₹0');

// TDS is netted off AEPS commission before it reaches the wallet, so the page
// has to carry the rate or the advertised figure overstates the earnings.
assert.strictEqual(data.aeps.tdsPercent, Number(process.env.AEPS_COMMISSION_TDS_RATE || 2));

// -------------------------------------------------------------- recharge
assert.ok(data.prepaid.length >= 5 && data.dth.length >= 5);
for (const op of data.prepaid) {
  assert.ok(op.percent > 0, `${op.name} published at 0% — the probe label no longer matches`);
}
for (const op of data.dth) {
  assert.ok(op.percent > 0, `${op.name} published at 0% — the probe label no longer matches`);
}
// Spot-check against the source of truth.
assert.strictEqual(data.prepaid.find((o) => o.name === 'BSNL').percent, getRechargeCommissionRate('BSNL TOPUP', 'prepaid'));
assert.strictEqual(data.dth.find((o) => o.name === 'Tata Play').percent, getRechargeCommissionRate('Tata Play', 'dth'));

// Highest first reads as a rate card rather than an arbitrary list.
const descending = (list) => list.every((o, i) => i === 0 || list[i - 1].percent >= o.percent);
assert.ok(descending(data.prepaid), 'prepaid rates should be listed best-paying first');
assert.ok(descending(data.dth), 'DTH rates should be listed best-paying first');

// ------------------------------------------------------------------- BBPS
for (const row of data.bbps) {
  assert.ok(['flat', 'percent'].includes(row.kind), `${row.name} has an unknown rate kind`);
  assert.ok(row.value > 0, `${row.name} published at zero`);
}
const electricity = data.bbps.find((b) => b.name === 'Electricity');
const rule = getBbpsCommissionRule('electricity');
assert.strictEqual(electricity.kind, rule.kind);
assert.strictEqual(electricity.value, rule.value);

// --------------------------------------------------------------- on request
// Services without a rate card must be named, not omitted.
assert.ok(data.onRequest.includes('Domestic Money Transfer (DMT)'));
assert.ok(data.onRequest.length > 0);

console.log('commissionRates: published rates match the wallet functions that pay them');
