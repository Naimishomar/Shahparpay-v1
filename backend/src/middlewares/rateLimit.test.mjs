import assert from 'node:assert/strict';
import { rateLimit } from './rateLimit.middleware.js';

const limiter = rateLimit({ windowMs: 60_000, max: 2 });
const call = (ip) => {
  let status = 200;
  const res = { set() {}, status(code) { status = code; return { json() {} }; } };
  let passed = false;
  limiter({ ip, baseUrl: '/api/auth', path: '/login' }, res, () => { passed = true; });
  return passed ? 200 : status;
};
assert.equal(call('1.1.1.1'), 200);
assert.equal(call('1.1.1.1'), 200);
assert.equal(call('1.1.1.1'), 429, 'third attempt in the window is refused');
assert.equal(call('2.2.2.2'), 200, 'other IPs are unaffected');
console.log('rateLimit ok');
process.exit(0);
