// Run: node src/components/ui/Screen.test.mjs
// money() was rewritten off toLocaleString for speed — it runs once per row on
// every report, and Intl dominated the frame time on a filtered ledger. This
// asserts the fast path is byte-identical to the Intl output it replaced, so
// "faster" never quietly became "differently formatted money".
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./Screen.tsx', import.meta.url), 'utf8');

// Lift money() out of the TS module; importing it would pull in react-native.
const start = src.indexOf('export const money = (value: any) => {');
const end = src.indexOf('\n};', start) + 3;
assert.ok(start > -1, 'money() not found');
const money = new Function(
  `${src.slice(start, end).replace('export const money = (value: any) => {', 'const money = (value) => {')}
   return money;`
)();

/** Exactly what the previous implementation produced. */
const reference = (value) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CASES = [
  0, 1, 9, 10, 99, 100, 999, 1000, 1001, 9999, 10000, 99999,
  100000, 999999, 1000000, 1234567, 12345678, 123456789, 999999999,
  0.5, 0.05, 0.005, 1.005, 99.994, 99.995, 1234.5, 1234.56, 1234.567,
  -1, -100, -1234.56, -1234567.89, -0.5,
];

for (const value of CASES) {
  assert.strictEqual(money(value), reference(value), `money(${value})`);
}

// Indian grouping specifically: three digits, then pairs — not thousands.
assert.strictEqual(money(1234567.5), '₹12,34,567.50');
assert.strictEqual(money(100000), '₹1,00,000.00');
assert.strictEqual(money(999), '₹999.00');

// Rows arrive from the API with missing or junk amounts; none may render NaN.
for (const junk of [null, undefined, '', 'abc', NaN, Infinity, -Infinity, {}]) {
  const out = money(junk);
  assert.ok(!out.includes('NaN'), `money(${String(junk)}) rendered NaN`);
  assert.ok(out.startsWith('₹'), `money(${String(junk)}) lost its symbol`);
}
assert.strictEqual(money(null), '₹0.00');
assert.strictEqual(money(undefined), '₹0.00');

// Numeric strings are common in PaySprint payloads.
assert.strictEqual(money('1234.5'), '₹1,234.50');
assert.strictEqual(money('1234567'), '₹12,34,567.00');

// A deterministic sweep across every magnitude the app renders — a lakh-scale
// amount and a crore-scale one round differently, and a single paisa of drift
// against the web portal is a support ticket.
let seed = 20260826;
const nextRandom = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
let mismatches = 0;
for (let i = 0; i < 100000; i++) {
  const magnitude = Math.pow(10, Math.floor(nextRandom() * 9));
  const value = (nextRandom() * 2 - 1) * magnitude;
  if (money(value) !== reference(value)) {
    if (mismatches < 3) console.error(`  ${value}: ${money(value)} !== ${reference(value)}`);
    mismatches += 1;
  }
}
assert.strictEqual(mismatches, 0, `${mismatches} of 100000 values drifted from the Intl output`);

console.log('Screen: money() matches the Intl output it replaced OK (100k value sweep)');
