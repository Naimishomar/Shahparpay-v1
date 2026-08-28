// Run: node src/models/otp.test.mjs
// Otp.consume is the single gate in front of "change my password" and "change
// my wallet PIN". It is a mongoose static, so it is exercised here against a
// stub `this` — no database, but every branch that decides whether a code is
// accepted, burned, or thrown away is pinned.
import assert from 'node:assert';
import Otp from './otp.model.js';

const stub = (record) => {
  const state = { record, deleted: false, saved: 0 };
  return {
    state,
    findOne: async () => state.record,
    deleteOne: async () => {
      state.deleted = true;
      state.record = null;
    },
  };
};

const row = (otp, attempts = 0) => ({
  _id: 'id',
  otp,
  attempts,
  save: async function () {
    this.savedAttempts = this.attempts;
  },
});

// Right code: accepted once, then destroyed so it cannot be replayed.
let db = stub(row('123456'));
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', '123456'), true);
assert.strictEqual(db.state.deleted, true, 'a used OTP must be deleted');

// Numeric input from a JSON body must match the stored string.
db = stub(row('123456'));
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', 123456), true);

// Wrong code: rejected, kept alive, one attempt burned.
db = stub(row('123456'));
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', '000000'), false);
assert.strictEqual(db.state.deleted, false);
assert.strictEqual(db.state.record.attempts, 1);

// Fifth wrong guess destroys the code — a 6-digit secret guarding a wallet PIN
// must not survive unlimited attempts inside its 5-minute life.
db = stub(row('123456', 4));
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', '000000'), false);
assert.strictEqual(db.state.deleted, true, 'OTP must die after 5 wrong attempts');

// No record (expired by the TTL index, or never issued) is a plain refusal.
db = stub(null);
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', '123456'), false);

// Empty/undefined codes must never coincidentally match.
db = stub(row('123456'));
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', ''), false);
assert.strictEqual(await Otp.consume.call(db, 'a@b.com', undefined), false);

console.log('otp.consume: all assertions passed');
