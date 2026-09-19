// Run: node src/screens/retailer/bbpsCategory.test.mjs
// The BBPS hub picks a card's glyph by keyword, because the categories are the
// provider's and they rename them. First match wins, so the order of the list
// is load-bearing: "LPG Gas" must read as a cylinder, not a flame, and the
// generic words must sit below the specific ones.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./BbpsScreen.tsx', import.meta.url), 'utf8');

// Lifted as two pieces: anything TypeScript-only between them (an interface,
// a type alias) is not valid input to new Function.
const between = (from, to, label) => {
  const start = src.indexOf(from);
  assert.ok(start > -1, `${label} not found`);
  const end = src.indexOf(to, start);
  assert.ok(end > -1, `end of ${label} not found`);
  return src.slice(start, end + to.length);
};

const table = between('const CATEGORY_ICONS', '];', 'CATEGORY_ICONS').replace(
  'const CATEGORY_ICONS: [RegExp, string][] =',
  'const CATEGORY_ICONS ='
);
const fn = between('export const categoryIcon', "?? 'receipt';", 'categoryIcon').replace(
  'export const categoryIcon = (name: string) =>',
  'const categoryIcon = (name) =>'
);

const categoryIcon = new Function(`${table}\n${fn}\nreturn categoryIcon;`)();

const cases = [
  // The specific-before-generic orderings that the list exists to get right.
  ['LPG Gas', 'gas-cylinder'],
  ['LPG Cylinder Booking', 'gas-cylinder'],
  ['Piped Gas', 'fire'],
  ['Gas', 'fire'],
  ['FASTag Recharge', 'car'],
  ['Toll', 'car'],

  // Spelling and casing drift from the provider must not change the glyph.
  ['Electricity', 'flash'],
  ['ELECTRICITY BILL', 'flash'],
  ['Electricity Prepaid', 'flash'],
  ['Power', 'flash'],
  ['Water', 'water'],
  ['Broadband Postpaid', 'router-wireless'],
  ['Landline Postpaid', 'phone-classic'],
  ['DTH', 'satellite-uplink'],
  ['Cable TV', 'satellite-uplink'],
  ['Mobile Postpaid', 'cellphone'],
  ['Life Insurance', 'shield-check-outline'],
  ['Loan Repayment', 'bank-outline'],
  ['Municipal Taxes', 'city'],
  ['Education Fees', 'school-outline'],
  ['Hospital', 'hospital-box-outline'],
  ['Housing Society', 'city'],
  ['Subscription', 'cash-multiple'],

  // Anything unrecognised still renders, just generically.
  ['Something Brand New', 'receipt'],
  ['', 'receipt'],
];

for (const [name, expected] of cases) {
  assert.strictEqual(categoryIcon(name), expected, `${name || '(empty)'} -> ${expected}`);
}

// A missing name must not throw on the way to the default.
assert.strictEqual(categoryIcon(undefined), 'receipt');
assert.strictEqual(categoryIcon(null), 'receipt');

console.log(`bbps: ${cases.length} category names map to the intended glyph OK`);
