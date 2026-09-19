// Every useAction's `.error` must be rendered somewhere in its own file,
// otherwise a failed action is silent: the spinner stops, nothing appears, and
// the retailer is left looking at a form that did nothing. Run: npm run check
//
// This is not hypothetical. AepsScreen's `submit` was never rendered, so a
// failure before the provider call — a missing location, most often — captured
// the customer's fingerprint and then showed absolutely nothing.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Actions that genuinely cannot fail: their body swallows the only failure
// mode. Each one needs a reason, not just a name.
const ALLOWED = {
  'src/screens/retailer/ProfileScreen.tsx:changePhoto':
    'pickImage resolves to null when the picker is cancelled or the permission is denied; it never rejects',
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
};

const silent = [];
let checked = 0;
for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/const (\w+) = useAction\(/g)) {
    const name = match[1];
    checked += 1;
    if (src.includes(`${name}.error`)) continue;
    if (ALLOWED[`${file}:${name}`]) continue;
    silent.push(`${file}: ${name}.error is never rendered`);
  }
}

assert.deepStrictEqual(
  silent,
  [],
  `actions whose failure would be invisible:\n  ${silent.join('\n  ')}\n\n` +
    'Render the error, or add it to ALLOWED with the reason it cannot fail.'
);

// A stale allowance is worse than none: it exempts something nobody rechecked.
const stale = Object.keys(ALLOWED).filter((key) => {
  const [file, name] = key.split(':');
  return !fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(`const ${name} = useAction(`);
});
assert.deepStrictEqual(stale, [], `ALLOWED entries that no longer exist: ${stale.join(', ')}`);

console.log(`ok: all ${checked} action failures reach the screen`);
