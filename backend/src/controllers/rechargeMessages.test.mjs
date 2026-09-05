// Run: node src/controllers/rechargeMessages.test.mjs
// Paysprint refuses a plan lookup in its own operational wording. Whatever it
// says reaches a retailer's screen verbatim unless it is translated, and the
// two known refusals both read like a fault in our app rather than a provider
// being briefly unavailable.
import assert from 'node:assert';
import { hlrMessage } from './recharge.controller.js';

const plans = (raw) => hlrMessage(raw, 'The plan list');

// The HLR add-on is switched off on the account.
assert.equal(
  plans('Hlr Api service is disabled.'),
  'The plan list is unavailable right now. You can still enter the amount manually.'
);

// Paysprint's nightly maintenance window — the hours have to survive, or the
// retailer cannot tell that trying again in the morning will work.
assert.equal(
  plans('Service is down between 23:00 Hours to 05:30 Hours.'),
  'The plan list is unavailable between 23:00 Hours to 05:30 Hours. You can still enter the amount manually.'
);
// Same message without the trailing full stop, and with odd spacing.
assert.equal(
  plans('Service is down between  09:00 to 10:00'),
  'The plan list is unavailable between 09:00 to 10:00. You can still enter the amount manually.'
);

// The label follows the caller, so DTH info does not talk about plans.
assert.equal(
  hlrMessage('Hlr Api service is disabled.', 'Customer details'),
  'Customer details is unavailable right now. You can still enter the amount manually.'
);

// Anything else is Paysprint saying something specific and useful — pass it
// through untouched rather than flattening every failure into one sentence.
assert.equal(plans('Invalid operator'), 'Invalid operator');
assert.equal(plans('No plans found for this circle'), 'No plans found for this circle');

// A missing message must not become the string "undefined" on someone's screen.
for (const empty of [undefined, null, '']) {
  assert.ok(!plans(empty), `${empty} should stay falsy so the caller's fallback wins`);
}

console.log('rechargeMessages: provider wording translated for retailers OK');
