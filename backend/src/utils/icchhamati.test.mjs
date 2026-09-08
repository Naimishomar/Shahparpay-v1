// Run: node src/utils/icchhamati.test.mjs
// Icchhamati accepts a recharge or a payout before the operator or the bank
// confirms it, so the funds stay locked while it is pending. Everything here
// guards the one way that can lose money: treating a non-answer as a final
// answer and refunding the retailer for a transaction still being delivered.
import assert from 'node:assert';
import http from 'node:http';
import {
  normaliseStatus,
  fetchPayoutStatus,
  isOk,
  cleanProviderMessage,
  providerMessage,
  makeReferenceId,
  rechargeTypeCode,
  isBillType,
  fetchRechargeStatus,
} from './icchhamati.util.js';

// --- status normalisation -------------------------------------------------

assert.equal(normaliseStatus(1), 'SUCCESS');
assert.equal(normaliseStatus('1'), 'SUCCESS');
assert.equal(normaliseStatus('Success'), 'SUCCESS');
assert.equal(normaliseStatus(2), 'PENDING');
assert.equal(normaliseStatus('Pending'), 'PENDING');
assert.equal(normaliseStatus(0), 'FAILED');
assert.equal(normaliseStatus('Failed'), 'FAILED');

// Pending is not success: the money must not be booked as delivered.
for (const pending of [2, '2', 'PENDING', 'processing', 'Initiated']) {
  assert.equal(normaliseStatus(pending), 'PENDING', `${pending} must stay PENDING`);
}

// --- envelope ok-ness -----------------------------------------------------

assert.ok(isOk({ status: 1 }));
assert.ok(isOk({ status: '1' }));
// Some read endpoints answer with the word instead of the code.
assert.ok(isOk({ status: 'success' }));
assert.ok(!isOk({ status: 0 }));
assert.ok(!isOk({ status: 2 }), 'a pending envelope is not an accepted read');
assert.ok(!isOk({}));
assert.ok(!isOk(null));

// --- provider messages ----------------------------------------------------

assert.equal(cleanProviderMessage('<p> Amount is required </p>'), 'Amount is required');
assert.equal(cleanProviderMessage(undefined), '');

// The gateway answers its own deployment faults with a Laravel exception dump.
// None of it means anything to a retailer, and it leaks the provider's server
// paths through our UI, so the caller's own wording has to win.
const laravelFault = {
  status: 0,
  message: 'Class "App\\Http\\Middleware\\Subscription" not found',
  exception: 'Error',
  file: '/home/icchhamatidataservice/htdocs/app/Http/Middleware/ApiTokenAuth.php',
  line: 270,
};
assert.equal(providerMessage(laravelFault, 'Recharge is unavailable right now.'),
  'Recharge is unavailable right now.');
assert.ok(!providerMessage(laravelFault, '').includes('Middleware'));

// A real operational refusal is specific and useful — pass it through.
assert.equal(
  providerMessage({ status: 0, message: 'Insufficient balance' }, 'fallback'),
  'Insufficient balance'
);
// A missing message must not become the string "undefined" on someone's screen.
assert.equal(providerMessage({ status: 0 }, 'fallback'), 'fallback');

// --- reference ids --------------------------------------------------------

// transactionId is a unique index, so same-millisecond transactions must not
// collide or the second one is rejected before it ever reaches the provider.
const batch = new Set(Array.from({ length: 5000 }, () => makeReferenceId('REC')));
assert.ok(batch.size > 4900, `reference ids collide too often: ${batch.size}/5000 distinct`);
assert.match(makeReferenceId('DMT'), /^DMT\d+$/);

// --- type routing ---------------------------------------------------------

// The `type` code decides which biller gets paid, so a mis-mapped service
// spends a retailer's money on the wrong rail.
assert.equal(rechargeTypeCode('prepaid'), 1);
assert.equal(rechargeTypeCode('dth'), 2);
assert.equal(rechargeTypeCode('DTH'), 2);
// Anything with a bill behind it is a 3, postpaid included.
for (const bill of ['postpaid', 'electricity', 'gas', 'water', 'fastag', 'unknown']) {
  assert.equal(rechargeTypeCode(bill), 3, `${bill} must route as a bill payment`);
  assert.ok(isBillType(bill));
}
assert.ok(!isBillType('prepaid'));
assert.ok(!isBillType('dth'));

// --- status checks never settle on a non-answer ---------------------------

const withServer = async (handler, run) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.ICCHHAMATI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ICCHHAMATI_MID = 'TEST_MID';
  process.env.ICCHHAMATI_MKEY = 'TEST_MKEY';
  try {
    await run();
  } finally {
    server.close();
  }
};

const reply = (body) => (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

await withServer(reply({ status: 1, data: { status: 1 } }), async () => {
  assert.equal((await fetchRechargeStatus('REC1', 'prepaid')).finalStatus, 'SUCCESS');
});

await withServer(reply({ status: 1, data: { status: 0 } }), async () => {
  assert.equal((await fetchRechargeStatus('REC2', 'prepaid')).finalStatus, 'FAILED');
});

// Still pending at the operator: PROCESSING, so the funds stay locked.
await withServer(reply({ status: 2, message: 'Transaction is pending' }), async () => {
  assert.equal((await fetchRechargeStatus('REC3', 'prepaid')).finalStatus, 'PROCESSING');
});

// The gateway refusing the status query says nothing about the recharge itself.
// Refunding here would hand back money for a recharge still being delivered.
await withServer(reply(laravelFault), async () => {
  assert.equal((await fetchRechargeStatus('REC4', 'prepaid')).finalStatus, 'PROCESSING');
});

// A dead gateway is not a failed recharge either.
process.env.ICCHHAMATI_BASE_URL = 'http://127.0.0.1:1';
assert.equal((await fetchRechargeStatus('REC5', 'prepaid')).finalStatus, 'PROCESSING');

// A bill payment is queried on the bill endpoint, not the recharge one.
await withServer((req, res) => {
  assert.equal(req.url, '/api/v2/bill-status');
  reply({ status: 1, data: { status: 1 } })(req, res);
}, async () => {
  assert.equal((await fetchRechargeStatus('BILL1', 'electricity')).finalStatus, 'SUCCESS');
});

// --- payout status: only an exact reference match may settle money ---------

const payouts = (rows) =>
  reply({ status: 1, message: 'Payouts retrieved successfully', data: { data: rows } });

await withServer(payouts([{ transaction_id: 'DMT1', status: 1 }]), async () => {
  assert.equal((await fetchPayoutStatus('DMT1')).finalStatus, 'SUCCESS');
});

await withServer(payouts([{ client_ref_id: 'DMT2', status: 0 }]), async () => {
  assert.equal((await fetchPayoutStatus('DMT2')).finalStatus, 'FAILED');
});

// The bank has not answered yet: the funds stay locked.
await withServer(payouts([{ transaction_id: 'DMT3', status: 2 }]), async () => {
  assert.equal((await fetchPayoutStatus('DMT3')).finalStatus, 'PROCESSING');
});

// The listing has no row for this transfer yet. That is silence, not a failure —
// refunding here hands the retailer back money already on its way.
await withServer(payouts([]), async () => {
  assert.equal((await fetchPayoutStatus('DMT4')).finalStatus, 'PROCESSING');
});

// `search` is the provider's free-text filter, so it returns rows that merely
// mention the reference. Settling against someone else's payout would refund a
// transfer that succeeded, so only an exact match on a reference field counts.
await withServer(
  payouts([
    { transaction_id: 'DMT5000', status: 0 },
    { transaction_id: 'XDMT5', status: 0 },
    { transaction_id: 'DMT5', reference_id: 'DMT5', status: 1 },
  ]),
  async () => {
    assert.equal((await fetchPayoutStatus('DMT5')).finalStatus, 'SUCCESS');
  }
);
await withServer(payouts([{ transaction_id: 'DMT6000', status: 0 }]), async () => {
  assert.equal(
    (await fetchPayoutStatus('DMT6')).finalStatus,
    'PROCESSING',
    'a near-miss reference must never settle a transfer'
  );
});

// The gateway refusing the listing says nothing about the transfer.
await withServer(reply(laravelFault), async () => {
  assert.equal((await fetchPayoutStatus('DMT7')).finalStatus, 'PROCESSING');
});

process.env.ICCHHAMATI_BASE_URL = 'http://127.0.0.1:1';
assert.equal((await fetchPayoutStatus('DMT8')).finalStatus, 'PROCESSING');

console.log('icchhamati: pending transactions never settle on a non-answer OK');
