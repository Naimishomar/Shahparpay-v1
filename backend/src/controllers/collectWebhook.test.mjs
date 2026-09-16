// Run: node src/controllers/collectWebhook.test.mjs
//
// The QR collection webhook mints wallet balance from an unauthenticated POST,
// so everything here guards the two ways that can hand out money that was never
// received: accepting a forged notification, and crediting the same payment
// twice.
import assert from 'node:assert';

const SECRET = 'test-webhook-secret';

// In-memory stand-ins for the two collections the handler writes to. Only the
// operators the handler actually uses are implemented.
const state = { retailers: [], transactions: [], qrWallets: [] };

const mockModel = (rows, keyOf) => ({
  findOne: async (query) => rows.find((row) => keyOf(row, query)) ?? null,
  async findOneAndUpdate(query, update, options = {}) {
    let row = rows.find((entry) => keyOf(entry, query));
    if (!row && options.upsert) {
      // Mongo seeds an upserted document from the query's equality fields.
      row = { _id: `id_${rows.length + 1}`, ...query, ...(update.$setOnInsert || {}) };
      if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) row[k] = (row[k] || 0) + v;
      rows.push(row);
      return options.new ? row : null;
    }
    if (!row) return null;
    Object.assign(row, update.$set || {});
    if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) row[k] = (row[k] || 0) + v;
    return options.new ? row : row;
  },
});

const Transaction = mockModel(state.transactions, (row, q) =>
  (q.transactionId ? row.transactionId === q.transactionId : true) &&
  (q._id ? row._id === q._id : true) &&
  (q.status ? row.status === q.status : true)
);
const QrWallet = mockModel(state.qrWallets, (row, q) => row.userId === q.userId);
const matchVa = (query) => state.retailers.filter(
  (row) => row.collectionQr?.virtualAccountId === query['collectionQr.virtualAccountId']
);
const Retailer = {
  find: (query) => ({ select: () => ({ limit: async (n) => matchVa(query).slice(0, n) }) }),
};

// The real handler, with only its two collections swapped for the fakes above.
// Standing a Mongo up for one function is not worth it, so the handler's source
// is evaluated with those names bound — the logic under test is the shipped
// logic, not a copy that can drift from it.
const collectionWebhook = await (async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./collect.controller.js', import.meta.url), 'utf8');
  const from = src.indexOf('export const collectionWebhook');
  assert.ok(from > -1, 'collectionWebhook must still be exported from collect.controller.js');
  // Stop at the next export, or the handler drags the rest of the module in.
  const next = src.indexOf('\nexport const ', from + 1);
  const body = src.slice(from, next === -1 ? undefined : next);
  const { normaliseStatus } = await import('../utils/icchhamati.util.js');
  return new Function(
    'Transaction', 'QrWallet', 'Retailer', 'normaliseStatus',
    `${body.replace('export const collectionWebhook', 'const collectionWebhook')}; return collectionWebhook;`
  )(Transaction, QrWallet, Retailer, normaliseStatus);
})();

const post = async (body, secret) => {
  const out = {};
  await collectionWebhook(
    { body, get: (h) => (h === 'x-icchhamati-signature' ? secret : undefined) },
    { status(c) { out.code = c; return this; }, json(b) { out.body = b; return out; } }
  );
  return out;
};

const PAID = { virtual_account_id: 'va_1', txnid: 'UTR777', status: 'SUCCESS', amount: 500 };

// --- an unconfigured secret refuses, it does not wave the caller through -----

state.retailers.push({ _id: 'ret_1', collectionQr: { virtualAccountId: 'va_1' } });
delete process.env.ICCHHAMATI_COLLECTION_WEBHOOK_SECRET;
assert.equal((await post(PAID, SECRET)).code, 503, 'no secret configured must refuse, not skip the check');
assert.equal(state.qrWallets.length, 0, 'nothing may be credited while unconfigured');

// --- a wrong or missing signature is refused --------------------------------

process.env.ICCHHAMATI_COLLECTION_WEBHOOK_SECRET = SECRET;
assert.equal((await post(PAID, 'not-the-secret')).code, 401);
assert.equal((await post(PAID, undefined)).code, 401);
assert.equal(state.qrWallets.length, 0, 'a forged notification must credit nothing');

// --- an unmapped virtual account has no owner to credit ---------------------

assert.equal((await post({ ...PAID, virtual_account_id: 'va_unknown' }, SECRET)).code, 404);
assert.equal(state.qrWallets.length, 0);

// --- a genuine payment credits the QR wallet exactly once -------------------

const first = await post(PAID, SECRET);
assert.equal(first.code, 200);
assert.equal(first.body.credited, true);
assert.equal(state.qrWallets.find((w) => w.userId === 'ret_1').balance, 500);

// The provider retries webhooks. A retry must not pay twice.
const retry = await post(PAID, SECRET);
assert.equal(retry.code, 200);
assert.equal(retry.body.credited, false, 'a replayed notification must not credit again');
assert.equal(state.qrWallets.find((w) => w.userId === 'ret_1').balance, 500);

// --- a payment that is not a completed credit is not money ------------------

for (const bad of [
  { ...PAID, txnid: 'UTR888', status: 'FAILED' },
  { ...PAID, txnid: 'UTR889', status: 'PENDING' },
  { ...PAID, txnid: 'UTR890', amount: 0 },
  { ...PAID, txnid: 'UTR891', amount: -100 },
  { ...PAID, txnid: '' },
]) {
  assert.equal((await post(bad, SECRET)).code, 400, `${JSON.stringify(bad)} must not credit`);
}
assert.equal(state.qrWallets.find((w) => w.userId === 'ret_1').balance, 500);

// --- a virtual account two retailers share cannot be attributed -------------
//
// Icchhamati issues one VA per merchant account, so this is reachable in
// practice: crediting "the" owner would pay one retailer for another's takings.
state.retailers.push({ _id: 'ret_2', collectionQr: { virtualAccountId: 'va_1' } });
const shared = await post({ ...PAID, txnid: 'UTR999' }, SECRET);
assert.equal(shared.code, 409, 'a shared virtual account must credit nobody');
assert.equal(state.qrWallets.find((w) => w.userId === 'ret_1').balance, 500, 'balances must be untouched');
assert.ok(!state.qrWallets.find((w) => w.userId === 'ret_2'), 'no wallet may be created for the second claimant');

console.log('collectWebhook: forged, replayed, shared-VA and non-final notifications credit nothing OK');
