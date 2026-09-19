// Run: node src/screens/retailer/bbpsForm.test.mjs
// Every BBPS service takes the same four inputs from the retailer — biller,
// the biller's own consumer identifier, an amount and the wallet PIN, with an
// optional customer mobile. The provider refuses a payment under ₹10 and a
// mobile number that is not exactly ten digits, so the Pay button has to
// refuse them first: a debit is locked before the provider is ever asked.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./BbpsServiceScreen.tsx', import.meta.url), 'utf8');
const lift = (from, to) => {
  const start = src.indexOf(from);
  assert.ok(start > -1, `${from} not found`);
  const end = src.indexOf(to, start);
  assert.ok(end > -1, `end of ${from} not found`);
  return src.slice(start, end + to.length);
};

// The one TypeScript annotation in the lifted source; the interface itself
// stays behind.
const source = [
  lift('const MIN_AMOUNT = 10;', ';'),
  lift('const bbpsFormValid = ({', 'pin.length === 4;').replace('}: BbpsForm)', '})'),
].join('\n');
const bbpsFormValid = new Function(`${source}\nreturn bbpsFormValid;`)();

const form = (overrides = {}) => ({
  biller: { id: '323' },
  caNumber: '100012345',
  amount: '1450',
  available: 5000,
  customerMobile: '',
  pin: '1234',
  ...overrides,
});

assert.strictEqual(bbpsFormValid(form()), true);
// A mobile number is optional, but a half-typed one is not a number.
assert.strictEqual(bbpsFormValid(form({ customerMobile: '9876543210' })), true);
assert.strictEqual(bbpsFormValid(form({ customerMobile: '98765' })), false);

assert.strictEqual(bbpsFormValid(form({ biller: null })), false);
assert.strictEqual(bbpsFormValid(form({ caNumber: '  12  ' })), false);
assert.strictEqual(bbpsFormValid(form({ pin: '123' })), false);

// Under the provider's floor, and over the wallet.
assert.strictEqual(bbpsFormValid(form({ amount: '9.99' })), false);
assert.strictEqual(bbpsFormValid(form({ amount: '10' })), true);
assert.strictEqual(bbpsFormValid(form({ amount: '' })), false);
assert.strictEqual(bbpsFormValid(form({ amount: '5001' })), false);

console.log('bbps form: provider input rules enforced before the wallet is touched OK');
