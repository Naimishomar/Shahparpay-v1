// Run: node src/controllers/collectWebhook.test.mjs
//
// A counter-QR payment credits a retailer's QR wallet on Icchhamati's say-so.
// Guards the ways that hands out money the platform never received: crediting
// the gross instead of what arrived after Icchhamati's charge, crediting a
// retried callback twice, and paying a retailer for another's virtual account.
import assert from 'node:assert';

const state = { retailers: [], transactions: [], qrWallets: [] };

// In-memory stand-ins; only the operators the handler uses.
const mockModel = (rows, keyOf) => ({
  async findOneAndUpdate(query, update, options = {}) {
    const row = rows.find((entry) => keyOf(entry, query));
    if (row) {
      if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) row[k] = (row[k] || 0) + v;
      return row;
    }
    if (!options.upsert) return null;
    const created = { ...query, ...(update.$setOnInsert || {}) };
    if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) created[k] = (created[k] || 0) + v;
    rows.push(created);
    return options.new ? created : null;
  },
});
const Transaction = mockModel(state.transactions, (row, q) => row.transactionId === q.transactionId);
const QrWallet = mockModel(state.qrWallets, (row, q) => row.userId === q.userId);
const Retailer = {
  find: (query) => ({
    select: () => ({
      limit: async (n) => state.retailers
        .filter((r) => query.$or.some((clause) => {
          const [path, { $in }] = Object.entries(clause)[0];
          return $in.includes(r.collectionQr[path.split('.')[1]]);
        }))
        .slice(0, n),
    }),
  }),
};

// The shipped handler, evaluated with its collections swapped for the fakes:
// the logic under test is the real one, not a copy that can drift.
const collectionWebhook = await (async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./collect.controller.js', import.meta.url), 'utf8');
  const from = src.indexOf('export const collectionWebhook');
  assert.ok(from > -1, 'collectionWebhook must still be exported from collect.controller.js');
  const next = src.indexOf('\nexport const ', from + 1);
  const body = src.slice(from, next === -1 ? undefined : next);
  const { normaliseStatus } = await import('../utils/icchhamati.util.js');
  const money = (value) => Math.round(Number(value) * 100) / 100;
  return new Function(
    'Transaction', 'QrWallet', 'Retailer', 'normaliseStatus', 'money',
    `${body.replace('export const collectionWebhook', 'const collectionWebhook')}; return collectionWebhook;`
  )(Transaction, QrWallet, Retailer, normaliseStatus, money);
})();

const post = async (data) => {
  const out = {};
  await collectionWebhook(
    { body: { type: 'vpa_transaction', data } },
    { status(c) { out.code = c; return this; }, json(b) { out.body = b; return out; } }
  );
  return out;
};

const PAID = {
  vpa_account_id: 'VPA1', vpa_id: 'VPA1', txn_id: 'TXN1', utr: 'UTR1',
  amount: '1000', service_charge_with_gst: '11.8', status: 'success',
};
const balance = (userId) => state.qrWallets.find((w) => w.userId === userId)?.balance ?? 0;

state.retailers.push({ _id: 'ret_1', collectionQr: { virtualAccountId: 'VPA1' } });

// Credited net of Icchhamati's charge, with the gross and charge on record.
{
  const r = await post(PAID);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.status, 1);
  assert.strictEqual(r.body.credited, true);
  assert.strictEqual(balance('ret_1'), 988.2);
  const txn = state.transactions[0];
  assert.strictEqual(txn.amount, 988.2);
  assert.strictEqual(txn.metadata.grossAmount, 1000);
  assert.strictEqual(txn.commissions.chargeDeducted, 11.8);
  assert.strictEqual(txn.metadata.collectionChannel, 'QR');
}

// A retried callback is acknowledged but credits nothing.
{
  const r = await post(PAID);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.credited, false);
  assert.strictEqual(balance('ret_1'), 988.2);
}

// Not a success: acknowledged, nothing credited.
{
  const r = await post({ ...PAID, txn_id: 'TXN2', status: 'failed' });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.credited, false);
  assert.strictEqual(balance('ret_1'), 988.2);
}

// Incomplete notifications are refused.
for (const data of [{ ...PAID, vpa_account_id: '', vpa_id: '' }, { ...PAID, txn_id: '', utr: '' }, { ...PAID, amount: '0' }]) {
  assert.strictEqual((await post(data)).code, 400);
}

// The callback may name the QR by its UPI handle or account number instead.
state.retailers.push({ _id: 'ret_3', collectionQr: { virtualAccountId: 'cva3', upiHandle: '2026111@yesbank', virtualAccountNumber: '1112223' } });
for (const [id, txn] of [['2026111@yesbank', 'TXN5'], ['1112223', 'TXN6']]) {
  const r = await post({ ...PAID, vpa_account_id: id, vpa_id: id, txn_id: txn });
  assert.strictEqual(r.body.credited, true, `matched by ${id}`);
}
assert.strictEqual(balance('ret_3'), 1976.4);

// Nobody owns the account, or two retailers do: nobody is credited.
assert.strictEqual((await post({ ...PAID, vpa_account_id: 'VPA9', vpa_id: 'VPA9', txn_id: 'TXN3' })).code, 404);
state.retailers.push({ _id: 'ret_2', collectionQr: { virtualAccountId: 'VPA1' } });
assert.strictEqual((await post({ ...PAID, txn_id: 'TXN4' })).code, 409);
assert.strictEqual(balance('ret_2'), 0);
assert.strictEqual(state.transactions.length, 3);

console.log('collectWebhook: all assertions passed');
