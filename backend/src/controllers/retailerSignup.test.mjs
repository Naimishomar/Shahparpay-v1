// Run: node src/controllers/retailerSignup.test.mjs
// A self-signed-up retailer has no distributor yet and must stay out until an admin approves.
import assert from 'node:assert';
import Retailer from '../models/users/retailer.model.js';
import { isAwaitingVerification } from '../middlewares/auth.middleware.js';

const missing = (doc) => Object.keys(doc.validateSync()?.errors || {});

assert.ok(missing(new Retailer({})).includes('distributorId'), "a distributor's retailer still needs the distributor");
assert.ok(!missing(new Retailer({ signupSource: 'self' })).includes('distributorId'), 'a self signup has none yet');

const existing = new Retailer({});
assert.equal(existing.verificationStatus, 'approved', 'retailers created before the field are approved');
assert.equal(isAwaitingVerification(existing), false);
assert.equal(isAwaitingVerification(new Retailer({ signupSource: 'self', verificationStatus: 'pending' })), true);
assert.equal(isAwaitingVerification({ verificationStatus: 'rejected' }), true);
assert.equal(isAwaitingVerification({}), false, 'a lean document without the field is approved');

console.log('retailerSignup tests passed');
