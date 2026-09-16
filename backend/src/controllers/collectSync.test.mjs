// Run: node src/controllers/collectSync.test.mjs
//
// A payment link used to settle only while the retailer had the Collect page
// open. The reconciliation cron now asks /api/pg/verify for the same orders, so
// this guards the two ways that can go wrong unattended: crediting an order the
// customer never paid, and failing one they did.
import assert from 'node:assert';
import http from 'node:http';

const state = { transactions: [], qrWallets: [] };

const Transaction = {
  async findOneAndUpdate(query, update, options = {}) {
    const row = state.transactions.find(
      (t) => t._id === query._id && (!query.status || t.status === query.status)
    );
    if (!row) return null;
    Object.assign(row, update.$set || {});
    return options.new ? row : row;
  },
  async findById(id) {
    return state.transactions.find((t) => t._id === id) ?? null;
  },
};
const QrWallet = {
  async findOneAndUpdate(query, update) {
    let row = state.qrWallets.find((w) => w.userId === query.userId);
    if (!row) { row = { ...query, ...(update.$setOnInsert || {}), balance: 0 }; state.qrWallets.push(row); }
    for (const [k, v] of Object.entries(update.$inc || {})) row[k] = (row[k] || 0) + v;
    return row;
  },
};

// The real helper, with its two collections swapped for the fakes above.
const syncCollectionTransaction = await (async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./collect.controller.js', import.meta.url), 'utf8');
  const from = src.indexOf('export const syncCollectionTransaction');
  assert.ok(from > -1, 'syncCollectionTransaction must still be exported for the cron to use');
  const next = src.indexOf('\nexport const ', from + 1);
  const body = src.slice(from, next === -1 ? undefined : next);
  const { icchhamatiPost, isOk, normaliseStatus } = await import('../utils/icchhamati.util.js');
  return new Function(
    'Transaction', 'QrWallet', 'icchhamatiPost', 'isOk', 'normaliseStatus',
    `${body.replace('export const syncCollectionTransaction', 'const syncCollectionTransaction')}; return syncCollectionTransaction;`
  )(Transaction, QrWallet, icchhamatiPost, isOk, normaliseStatus);
})();

const withGateway = async (reply, run) => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(reply));
  });
  await new Promise((r) => server.listen(0, r));
  process.env.ICCHHAMATI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ICCHHAMATI_MID = 'TEST_MID';
  process.env.ICCHHAMATI_MKEY = 'TEST_MKEY';
  try { await run(); } finally { server.close(); }
};

const newOrder = (id) => {
  const txn = { _id: id, transactionId: id, userId: 'ret_1', amount: 250, status: 'PENDING', metadata: {} };
  state.transactions.push(txn);
  return txn;
};
const balance = () => state.qrWallets.find((w) => w.userId === 'ret_1')?.balance ?? 0;

// --- an unpaid order stays PENDING and credits nothing ----------------------
//
// This is the shape the live gateway returns for an unpaid link:
// {"status":1,"message":"Payment Status fetched","data":{"status":"pending"}}
await withGateway({ status: 1, message: 'Payment Status fetched', data: { txnid: 'A', status: 'pending' } }, async () => {
  const { transaction } = await syncCollectionTransaction(newOrder('A'));
  assert.equal(transaction.status, 'PENDING');
  assert.equal(balance(), 0);
});

// --- a paid order credits the QR wallet exactly once ------------------------
await withGateway({ status: 1, data: { txnid: 'B', status: 'success' } }, async () => {
  const order = newOrder('B');
  const { transaction } = await syncCollectionTransaction(order);
  assert.equal(transaction.status, 'SUCCESS');
  assert.equal(balance(), 250);

  // The cron and the retailer's own page can both land on the same order.
  const again = await syncCollectionTransaction(order);
  assert.equal(again.transaction.status, 'SUCCESS');
  assert.equal(balance(), 250, 'a second pass must not credit twice');
});

// --- a gateway that cannot answer leaves the order open, never failed -------
//
// Marking a paid order FAILED would lose the retailer the money, and an inflow
// locks nothing, so a non-answer costs only another pass.
for (const reply of [
  { status: 0, message: 'Invalid Transaction', data: null },
  { status: 0, message: 'Service temporarily unavailable' },
]) {
  await withGateway(reply, async () => {
    const { transaction } = await syncCollectionTransaction(newOrder(`C${Math.random()}`));
    assert.equal(transaction.status, 'PENDING', `${JSON.stringify(reply)} must not fail the order`);
  });
}
assert.equal(balance(), 250);

// --- a refused payment is final and credits nothing -------------------------
await withGateway({ status: 1, data: { txnid: 'D', status: 'failed' } }, async () => {
  const { transaction } = await syncCollectionTransaction(newOrder('D'));
  assert.equal(transaction.status, 'FAILED');
  assert.equal(balance(), 250);
});

console.log('collectSync: unpaid and unanswered orders stay open, paid ones credit once OK');
