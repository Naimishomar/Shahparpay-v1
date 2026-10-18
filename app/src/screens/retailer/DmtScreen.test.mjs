// Run: node src/screens/retailer/DmtScreen.test.mjs
// The amount keypad builds the transfer amount one key at a time; this pins
// what a sequence of presses turns into, and how it is grouped on screen.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DmtScreen.tsx', import.meta.url), 'utf8');
const lift = (head) => {
  const start = src.indexOf(`export const ${head}`);
  assert.ok(start > -1, `${head} not found`);
  const end = src.indexOf('\n};', start) + 3;
  return src.slice(start, end).replace('export ', '').replace(/: string/g, '');
};
const { typeKey, groupTyped } = new Function(
  `${lift('typeKey')}\n${lift('groupTyped')}\nreturn { typeKey, groupTyped };`
)();

const press = (keys) => keys.reduce(typeKey, '');
assert.equal(press(['5', '0', '0', '0']), '5000');
assert.equal(press(['0', '0', '7']), '7');
assert.equal(press(['.', '5']), '0.5');
assert.equal(press(['1', '.', '.', '2', '5', '9']), '1.25');
assert.equal(press(['1', '2', 'back']), '1');
assert.equal(press(['back']), '');
assert.equal(press('12345678'.split('')), '1234567');

assert.equal(groupTyped(''), '0');
assert.equal(groupTyped('5000'), '5,000');
assert.equal(groupTyped('500000'), '5,00,000');
assert.equal(groupTyped('1234567.5'), '12,34,567.5');
assert.equal(groupTyped('12.'), '12.');
console.log('DmtScreen keypad ok');
