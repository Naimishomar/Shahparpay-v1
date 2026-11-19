// Admin signed in as a retailer (token carries `imp`): portal works, account changes do not.
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import Retailer from '../models/users/retailer.model.js';
import { authMiddlewares } from './auth.middleware.js';

process.env.JWT_SECRET = 'test';
Retailer.findById = () => ({ select: async () => ({ _id: 'r1', isActive: true, verificationStatus: 'approved' }) });

const run = async (url, method, imp) => {
  const token = jwt.sign({ id: 'r1', role: 'retailer', ...(imp && { imp }) }, 'test');
  const req = { headers: { authorization: `Bearer ${token}` }, method, originalUrl: url, cookies: {} };
  let status = 200;
  let passed = false;
  const res = { status: (s) => ((status = s), res), json: () => res };
  await authMiddlewares(req, res, () => { passed = true; });
  return { status, passed, req };
};

let r = await run('/api/auth/change-password', 'POST', 'admin1');
assert.equal(r.status, 403);
assert.equal(r.passed, false);
r = await run('/api/auth/profile', 'GET', 'admin1');
assert.ok(r.passed);
r = await run('/api/dmt/beneficiary', 'POST', 'admin1');
assert.ok(r.passed);
assert.equal(r.req.impersonator, 'admin1');
r = await run('/api/auth/change-password', 'POST');
assert.ok(r.passed);
console.log('impersonation guard OK');
process.exit(0);
