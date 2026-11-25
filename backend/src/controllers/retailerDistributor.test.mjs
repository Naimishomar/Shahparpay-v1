// Run: node src/controllers/retailerDistributor.test.mjs
import assert from 'node:assert';
import mongoose from 'mongoose';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import ActivityLog from '../models/activityLog.model.js';
import { setRetailerDistributor } from './adminConsole.controller.js';

const id = () => new mongoose.Types.ObjectId();
const call = async (params, body, role = 'admin') => {
  const out = {};
  await setRetailerDistributor(
    { params, body, user: { role, _id: id() }, headers: {}, ip: '1.1.1.1', get: () => '' },
    { status: (c) => ((out.code = c), { json: (j) => (out.json = j) }) },
  );
  return out;
};

ActivityLog.create = async () => {};
const pulls = [];
const adds = [];
Distributor.updateOne = async (q, u) => (u.$pull ? pulls : adds).push(String(q._id));
const newD = { _id: id(), name: 'New D', distributorId: 'D2' };
Distributor.findById = () => ({ select: async () => newD });

const mk = (over) => {
  const r = { _id: id(), name: 'R', retailerId: 'R1', signupSource: 'distributor', distributorId: id(), saved: false, save: async function () { this.saved = true; }, ...over };
  Retailer.findById = () => ({ select: async () => r });
  return r;
};

// Only admins.
assert.equal((await call({ id: String(id()) }, {}, 'retailer')).code, 403);

// A distributor's retailer cannot be left under the admin.
let r = mk();
let out = await call({ id: String(r._id) }, { distributorId: null });
assert.equal(out.code, 400);
assert.equal(r.saved, false);

// Change: moves off the old distributor onto the new one.
r = mk();
const old = String(r.distributorId);
out = await call({ id: String(r._id) }, { distributorId: String(newD._id) });
assert.equal(out.code, 200);
assert.equal(String(r.distributorId), String(newD._id));
assert.ok(r.saved && pulls.includes(old) && adds.includes(String(newD._id)));

// Add: a self signup under the admin gets a distributor.
r = mk({ signupSource: 'self', distributorId: null });
out = await call({ id: String(r._id) }, { distributorId: String(newD._id) });
assert.equal(out.code, 200);
assert.equal(String(r.distributorId), String(newD._id));

// A self signup may go back under the admin.
r = mk({ signupSource: 'self', distributorId: newD._id });
out = await call({ id: String(r._id) }, { distributorId: null });
assert.equal(out.code, 200);
assert.equal(r.distributorId, null);

console.log('retailerDistributor tests passed');
process.exit(0);
