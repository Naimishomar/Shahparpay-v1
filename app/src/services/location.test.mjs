// Run: node src/services/location.test.mjs
// AEPS is geo-fenced by the bank against the outlet's registered address. The
// app used to return null when it could not get a fix, the caller spread {}
// into the payload, and the backend filled in a hardcoded Delhi coordinate —
// so a shop anywhere else transacted "from Delhi" and was refused, with
// nothing on screen naming the cause. These pin the two rules that prevent it:
// a fix must be precise enough to sit inside a fence, and a missing one must
// fail loudly rather than be invented.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./location.ts', import.meta.url), 'utf8');

const MAX_ACCURACY_M = Number(src.match(/const MAX_ACCURACY_M = (\d+);/)?.[1]);
assert.ok(MAX_ACCURACY_M > 0, 'MAX_ACCURACY_M not found');

const lift = (from, to) => {
  const start = src.indexOf(from);
  assert.ok(start > -1, `${from} not found`);
  const end = src.indexOf(to, start);
  return src.slice(start, end + to.length);
};

const isPreciseSrc = lift('export const isPrecise', 'MAX_ACCURACY_M;')
  .replace(/export const isPrecise = \(fix: [^)]+\)[^=]*=>/, 'const isPrecise = (fix) =>');
const pickFixSrc = lift('export const pickFix', 'return live ?? lastKnown;\n};')
  .replace(/export const pickFix = <T[^>]*>\([\s\S]*?\): T \| null =>/, 'const pickFix = (live, lastKnown) =>');

const { isPrecise, pickFix } = new Function(
  `const MAX_ACCURACY_M = ${MAX_ACCURACY_M};
   ${isPreciseSrc}
   ${pickFixSrc}
   return { isPrecise, pickFix };`
)();

const fix = (accuracy, tag) => ({ coords: { accuracy }, tag });

// --- precision ------------------------------------------------------------
assert.ok(isPrecise(fix(5)), 'a 5m GPS fix is usable');
assert.ok(isPrecise(fix(MAX_ACCURACY_M)), 'the threshold itself is usable');
assert.ok(!isPrecise(fix(MAX_ACCURACY_M + 1)), 'past the threshold is not');
assert.ok(!isPrecise(fix(1000)), 'a 1km tower fix is what the fence refuses');
// A fix with no stated accuracy is not evidence of precision.
assert.ok(!isPrecise(fix(undefined)), 'unknown accuracy must not pass');
assert.ok(!isPrecise(fix(null)), 'null accuracy must not pass');
assert.ok(!isPrecise(null), 'no fix is not a precise fix');

// --- which fix gets sent --------------------------------------------------
assert.strictEqual(pickFix(fix(10, 'live'), fix(10, 'old'))?.tag, 'live', 'a precise live fix wins');
assert.strictEqual(
  pickFix(fix(900, 'live'), fix(20, 'old'))?.tag,
  'old',
  'a precise recent fix beats an imprecise live one — minutes old matters less than a km wide'
);
assert.strictEqual(pickFix(null, fix(20, 'old'))?.tag, 'old', 'no live fix falls back');
assert.strictEqual(
  pickFix(fix(900, 'live'), fix(900, 'old'))?.tag,
  'live',
  'with neither precise, the live one is still the more current'
);
assert.strictEqual(pickFix(null, null), null, 'nothing to send stays nothing');

// --- the invariants that caused the geo-fence failures --------------------
assert.ok(
  /Location\.Accuracy\.High/.test(src),
  'AEPS needs a GPS fix; Balanced resolves to ~100m of towers and wifi'
);
assert.ok(
  !/Accuracy\.Balanced|Accuracy\.Low/.test(src),
  'a coarse accuracy mode must not creep back in'
);
// Never invent a coordinate. 28.7041 is the Delhi default this used to inherit.
assert.ok(!/28\.7041|77\.1025/.test(src), 'the app must never carry a fallback coordinate');
assert.ok(
  /coordsPayload = async \(\): Promise<Coords>/.test(src),
  'coordsPayload must resolve to real Coords, never a Partial that spreads to {}'
);
assert.ok(
  /throw new LocationError\('denied'/.test(src) &&
    /throw new LocationError\('services-off'/.test(src) &&
    /throw new LocationError\('unavailable'/.test(src),
  'every failure path must name itself so the UI can tell the retailer what to fix'
);

console.log('location: only a fence-precise fix is sent, and a missing one fails loudly OK');
