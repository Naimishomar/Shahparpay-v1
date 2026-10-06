// Run: node src/controllers/leadCommission.test.mjs
// An approved lead pays the rate card exactly once, however many times the
// callback and the manual status check report it.
import assert from 'node:assert';

const { default: Lead } = await import('../models/lead.model.js');
const { default: Retailer } = await import('../models/users/retailer.model.js');
const { default: MainWallet } = await import('../models/mainWallet.model.js');
const { default: Admin } = await import('../models/users/admin.model.js');
const { default: AdminWallet } = await import('../models/adminWallet.model.js');
const { default: Transaction } = await import('../models/transaction.model.js');
const { payLeadCommission } = await import('./lead.controller.js');

let paid = false;
const credits = { Retailer: 0, Distributor: 0, admin: 0 };
const rows = [];
Lead.findOneAndUpdate = async () => (paid ? null : ((paid = true), {}));
Retailer.findById = async () => ({ distributorId: 'D1' });
MainWallet.findOneAndUpdate = async (filter, update) =>
  (credits[filter.userModel] += update.$inc.balance);
Admin.findOne = async () => ({ _id: 'A1' });
AdminWallet.findOneAndUpdate = async (filter, update) => (credits.admin += update.$inc.balance);
Transaction.create = async (row) => rows.push(row);

const lead = { _id: 'L1', refid: 'LEAD1', userId: 'R1', userModel: 'Retailer', product: 'CC' };

// Not approved yet: nothing paid.
await payLeadCommission({ ...lead, executive_status: 'PENDING' });
await payLeadCommission({ ...lead, executive_status: 'NOT_APPROVED' });
assert.strictEqual(rows.length, 0);

// Approved credit card: ₹500 retailer, ₹20 partner (2% TDS each), admin keeps ₹680 of ₹1,200.
await payLeadCommission({ ...lead, executive_status: 'Approved' });
assert.strictEqual(credits.Retailer, 490);
assert.strictEqual(credits.Distributor, 19.6);
assert.strictEqual(credits.admin, 680);
assert.strictEqual(rows.length, 1);
assert.strictEqual(rows[0].amount, 0);
assert.strictEqual(rows[0].type, 'LEAD');

// Reported again: not paid twice.
await payLeadCommission({ ...lead, executive_status: 'APPROVED' });
assert.strictEqual(rows.length, 1);
assert.strictEqual(credits.Retailer, 490);

// Products without a flat rate (PL/BL) pay nothing.
paid = false;
await payLeadCommission({ ...lead, product: 'PL', executive_status: 'APPROVED' });
assert.strictEqual(rows.length, 1);

console.log('lead commission: approved leads pay the rate card once');
