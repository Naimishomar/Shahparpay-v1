// Run: node src/controllers/paysprintCallback.test.mjs
// PaySprint's one public callback URL now carries only Lead Generation. The key
// check is all that stops a retailer approving their own lead for commission.
import assert from 'node:assert';

process.env.PAYSPRINT_CALLBACK_KEY = 'secret-key';

const { paysprintCallback } = await import('./lead.controller.js');

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

// Unsigned callers must not reach the lead handler, which has no guard of its own.
{
  const r = res();
  await paysprintCallback(req({ query: {}, body: { event: 'LEAD_GENERATION_CALLBACK' } }), r);
  assert.strictEqual(r.captured.payload.status, 400);
  assert.strictEqual(r.captured.payload.message, 'Unauthorized callback');
}

// A wrong key is refused even for an event we do handle.
{
  const r = res();
  await paysprintCallback(req({ query: { key: 'wrong' }, body: { event: 'LEAD_GENERATION_CALLBACK' } }), r);
  assert.strictEqual(r.captured.payload.message, 'Unauthorized callback');
}

// The old AEPS/MATM events are no longer handled.
{
  const r = res();
  await paysprintCallback(req({ body: { event: 'MERCHANT_ONBOARDING' } }), r);
  assert.strictEqual(r.captured.payload.message, 'Unsupported event');
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
