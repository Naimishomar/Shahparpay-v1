// Run: node src/controllers/onboardCallback.test.mjs
// These callbacks are public (PaySprint posts server-to-server) and one of them
// debits a retailer's wallet, so the guard and the payload parsing are pinned
// here: a regression in either is either a free debit or a silent double charge.
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

process.env.PAYSPRINT_JWT_KEY = process.env.PAYSPRINT_JWT_KEY || 'dGVzdGtleTEyMzQ1Njc4';
process.env.PAYSPRINT_CALLBACK_KEY = 'secret-key';

const { isAuthorisedCallback, authoritativeParam, mergeActivePipes } = await import(
  './onboardCallback.controller.js'
);

// ------------------------------------------------------------------- guard

const req = (over = {}) => ({ query: {}, headers: {}, ...over });

assert.strictEqual(isAuthorisedCallback(req({ query: { key: 'secret-key' } })), true);
assert.strictEqual(
  isAuthorisedCallback(req({ headers: { 'x-callback-key': 'secret-key' } })),
  true
);
assert.strictEqual(isAuthorisedCallback(req({ query: { key: 'wrong' } })), false);
assert.strictEqual(isAuthorisedCallback(req()), false, 'no key must not pass');

// Fail closed: an unconfigured secret must refuse every caller, never accept all.
process.env.PAYSPRINT_CALLBACK_KEY = '';
assert.strictEqual(isAuthorisedCallback(req({ query: { key: 'secret-key' } })), false);
assert.strictEqual(isAuthorisedCallback(req()), false);
process.env.PAYSPRINT_CALLBACK_KEY = 'secret-key';

// --------------------------------------------------------------- param_enc

const signed = (payload) =>
  jwt.sign(payload, process.env.PAYSPRINT_JWT_KEY, { algorithm: 'HS256' });

// Signed copy wins over the plaintext travelling next to it — otherwise an
// attacker who reaches the endpoint could bill any merchant any amount.
assert.deepStrictEqual(
  authoritativeParam({
    param: { merchant_id: 'VICTIM', amount: '9999' },
    param_enc: signed({ param: { merchant_id: 'RD3933', amount: '10' } }),
  }),
  { merchant_id: 'RD3933', amount: '10' }
);

// PaySprint may sign the param object flat rather than nested.
assert.strictEqual(authoritativeParam({ param_enc: signed({ merchant_id: 'RD3933' }) }).merchant_id, 'RD3933');

// A JWT we cannot verify is rejected outright, not quietly downgraded to `param`.
assert.strictEqual(
  authoritativeParam({ param: { merchant_id: 'RD3933' }, param_enc: jwt.sign({ a: 1 }, 'other') }),
  null
);

// The UAT sample sends a non-JWT string there; fall back to the plaintext.
assert.deepStrictEqual(
  authoritativeParam({ param: { merchant_id: 'RD3933' }, param_enc: 'wqewqewqe723432432' }),
  { merchant_id: 'RD3933' }
);
assert.deepStrictEqual(authoritativeParam({ param: { merchant_id: 'RD3933' } }), {
  merchant_id: 'RD3933',
});

// ------------------------------------------------------------- bank statuses

// Only bare BankN keys are statuses; the _remarks/_dmt/_next_action siblings
// carry free text that must never be read as "this pipe is live".
assert.deepStrictEqual(
  mergeActivePipes([], {
    Bank2: 'Active',
    Bank2_remarks: 'ok',
    Bank5: 'Pending',
    Bank6: 'Rejected',
    Bank6_remarks: 'Active',
    Bank6_next_action: 'Re-submit',
    Bank3_dmt: 'Active',
  }),
  ['bank2']
);
assert.deepStrictEqual(mergeActivePipes([], { Bank2: 'Activation-Pending' }), []);
assert.deepStrictEqual(mergeActivePipes([], {}), []);
assert.deepStrictEqual(mergeActivePipes(), []);

// A callback about bank6 must not switch off the bank2 the retailer transacts on.
assert.deepStrictEqual(mergeActivePipes(['bank2'], { Bank6: 'Active' }), ['bank2', 'bank6']);

// But a pipe this callback DOES report as no longer active is dropped.
assert.deepStrictEqual(mergeActivePipes(['bank2', 'bank6'], { Bank6: 'Rejected' }), ['bank2']);

// Re-delivering the same callback changes nothing.
assert.deepStrictEqual(mergeActivePipes(['bank2'], { Bank2: 'Active' }), ['bank2']);

console.log('onboardCallback: all assertions passed');
