// Run: node src/utils/bharatpays.test.mjs
// BharatPays accepts a recharge before the operator confirms it, so the funds
// stay locked while it is PENDING. Everything here guards the one way that can
// lose money: treating a non-answer as a final answer, refunding the retailer
// for a recharge the operator still goes on to deliver.
import assert from 'node:assert';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import {
  normaliseStatus,
  fetchBharatPaysStatus,
  paysprintPlanOperator,
  BHARATPAYS_OPERATORS,
  BHARATPAYS_TYPES,
} from './bharatpays.util.js';

// --- status normalisation -------------------------------------------------

assert.equal(normaliseStatus('SUCCESS'), 'SUCCESS');
assert.equal(normaliseStatus('success'), 'SUCCESS');
assert.equal(normaliseStatus('FAILED'), 'FAILED');
// A provider-side reversal is a failure for us: the retailer gets the money back.
assert.equal(normaliseStatus('REFUNDED'), 'FAILED');
assert.equal(normaliseStatus('PENDING'), 'PENDING');

// An unrecognised or missing status must never settle money in either direction.
for (const unknown of ['', null, undefined, 'QUEUED', 'IN_PROCESS', 'whatever']) {
  assert.equal(normaliseStatus(unknown), 'PENDING', `${unknown} must not auto-settle`);
}

// --- status check never refunds on a non-answer ---------------------------

let reply;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(reply));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

process.env.BHARATPAYS_TOKEN = 'test-token';
process.env.BHARATPAYS_RECHARGE_BASE_URL = `http://127.0.0.1:${server.address().port}`;

const check = async (body) => {
  reply = body;
  return (await fetchBharatPaysStatus('123456')).finalStatus;
};

assert.equal(await check({ success: 1, data: { status: 'SUCCESS' } }), 'SUCCESS');
assert.equal(await check({ success: 1, data: { status: 'FAILED' } }), 'FAILED');
assert.equal(await check({ success: 1, data: { status: 'REFUNDED' } }), 'FAILED');

// Still running at the operator: hold the funds, do not refund.
assert.equal(await check({ success: 1, data: { status: 'PENDING' } }), 'PROCESSING');

// The provider could not answer. Refunding here would hand back money for a
// recharge that may still land, so the funds stay locked for the next run.
assert.equal(await check({ success: 0, message: 'Order not found' }), 'PROCESSING');
assert.equal(await check({}), 'PROCESSING');
assert.equal(await check({ success: 1, data: {} }), 'PROCESSING');

// Provider unreachable is also a non-answer, not a failure.
process.env.BHARATPAYS_RECHARGE_BASE_URL = 'http://127.0.0.1:1';
assert.equal((await fetchBharatPaysStatus('123456')).finalStatus, 'PROCESSING');

server.close();

// --- operator table -------------------------------------------------------

const ids = BHARATPAYS_OPERATORS.map((op) => op.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate operator codes would route recharges twice');
assert.ok(
  ids.every((id) => Number.isInteger(id)),
  'operator codes go on the query string as integers'
);

for (const type of BHARATPAYS_TYPES) {
  const category = { prepaid: 'Prepaid', postpaid: 'Postpaid', dth: 'DTH' }[type];
  assert.ok(
    BHARATPAYS_OPERATORS.some((op) => op.category === category),
    `${type} would render an empty operator list`
  );
}

// Plan and DTH-info lookups still run on Paysprint, so every code carrying a
// `plan` name has to map back to one, and an unknown code must map to nothing
// rather than silently quoting plans for the wrong network.
assert.equal(paysprintPlanOperator(12), 'Airteldth');
assert.equal(paysprintPlanOperator('12'), 'Airteldth');
assert.equal(paysprintPlanOperator(366), 'Jio');
assert.equal(paysprintPlanOperator(99999), null);
assert.equal(paysprintPlanOperator(undefined), null);
// Codes with no Paysprint counterpart (Big TV, Zing) must not borrow another's.
assert.equal(paysprintPlanOperator(9), null);

// --- the reconciliation cron asks before it refunds ------------------------

// Without this branch a PENDING recharge falls through to the worker's default,
// which FAILs and refunds anything left PROCESSING for five minutes.
const worker = readFileSync(new URL('../workers/reconciliation.worker.js', import.meta.url), 'utf8');
assert.ok(
  /txn\.type === 'RECHARGE'[\s\S]{0,500}fetchBharatPaysStatus/.test(worker),
  'reconciliation cron must resolve RECHARGE against BharatPays, not auto-refund it'
);

console.log('bharatpays.test.mjs: all assertions passed');
