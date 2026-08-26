// Run: node src/screens/retailer/AepsScreen.test.mjs
// The amount in words is the retailer's second read on a number that becomes
// a real cash handover, so the Indian crore/lakh grouping has to be right.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AepsScreen.tsx', import.meta.url), 'utf8');
const body = src
  .slice(src.indexOf('const ONES ='), src.indexOf('/** The most descriptive line'))
  .replace('const twoDigits = (n: number): string =>', 'const twoDigits = (n) =>')
  .replace('const amountInWords = (value: string) =>', 'const amountInWords = (value) =>')
  .replace('const parts: string[] = [];', 'const parts = [];')
  .replace('const push = (count: number, unit: string) =>', 'const push = (count, unit) =>');
const amountInWords = new Function(`${body}; return amountInWords;`)();

const CASES = [
  ['500', 'Five Hundred Rupees only'],
  ['1234', 'One Thousand Two Hundred Thirty Four Rupees only'],
  ['5000', 'Five Thousand Rupees only'],
  ['10000', 'Ten Thousand Rupees only'],
  ['100000', 'One Lakh Rupees only'],
  ['150000', 'One Lakh Fifty Thousand Rupees only'],
  ['10000000', 'One Crore Rupees only'],
  ['19', 'Nineteen Rupees only'],
  ['20', 'Twenty Rupees only'],
  // Decimals: only the rupee part is spelled out.
  ['999.75', 'Nine Hundred Ninety Nine Rupees only'],
];

for (const [input, expected] of CASES) {
  assert.strictEqual(amountInWords(input), expected, `amountInWords(${input})`);
}

// Anything the field can hold that is not a spellable amount renders nothing,
// so the helper line simply disappears instead of printing "NaN Rupees".
for (const empty of ['', '0', '-5', 'abc', '.']) {
  assert.strictEqual(amountInWords(empty), '', `amountInWords(${JSON.stringify(empty)})`);
}

console.log('AepsScreen: amount in words OK');
