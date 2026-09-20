// Run: node src/controllers/icchhamatiWebhook.test.mjs
// Icchhamati allows one callback URL for the whole account, so PAN webhooks and
// wallet-crediting QR collection notifications arrive on the same public
// endpoint. If dispatch or the mid/mkey guard regresses, either PAN statuses
// stop updating or an unauthenticated caller reaches a handler it should not.
import assert from 'node:assert';

process.env.ICCHHAMATI_MID = 'MID_1001';
process.env.ICCHHAMATI_MKEY = 'MKEY_2002';
// Left unset on purpose: collectionWebhook must refuse rather than credit, so a
// payload that falls through to it is provably not silently accepted here.
delete process.env.ICCHHAMATI_COLLECTION_WEBHOOK_SECRET;

const { icchhamatiWebhook, isAuthorisedPanWebhook, PAN_WEBHOOK_HANDLERS } = await import(
  './icchhamatiWebhook.controller.js'
);

const req = (over = {}) => {
  const headers = { mid: 'MID_1001', mkey: 'MKEY_2002', ...(over.headers || {}) };
  return {
    body: {},
    ...over,
    headers,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
};

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

// Every documented webhook type stays routable from the single callback URL.
assert.deepStrictEqual(Object.keys(PAN_WEBHOOK_HANDLERS).sort(), [
  'PanAplication',
  'PanFundStatus',
  'updateAgentStatus',
]);

// ------------------------------------------------------------------- guard

assert.strictEqual(isAuthorisedPanWebhook(req()), true);
assert.strictEqual(
  isAuthorisedPanWebhook(req({ headers: { mid: undefined, 'x-mid': 'MID_1001' } })),
  true,
  'x-mid / x-mkey are sent alongside mid / mkey and must be accepted'
);
assert.strictEqual(isAuthorisedPanWebhook(req({ headers: { mkey: 'wrong' } })), false);
assert.strictEqual(isAuthorisedPanWebhook(req({ headers: { mid: undefined } })), false);

// Fail closed: unconfigured credentials must refuse everyone, not accept all.
process.env.ICCHHAMATI_MID = '';
assert.strictEqual(isAuthorisedPanWebhook(req()), false);
process.env.ICCHHAMATI_MID = 'MID_1001';

// ---------------------------------------------------------------- dispatch

// A PAN webhook with bad credentials must not reach its handler.
{
  const r = res();
  await icchhamatiWebhook(
    req({ headers: { mkey: 'wrong' }, body: { type: 'updateAgentStatus', data: {} } }),
    r
  );
  assert.strictEqual(r.captured.code, 401);
}

// Authorised but incomplete: acknowledged, because retrying cannot fix it.
{
  const r = res();
  await icchhamatiWebhook(req({ body: { type: 'updateAgentStatus', data: {} } }), r);
  assert.strictEqual(r.captured.code, 200);
  assert.strictEqual(r.captured.payload.status, 1);
  assert.strictEqual(r.captured.payload.message, 'pan_no is required');
}

{
  const r = res();
  await icchhamatiWebhook(req({ body: { type: 'PanAplication', data: { vle_id: 'PSA1' } } }), r);
  assert.strictEqual(r.captured.payload.message, 'vle_id and application_no are required');
}

// Anything that is not a PAN type is a collection notification. With no
// collection secret configured that handler refuses — proving the payload was
// handed to it rather than accepted by the PAN path's mid/mkey.
for (const body of [{ type: 'paymentReceived' }, { status: 'SUCCESS', amount: 100 }]) {
  const r = res();
  await icchhamatiWebhook(req({ body }), r);
  assert.strictEqual(r.captured.code, 503, 'must fall through to collectionWebhook');
  assert.strictEqual(r.captured.payload.success, false);
}

console.log('icchhamatiWebhook: all assertions passed');
