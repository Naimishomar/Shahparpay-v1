// Run: node src/controllers/matm.test.mjs
// The app reports the SDK result, but a wallet is credited only when
// PaySprint's status query says txnstatus = 1. Pinned here because the old
// flow trusted `status: 'success'` from the app and minted wallet balance.
import assert from 'node:assert';
import axios from 'axios';

process.env.PAYSPRINT_JWT_KEY = process.env.PAYSPRINT_JWT_KEY || 'dGVzdGtleTEyMzQ1Njc4';
process.env.PAYSPRINT_AES_KEY = process.env.PAYSPRINT_AES_KEY || '0123456789abcdef';
process.env.PAYSPRINT_AES_IV = process.env.PAYSPRINT_AES_IV || '0123456789abcdef';

const { default: Transaction } = await import('../models/transaction.model.js');
const { default: Retailer } = await import('../models/users/retailer.model.js');
const { default: AepsWallet } = await import('../models/aepsWallet.model.js');
const { default: Admin } = await import('../models/users/admin.model.js');
const { default: AdminWallet } = await import('../models/adminWallet.model.js');
const { processMatm } = await import('./matm.controller.js');

let doc;
let credited = 0;
let distributorCredited = 0;
let adminCredited = 0;
let providerStatus;
const threeWay = [];

// With a projection it is the commission split asking for the distributor.
Retailer.findById = (id, projection) =>
  projection
    ? Promise.resolve({ distributorId: 'D1' })
    : { select: async () => ({ contactNumber: '9876543210' }) };
Admin.findOne = async () => ({ _id: 'A1' });
AdminWallet.findOneAndUpdate = async (filter, update) => (adminCredited += update.$inc.balance);
Transaction.findOne = async () => doc;
Transaction.create = async (data) =>
  (doc = {
    _id: 'T1',
    ...data,
    toObject: () => doc,
    set(path, value) {
      this[path] = value;
    },
    save: async () => doc,
  });
Transaction.findById = async () => doc;
Transaction.findOneAndUpdate = async (filter, update) => {
  if (doc.status === 'SUCCESS') return null;
  Object.assign(doc, { status: update.$set.status, amount: update.$set.amount });
  return doc;
};
Transaction.updateOne = async (filter, update) =>
  Object.assign(doc, { status: update.$set.status });
AepsWallet.findOneAndUpdate = async (filter, update) => {
  if (filter.userModel === 'Distributor') distributorCredited += update.$inc.balance;
  else credited += update.$inc.balance;
};
axios.post = async (url, body) => {
  if (url.includes('threeway')) threeWay.push(url);
  return { data: url.includes('threeway') ? { status: true } : providerStatus };
};

const run = async (data) => {
  const out = {};
  await processMatm(
    { user: { id: 'U1' }, body: { mobile: '9876543210', data } },
    {
      status(c) {
        out.code = c;
        return this;
      },
      json(p) {
        out.body = p;
        return this;
      },
    }
  );
  return out;
};

// Forged success, PaySprint says still pending: nothing credited.
providerStatus = { status: true, txnstatus: 2 };
let r = await run({ txnid: 'MATM1', ttype: 'ATMCW', amount: 5000, status: 'success' });
assert.strictEqual(r.body.status, 'PENDING');
assert.strictEqual(credited, 0);

// PaySprint confirms: credit the amount PaySprint reports, not the app's.
providerStatus = { status: true, txnstatus: 1, amount: '1000.00', bankrrn: '123' };
r = await run({ txnid: 'MATM1', ttype: 'ATMCW', amount: 5000 });
assert.strictEqual(r.body.status, 'SUCCESS');
// ₹1,000 principal + 0.30% commission (₹3) less 2% TDS.
assert.strictEqual(Math.round(credited * 100) / 100, 1002.94);
// Partner 0.10% (₹1) less TDS; admin keeps 0.45% - 0.30% - 0.10%.
assert.strictEqual(distributorCredited, 0.98);
assert.strictEqual(adminCredited, 0.5);
assert.strictEqual(threeWay.length, 1);

// Replay after success: no second credit.
r = await run({ txnid: 'MATM1', ttype: 'ATMCW' });
assert.strictEqual(Math.round(credited * 100) / 100, 1002.94);
assert.strictEqual(distributorCredited, 0.98);

// Another retailer cannot claim this reference.
r = await processMatm(
  { user: { id: 'U2' }, body: { data: { txnid: 'MATM1' } } },
  {
    status(c) {
      this.code = c;
      return this;
    },
    json() {
      return this;
    },
  }
);
assert.strictEqual(r.code, 404);
assert.strictEqual(Math.round(credited * 100) / 100, 1002.94);

console.log('matm.controller: all PaySprint MATM assertions passed OK');
