// Run: node src/screens/auth/LoginScreen.test.mjs
// The OTP field auto-submits on the sixth digit. React has not committed the
// state update when onChangeText fires, so the completed code MUST travel with
// the callback — reading the parent's `otp` there sends a five-digit code and
// the server rejects a perfectly good OTP.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./LoginScreen.tsx', import.meta.url), 'utf8');

// Lift the real onChangeText body and run it against spies.
const start = src.indexOf('onChangeText={(next) => {') + 'onChangeText={(next) => {'.length;
const end = src.indexOf('\n        }}', start);
assert.ok(start > 24 && end > start, 'OTP onChangeText handler not found');
const body = src.slice(start, end);

const OTP_LENGTH = 6;
const makeHandler = (onChange, onComplete) =>
  new Function('next', 'onChange', 'onComplete', 'OTP_LENGTH', body).bind(
    null
  );

const run = (input) => {
  const changed = [];
  const completed = [];
  makeHandler()(
    input,
    (v) => changed.push(v),
    (v) => completed.push(v),
    OTP_LENGTH
  );
  return { changed, completed };
};

// Partial entry: keep the digits, do not submit.
for (const partial of ['1', '12', '12345']) {
  const { changed, completed } = run(partial);
  assert.deepStrictEqual(changed, [partial]);
  assert.strictEqual(completed.length, 0, `${partial} must not auto-submit`);
}

// The sixth digit submits, and it submits the FULL code.
const full = run('123456');
assert.deepStrictEqual(full.changed, ['123456']);
assert.deepStrictEqual(
  full.completed,
  ['123456'],
  'auto-submit must pass the completed code, not rely on parent state'
);

// Non-digits (autofill sometimes delivers "Code: 123456") are stripped, and a
// paste longer than six is truncated rather than rejected.
assert.deepStrictEqual(run('12-34-56').completed, ['123456']);
assert.deepStrictEqual(run('123456789').completed, ['123456']);
assert.deepStrictEqual(run('abc').changed, ['']);
assert.strictEqual(run('abc').completed.length, 0);

// And the screen must hand the callback straight through. Wrapping it in
// `() => handleVerifyOtp(otp)` is exactly the stale-closure bug this guards.
assert.ok(
  /onComplete=\{handleVerifyOtp\}/.test(src),
  'onComplete must receive the code from the field, not close over `otp`'
);
assert.ok(
  !/onComplete=\{\(\)\s*=>/.test(src),
  'onComplete is closing over parent state again — it will submit a short code'
);
assert.ok(
  /onComplete\?\.\(digits\)/.test(src),
  'the field must pass the completed digits to onComplete'
);

console.log('LoginScreen: OTP auto-submit sends the completed code OK');
