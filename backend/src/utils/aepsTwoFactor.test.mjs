// Run: node src/utils/aepsTwoFactor.test.mjs
// PaySprint reuses response_code across the auth and registration endpoints
// with different meanings per code. Misreading one silently locks a retailer
// out of AEPS for the day (or bills them twice), so every documented code is
// pinned here against pay-sprint.readme.io.
import assert from 'node:assert';
import {
  getTwoFactorEndpoints,
  classifyTwoFactorResponse,
  TWO_FACTOR_ENDPOINTS,
} from './aepsTwoFactor.js';

// ---------------------------------------------------------------- endpoints

// Each pipe must resolve to ITS OWN endpoint. Sending a bank5 merchant to
// bank2's URL comes back as a generic partner error, not a clear failure.
assert.strictEqual(
  getTwoFactorEndpoints('bank2').auth,
  '/service/aeps/kyc/Twofactorkyc/authentication'
);
assert.strictEqual(getTwoFactorEndpoints('bank3').auth, '/service/aeps/kyc/Twofactorkyc/auth_login');
assert.strictEqual(getTwoFactorEndpoints('bank5').auth, '/service/aeps/kyc/v5/authentication');
assert.strictEqual(getTwoFactorEndpoints('bank6').auth, '/service/aeps/kyc/v6/authentication');

// No two pipes may share an auth URL.
const authUrls = Object.values(TWO_FACTOR_ENDPOINTS)
  .filter(Boolean)
  .map((e) => e.auth);
assert.strictEqual(new Set(authUrls).size, authUrls.length, 'two pipes share a 2FA auth endpoint');

// bank5/bank6 have no registration step; bank4 publishes no 2FA at all.
assert.strictEqual(getTwoFactorEndpoints('bank5').register, null);
assert.strictEqual(getTwoFactorEndpoints('bank6').register, null);
assert.strictEqual(getTwoFactorEndpoints('bank4'), null);
assert.strictEqual(getTwoFactorEndpoints('nonsense'), null);
assert.strictEqual(getTwoFactorEndpoints(undefined), null);
assert.strictEqual(getTwoFactorEndpoints('BANK2').auth, getTwoFactorEndpoints('bank2').auth);

// ------------------------------------------------------------ auth outcomes

const auth = (data) => classifyTwoFactorResponse(data, { stage: 'auth' });

assert.strictEqual(auth({ response_code: 1 }).outcome, 'success');

// The regression that mattered: 2 on the auth endpoint is documented as
// "Authentication Already Completed". Treating it as needs_registration fired
// a pointless registration call and then reported failure on a day that was
// already authenticated.
assert.strictEqual(auth({ response_code: 2 }).outcome, 'already_done');

assert.strictEqual(auth({ response_code: 24 }).outcome, 'needs_web_onboarding');
assert.strictEqual(
  auth({ response_code: 0, message: 'Merchant onboading is pending' }).outcome,
  'needs_web_onboarding'
);

// The live failure: pipe-level, so another pipe is worth trying.
const notActivated = auth({
  response_code: 13,
  message: 'Pipe is not activated for the PS004347,Please contact service provider',
});
assert.strictEqual(notActivated.outcome, 'pipe_not_activated');
assert.strictEqual(notActivated.nextPipe, true);
assert.ok(/partner account/i.test(notActivated.message), 'must name the partner account');

const down = auth({ response_code: 12 });
assert.strictEqual(down.outcome, 'service_down');
assert.strictEqual(down.nextPipe, true, 'a down bank should fall through to another pipe');

// These fail identically on every pipe — falling through would just burn
// the customer's finger scans against four more banks.
for (const [data, outcome] of [
  [{ response_code: 15 }, 'partner_error'],
  [{ response_code: 20 }, 'partner_error'],
  [{ response_code: 23 }, 'merchant_blocked'],
  [{ response_code: 26 }, 'device_mapped'],
  [{ response_code: 27 }, 'capture_failed'],
  [{ response_code: 0, message: 'Registration Failed due to aadhar data mismatch' }, 'data_mismatch'],
]) {
  const verdict = auth(data);
  assert.strictEqual(verdict.outcome, outcome, `response_code ${data.response_code}`);
  assert.ok(!verdict.nextPipe, `${outcome} must not fall through to another pipe`);
}

// 27 carrying a mapping message is a bound device, not a bad scan.
assert.strictEqual(
  auth({ response_code: 27, message: 'Device already mapped with other merchant' }).outcome,
  'device_mapped'
);

assert.strictEqual(
  auth({ response_code: 0, message: 'Registration is pending' }).outcome,
  'needs_registration'
);

// ---------------------------------------------------- registration outcomes

const register = (data) => classifyTwoFactorResponse(data, { stage: 'register' });

// Registration answers 1 for both "registered" and "already registered"
// (errorcode 2). Either way the next step is auth, never a second register.
assert.strictEqual(register({ response_code: 1, errorcode: '00' }).outcome, 'registered');
assert.strictEqual(register({ response_code: 1, errorcode: '2' }).outcome, 'registered');
assert.strictEqual(register({ response_code: 24 }).outcome, 'needs_web_onboarding');
assert.strictEqual(register({ response_code: 13 }).outcome, 'pipe_not_activated');

// --------------------------------------------------------------- edge cases

// A dropped connection must never read as success.
for (const empty of [null, undefined, {}]) {
  const verdict = classifyTwoFactorResponse(empty);
  assert.notStrictEqual(verdict.outcome, 'success');
  assert.notStrictEqual(verdict.outcome, 'already_done');
}
// Every branch returns something a retailer can act on.
assert.ok(auth({ response_code: 999 }).message);

console.log('aepsTwoFactor: endpoints and response codes OK');
