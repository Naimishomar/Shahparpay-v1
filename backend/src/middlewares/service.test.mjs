// Run: node src/middlewares/service.test.mjs
// A switched-off service must be refused on the server, not just hidden in
// the UI — and only for the retailer it was switched off for.
import assert from 'node:assert';
import { requireService } from './service.middleware.js';
import { parseDisabledServices } from '../utils/services.js';

const run = (mw, { method = 'POST', role = 'retailer', disabled = [], path = '/', body = {} } = {}) => {
  let status = null, passed = false;
  const res = { status(c) { status = c; return this; }, json() { return this; } };
  mw({ method, path, body, user: { role, disabledServices: disabled } }, res, () => { passed = true; });
  return { status, passed };
};

assert.strictEqual(run(requireService('dmt'), { disabled: ['dmt'] }).status, 403, 'disabled service is refused');
assert.ok(run(requireService('dmt'), { disabled: ['aeps'] }).passed, 'other services unaffected');
assert.ok(run(requireService('dmt'), { disabled: ['dmt'], method: 'GET' }).passed, 'history reads still allowed');
assert.ok(run(requireService('dmt'), { disabled: ['dmt'], role: 'distributor' }).passed, 'only retailers are gated');

// Recharge router: bill payments are BBPS, everything else is recharge.
const pick = (req) => (req.path === '/fetch-bill' ? 'bbps' : req.path === '/do-recharge' ? (req.body.type === 'electricity' ? 'bbps' : 'recharge') : 'recharge');
assert.ok(run(requireService(pick), { disabled: ['bbps'], path: '/do-recharge', body: { type: 'prepaid' } }).passed);
assert.strictEqual(run(requireService(pick), { disabled: ['bbps'], path: '/fetch-bill' }).status, 403);

assert.deepStrictEqual(parseDisabledServices('["dmt","bogus","dmt"]'), ['dmt'], 'unknown keys and duplicates dropped');
assert.strictEqual(parseDisabledServices('not json'), null);
assert.strictEqual(parseDisabledServices(undefined), null);

console.log('requireService: switched-off services refused OK');
