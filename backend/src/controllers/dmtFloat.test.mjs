// Run: node src/controllers/dmtFloat.test.mjs
// The provider refuses a payout its own settlement float cannot cover with
// "Insufficient balance for debit transaction". Shown verbatim that reads as
// the RETAILER's wallet being empty — it is not, and their funds were already
// refunded. This pins the classifier that swaps in an honest message, and
// keeps it from swallowing unrelated refusals.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./dmt.controller.js', import.meta.url), 'utf8');

const lift = (name, header) => {
  const start = src.indexOf(header);
  assert.ok(start > -1, `${name} not found`);
  const end = src.indexOf('\n\n', start);
  return src.slice(start, end);
};

const cleanProviderMessage = (raw) =>
  String(raw ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const isProviderFloatRefusal = new Function(
  'cleanProviderMessage',
  `${lift('isProviderFloatRefusal', 'const isProviderFloatRefusal =')}
   return isProviderFloatRefusal;`
)(cleanProviderMessage);

// The message the provider actually sent (see the integration log for
// DMT1789663035145174600, providerStatus 0 on beneficiary-payout).
assert.ok(isProviderFloatRefusal({ message: 'Insufficient balance for debit transaction' }));
assert.ok(isProviderFloatRefusal({ message: 'INSUFFICIENT FUNDS' }));
assert.ok(isProviderFloatRefusal({ message: '<b>Insufficient  balance</b>' }));

// Anything that is not a float complaint must keep its own message: a wrong
// IFSC or a dead beneficiary has to reach the retailer as itself.
assert.ok(!isProviderFloatRefusal({ message: 'Invalid beneficiary account' }));
assert.ok(!isProviderFloatRefusal({ message: 'Beneficiary not verified' }));
assert.ok(!isProviderFloatRefusal({}));
assert.ok(!isProviderFloatRefusal(null));

// And the payout body must send the beneficiary id as the integer the provider
// documents, not a quoted string.
assert.ok(
  /beneficiary_id: Number\(beneficiaryId\)/.test(src),
  'beneficiary-payout must send beneficiary_id as a number'
);

console.log('DMT: provider-float refusal is classified, other refusals pass through OK');
