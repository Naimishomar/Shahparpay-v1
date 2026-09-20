// Run: node src/controllers/topupWebhook.test.mjs
//
// The top-up webhook mints main-wallet balance from an unauthenticated POST, so
// everything here guards the three ways that hands out money nobody paid:
// accepting a forged notification, crediting the same payment twice, and
// crediting the amount the client asked for instead of the amount captured.
import assert from 'node:assert';
import crypto from 'node:crypto';

const SECRET = 'test-razorpay-webhook-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;

const state = { transactions: [], mainWallets: [] };

const mockModel = (rows, keyOf) => ({
  findById: async (id) => rows.find((row) => row._id === id) ?? null,
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
    // Dotted $set paths address metadata sub-keys, as they do in Mongo.
    for (const [path, value] of Object.entries(update.$set || {})) {
      const parts = path.split('.');
      let target = row;
      while (parts.length > 1) target = target[parts.shift()] ??= {};
      target[parts[0]] = value;
    }
    if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) row[k] = (row[k] || 0) + v;
    return options.new ? row : row;
  },
});

const Transaction = mockModel(state.transactions, (row, q) =>
  (q.transactionId ? row.transactionId === q.transactionId : true) &&
  (q._id ? row._id === q._id : true) &&
  (q.type ? row.type === q.type : true) &&
  (q.status ? row.status === q.status : true)
);
let failNextCredit = false;
const realMainWallet = mockModel(state.mainWallets, (row, q) => row.userId === q.userId);
const MainWallet = {
  ...realMainWallet,
  findOneAndUpdate: async (...args) => {
    if (failNextCredit) {
      failNextCredit = false;
      throw new Error('simulated wallet write failure');
    }
    return realMainWallet.findOneAndUpdate(...args);
  },
};

// The shipped handler, with only its two collections swapped for the fakes
// above. Standing a Mongo up for one function is not worth it, and evaluating
// the real source means the logic under test cannot drift from the logic that
// ships.
const { topupWebhook, creditTopup } = await (async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./topup.controller.js', import.meta.url), 'utf8');
  const cut = (marker, declaration) => {
    const from = src.indexOf(marker);
    assert.ok(from > -1, `${marker} must still exist in topup.controller.js`);
    const next = src.indexOf('\nexport const ', from + 1);
    return src.slice(from, next === -1 ? undefined : next).replace(marker, declaration);
  };
  const helper = cut('const creditTopup = async', 'const creditTopup = async');
  const handler = cut('export const topupWebhook', 'const topupWebhook');
  const { verifyWebhookSignature, toRupees } = await import('../utils/razorpay.util.js');
  return new Function(
    'Transaction', 'MainWallet', 'verifyWebhookSignature', 'toRupees',
    `${helper}\n${handler}\nreturn { topupWebhook, creditTopup };`
  )(Transaction, MainWallet, verifyWebhookSignature, toRupees);
})();

const sign = (raw, secret) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

const post = async (body, { secret = SECRET, signature } = {}) => {
  const raw = Buffer.from(JSON.stringify(body));
  const out = {};
  await topupWebhook(
    {
      body,
      rawBody: raw,
      get: (h) =>
        h === 'x-razorpay-signature' ? (signature ?? sign(raw, secret)) : undefined,
    },
    { status(c) { out.code = c; return this; }, json(b) { out.body = b; return out; } }
  );
  return out;
};

const seedTopup = (reference, { amount = 500, qrCodeId = 'qr_1' } = {}) => {
  state.transactions.push({
    _id: `txn_${reference}`,
    transactionId: reference,
    userId: 'ret_1',
    type: 'WALLET_TOPUP',
    amount,
    status: 'PENDING',
    metadata: { provider: 'RAZORPAY', qrCodeId, userModel: 'Retailer' },
  });
};

const credited = (body) => ({
  event: 'qr_code.credited',
  payload: {
    qr_code: { entity: { id: 'qr_1', notes: { reference: 'TOP1' } } },
    payment: {
      entity: {
        id: 'pay_1',
        status: 'captured',
        amount: 50000, // paise
        method: 'upi',
        vpa: 'retailer@upi',
        notes: { reference: 'TOP1' },
      },
    },
    ...body,
  },
});

const balance = () => state.mainWallets.find((w) => w.userId === 'ret_1')?.balance;

// --- a forged or unsigned notification credits nothing -----------------------

seedTopup('TOP1');
assert.equal((await post(credited(), { secret: 'wrong-secret' })).code, 401);
assert.equal((await post(credited(), { signature: '' })).code, 401);
assert.equal((await post(credited(), { signature: 'deadbeef' })).code, 401);
assert.equal(balance(), undefined, 'a forged notification must credit nothing');

// --- an unconfigured secret refuses, it does not wave the caller through -----

delete process.env.RAZORPAY_WEBHOOK_SECRET;
assert.equal((await post(credited())).code, 503, 'no secret configured must refuse');
assert.equal(balance(), undefined);
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;

// --- a genuine payment credits the main wallet exactly once ------------------

const first = await post(credited());
assert.equal(first.code, 200);
assert.equal(first.body.credited, true);
assert.equal(balance(), 500, 'the captured amount, in rupees, reaches the main wallet');

// Razorpay retries webhooks until it gets a 2xx. A retry must not pay twice.
const retry = await post(credited());
assert.equal(retry.code, 200);
assert.equal(retry.body.credited, false, 'a replayed notification must not credit again');
assert.equal(balance(), 500);

// --- the amount credited is what was captured, not what was requested --------
//
// The row was opened for ₹900; Razorpay reports ₹300 captured. Crediting the
// request would hand over ₹600 nobody paid.
seedTopup('TOP2', { amount: 900, qrCodeId: 'qr_2' });
const short = await post({
  event: 'qr_code.credited',
  payload: {
    qr_code: { entity: { id: 'qr_2', notes: { reference: 'TOP2' } } },
    payment: { entity: { id: 'pay_2', status: 'captured', amount: 30000, notes: { reference: 'TOP2' } } },
  },
});
assert.equal(short.body.credited, true);
assert.equal(balance(), 800, 'only the ₹300 actually captured may be added');
assert.equal(
  state.transactions.find((t) => t.transactionId === 'TOP2').amount,
  300,
  'the transaction is restated to the captured amount'
);

// --- a payment against a different QR is not this top-up ---------------------

seedTopup('TOP3', { qrCodeId: 'qr_3' });
const mismatched = await post({
  event: 'qr_code.credited',
  payload: {
    qr_code: { entity: { id: 'qr_somebody_else', notes: { reference: 'TOP3' } } },
    payment: { entity: { id: 'pay_3', status: 'captured', amount: 50000, notes: { reference: 'TOP3' } } },
  },
});
assert.equal(mismatched.code, 409);
assert.equal(balance(), 800, 'a mismatched QR must credit nothing');

// --- unknown references and other events settle nothing ----------------------

const unknown = await post({
  event: 'qr_code.credited',
  payload: {
    qr_code: { entity: { id: 'qr_x', notes: { reference: 'TOP_NOT_OURS' } } },
    payment: { entity: { id: 'pay_x', status: 'captured', amount: 50000, notes: { reference: 'TOP_NOT_OURS' } } },
  },
});
assert.equal(unknown.code, 404);

const other = await post({ event: 'payment.failed', payload: {} });
assert.equal(other.code, 200, 'an unsubscribed event is acknowledged, not retried forever');
assert.equal(other.body.credited, undefined);
assert.equal(balance(), 800);

// --- a failed wallet write releases the claim so a retry can settle it -------
//
// Otherwise the retailer's money is captured, the row reads SUCCESS, and the
// balance never arrives.
seedTopup('TOP4', { qrCodeId: 'qr_4' });
const paidFourth = {
  event: 'qr_code.credited',
  payload: {
    qr_code: { entity: { id: 'qr_4', notes: { reference: 'TOP4' } } },
    payment: { entity: { id: 'pay_4', status: 'captured', amount: 20000, notes: { reference: 'TOP4' } } },
  },
};
failNextCredit = true;
const broke = await post(paidFourth);
assert.equal(broke.code, 500, 'a 5xx makes Razorpay retry');
assert.equal(
  state.transactions.find((t) => t.transactionId === 'TOP4').status,
  'PENDING',
  'the claim must be released, not left as SUCCESS with no money behind it'
);
assert.equal(balance(), 800);

const settled = await post(paidFourth);
assert.equal(settled.body.credited, true, 'the retry settles it');
assert.equal(balance(), 1000);

console.log('topupWebhook: forged, replayed, mismatched, over-claimed and failed-write notifications credit nothing OK');
