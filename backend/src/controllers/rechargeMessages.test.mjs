// Run: node src/controllers/rechargeMessages.test.mjs
// DTH customer details are the one recharge lookup still served by Paysprint's
// HLR API — Icchhamati publishes no equivalent. Paysprint refuses it in its own
// operational wording, and whatever it says reaches a retailer's screen
// verbatim unless it is translated. Both known refusals read like a fault in
// our app rather than a provider being briefly unavailable.
import assert from 'node:assert';
import { hlrMessage } from './recharge.controller.js';

const details = (raw) => hlrMessage(raw, 'Customer details');

// The HLR add-on is switched off on the account.
assert.equal(
  details('Hlr Api service is disabled.'),
  'Customer details is unavailable right now. You can still enter the amount manually.'
);

// Paysprint's nightly maintenance window — the hours have to survive, or the
// retailer cannot tell that trying again in the morning will work.
assert.equal(
  details('Service is down between 23:00 Hours to 05:30 Hours.'),
  'Customer details is unavailable between 23:00 Hours to 05:30 Hours. You can still enter the amount manually.'
);
// Same message without the trailing full stop, and with odd spacing.
assert.equal(
  details('Service is down between  09:00 to 10:00'),
  'Customer details is unavailable between 09:00 to 10:00. You can still enter the amount manually.'
);

// The label follows the caller, so a different lookup does not talk about DTH.
assert.equal(
  hlrMessage('Hlr Api service is disabled.', 'The plan list'),
  'The plan list is unavailable right now. You can still enter the amount manually.'
);

// Anything else is Paysprint saying something specific and useful — pass it
// through untouched rather than flattening every failure into one sentence.
assert.equal(details('Invalid operator'), 'Invalid operator');
assert.equal(details('Subscriber not found'), 'Subscriber not found');

// A missing message must not become the string "undefined" on someone's screen.
for (const empty of [undefined, null, '']) {
  assert.ok(!details(empty), `${empty} should stay falsy so the caller's fallback wins`);
}

console.log('rechargeMessages: provider wording translated for retailers OK');
