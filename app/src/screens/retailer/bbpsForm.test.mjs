// Run: node src/screens/retailer/bbpsForm.test.mjs
// Every BBPS service takes the same inputs from the retailer — biller, the
// biller's own consumer identifier, an amount and the wallet PIN — and, like
// the website, refuses a payment under ₹10 before the PIN step.
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
  lift('const bbpsFormValid = (', 'pin.length === 4;').replace(': BbpsForm)', ')'),
].join('\n');
const bbpsFormValid = new Function(`${source}\nreturn bbpsFormValid;`)();

const form = (overrides = {}) => ({
  biller: { id: '323' },
  caNumber: '100012345',
  amount: '1450',
  pin: '1234',
  ...overrides,
});

assert.strictEqual(bbpsFormValid(form()), true);
assert.strictEqual(bbpsFormValid(form({ biller: null })), false);
assert.strictEqual(bbpsFormValid(form({ caNumber: '  12  ' })), false);
assert.strictEqual(bbpsFormValid(form({ pin: '123' })), false);

// Under the provider's floor. The wallet balance is the backend's to check, as on the website.
assert.strictEqual(bbpsFormValid(form({ amount: '9.99' })), false);
assert.strictEqual(bbpsFormValid(form({ amount: '10' })), true);
assert.strictEqual(bbpsFormValid(form({ amount: '' })), false);
assert.strictEqual(bbpsFormValid(form({ amount: '5001' })), true);

console.log('bbps form: website payment rules enforced before the PIN step OK');
