// Run: node src/controllers/rechargeBillers.test.mjs
//
// Icchhamati's biller registry matches a category name exactly and answers an
// unknown one with `status: 1` and an empty list — a refusal that looks like a
// success. Rewriting the provider's own category names into tidier ones of our
// own ("Water" for "Water Supplier", "Loan" for "Loan Repayment",
// "MobilePrepaid" for "Prepaid") therefore emptied most of the BBPS screen
// without any call ever failing. These guard the two things that hid it.
import assert from 'node:assert';
import http from 'node:http';
import { OPERATOR_CATEGORY } from '../utils/icchhamati.util.js';
import { operatorSource, getBillCategories } from './recharge.controller.js';

// --- the operator registry answers to these three names and no others ------

assert.deepEqual(OPERATOR_CATEGORY, { prepaid: 'Prepaid', postpaid: 'Postpaid', dth: 'DTH' });

for (const [ours, theirs] of Object.entries(OPERATOR_CATEGORY)) {
  assert.deepEqual(operatorSource(ours), { kind: 'operator', category: theirs });
  // A screen that already holds the provider's spelling must route the same way.
  assert.deepEqual(operatorSource(theirs), { kind: 'operator', category: theirs });
}

// --- every other category goes to the biller registry, verbatim ------------

for (const category of ['Water', 'Water Supplier', 'Loan Repayment', 'Clubs & Associates', 'Muncipal Services']) {
  assert.deepEqual(
    operatorSource(category),
    { kind: 'biller', category },
    `${category} must reach the provider unrewritten`
  );
}
assert.equal(operatorSource('  Electric  ').category, 'Electric');
assert.equal(operatorSource('').category, null);

// --- every published category is listed, and says whether it can be opened -

const withProvider = async (handler, run) => {
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

const call = async (fn) => {
  const out = {};
  await fn({ params: {}, body: {} }, {
    status(code) { out.code = code; return this; },
    json(body) { out.body = body; return out; },
  });
  return out;
};

// Category names as the provider actually publishes them, with the biller
// counts it actually has behind them.
const CATEGORIES = [
  { id: 5, name: 'Electricity', category: 'Electric', label: 'Consumer Number' },
  { id: 9, name: 'Water Supplier', category: 'Water Supplier', label: 'Consumer Number' },
  { id: 23, name: 'Water', category: 'Water', label: 'Consumer Number' },
  { id: 14, name: 'Loan', category: 'Loan Repayment', label: 'Loan Account Number' },
  { id: 4, name: 'Postpaid', category: 'Mobile Postpaid', label: 'Mobile Number' },
];
const BILLERS = {
  Electric: [{ code: '323', name: 'Adani Electricity', is_active: true }],
  Water: [
    { code: 'AMCW', name: 'Ahmedabad Municipal Corporation', is_active: true },
    { code: '', name: 'Unpickable, has no code', is_active: true },
    { code: 'OFF', name: 'Withdrawn biller', is_active: false },
  ],
  'Loan Repayment': [{ code: '2567', name: 'Aditya Birla Housing Finance', is_active: true }],
};

const provider = (categories, billers) => (req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/v2/bill-categories')) {
      return res.end(JSON.stringify({ status: 1, categories }));
    }
    const { category } = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    return res.end(JSON.stringify(billers(category)));
  });
};

await withProvider(provider(CATEGORIES, (category) => ({ status: 1, billers: BILLERS[category] || [] })), async () => {
  const { code, body } = await call(getBillCategories);
  assert.equal(code, 200);
  const ids = body.data.map((row) => row.id);
  const byId = (id) => body.data.find((row) => row.id === id);

  // Every category the provider publishes survives, under the provider's own
  // name, unrewritten — that name is what the next call has to send back.
  // Nothing is dropped: a missing tile reads as our bug, not their registry.
  assert.deepEqual(ids, ['Electric', 'Water Supplier', 'Water', 'Loan Repayment', 'Postpaid']);

  // "Water Supplier" and "Water" used to collapse onto one tile and the empty
  // one won, so Water showed nothing. They are now two tiles, and only the one
  // with billers opens.
  assert.equal(byId('Water Supplier').available, false);
  assert.equal(byId('Water').available, true);
  assert.equal(byId('Water').billerCount, 1, 'a biller with no code cannot be picked, and an inactive one is gone');

  // Postpaid is billed like a utility but is listed with the operators, so the
  // provider's own category row for it is empty and it is offered separately.
  assert.ok(!ids.includes('Mobile Postpaid'), 'the empty biller-registry row is not a second tile');
  assert.equal(byId('Postpaid').available, true);
  assert.equal(byId('Postpaid').name, 'Postpaid');
  assert.equal(operatorSource('Postpaid').kind, 'operator');

  assert.equal(byId('Electric').label, 'Consumer Number');
});

// A provider that refuses the biller lookup must not empty the screen: an
// unanswered category is kept, because "we could not ask" is not "there is
// nothing here".
// Names of their own, because a biller list is only cached once it is answered
// and these must actually reach the refusing provider.
const OUTAGE_CATEGORIES = [
  { name: 'Cable', category: 'Cable' },
  { name: 'Fastag', category: 'Fastag' },
];

await withProvider(
  provider(OUTAGE_CATEGORIES, () => ({ status: 0, message: 'Service temporarily unavailable' })),
  async () => {
    const { body } = await call(getBillCategories);
    for (const { category } of OUTAGE_CATEGORIES) {
      const row = body.data.find((entry) => entry.id === category);
      assert.ok(row, `${category} must survive a refused lookup`);
      assert.equal(row.available, true, 'a provider we could not ask is not a provider with nothing');
    }
  }
);

console.log('rechargeBillers: every category is listed, under the provider\'s own name OK');
