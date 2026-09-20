// Run: node src/controllers/paysprintCallback.test.mjs
// PaySprint allows one callback URL per account, so every event arrives on the
// same public endpoint. If the dispatch table loses an entry the matching
// callback silently stops working — a merchant never unlocks a pipe, or an
// onboarding charge is never billed — so the wiring is pinned here.
import assert from 'node:assert';

process.env.PAYSPRINT_JWT_KEY = process.env.PAYSPRINT_JWT_KEY || 'dGVzdGtleTEyMzQ1Njc4';
process.env.PAYSPRINT_CALLBACK_KEY = 'secret-key';

const { paysprintCallback, CALLBACK_HANDLERS } = await import('./onboardCallback.controller.js');

const req = (over = {}) => ({ query: { key: 'secret-key' }, headers: {}, body: {}, ...over });
const res = () => {
  const captured = {};
  return {
    captured,
    status(code) {
      captured.code = code;
      return this;
    },
    json(payload) {
      captured.payload = payload;
      return this;
    },
  };
};

assert.deepStrictEqual(
  Object.keys(CALLBACK_HANDLERS).sort(),
  ['LEAD_GENERATION_CALLBACK', 'MERCHANT_ONBOARDING', 'MERCHANT_STATUS_ONBOARD'],
  'every PaySprint event we handle must stay routable from the single callback URL'
);

// Unsigned callers must not reach leadCallback, which has no guard of its own.
{
  const r = res();
  await paysprintCallback(req({ query: {}, body: { event: 'LEAD_GENERATION_CALLBACK' } }), r);
  assert.strictEqual(r.captured.payload.status, 400);
  assert.strictEqual(r.captured.payload.message, 'Unauthorized callback');
}

// A wrong key is refused even for an event we do handle.
{
  const r = res();
  await paysprintCallback(req({ query: { key: 'wrong' }, body: { event: 'MERCHANT_ONBOARDING' } }), r);
  assert.strictEqual(r.captured.payload.message, 'Unauthorized callback');
}

// PaySprint retries anything that is not a 200-with-status body, so an event we
// do not handle still has to be acknowledged rather than dropped.
{
  const r = res();
  await paysprintCallback(req({ body: { event: 'SOMETHING_NEW' } }), r);
  assert.strictEqual(r.captured.code, 200, 'must answer 200 or PaySprint retries forever');
  assert.strictEqual(r.captured.payload.status, 400);
  assert.strictEqual(r.captured.payload.message, 'Unsupported event');
}

// A body with no event at all must not throw its way to a 500.
{
  const r = res();
  await paysprintCallback(req({ body: {} }), r);
  assert.strictEqual(r.captured.payload.message, 'Unsupported event');
}

console.log('paysprintCallback: all assertions passed');
