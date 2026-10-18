import assert from 'node:assert/strict';
import { rejectMongoOperators } from './noOperators.middleware.js';

const run = (body) => {
  let status = 200;
  const res = { status(code) { status = code; return { json() {} }; } };
  rejectMongoOperators({ body, query: {}, params: {} }, res, () => {});
  return status;
};
assert.equal(run({ email: 'a@b.c', otp: '123456' }), 200);
assert.equal(run({ email: { $in: ['a@b.c', 'victim@x.in'] } }), 400);
assert.equal(run({ data: [{ nested: { $ne: null } }] }), 400, 'operators inside arrays are caught');
assert.equal(run(undefined), 200);
console.log('noOperators ok');
