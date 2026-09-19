// Run: node src/screens/donutHit.test.mjs
// Tapping the Reports ring has to name the service under the finger. The arcs
// are full <Circle>s revealed through a dash pattern, so SVG hit-testing would
// always report the last one drawn — the angle is resolved by hand instead.
// This pins that maths: twelve o'clock is zero, it runs clockwise, the hole
// and the outside are misses, and no gap swallows a tap.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./ReportsScreen.tsx', import.meta.url), 'utf8');

const constant = (name) => {
  const m = src.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(m, `${name} not found`);
  return Number(new Function(`const SIZE=230,STROKE=24;return ${m[1]};`)());
};
const SIZE = constant('SIZE');
const RADIUS = constant('RADIUS');
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const start = src.indexOf('export const arcAtPoint');
assert.ok(start > -1, 'arcAtPoint not found');
const body = src
  .slice(start, src.indexOf('\n};', start) + 3)
  .replace(/export const arcAtPoint = <T extends DonutArc>\(arcs: T\[\], x: number, y: number\): T \| null =>/,
    'const arcAtPoint = (arcs, x, y) =>');
const arcAtPoint = new Function(
  `const SIZE=${SIZE},STROKE=24,RADIUS=${RADIUS},CIRCUMFERENCE=${CIRCUMFERENCE},HIT_SLACK=6;
   ${body}
   return arcAtPoint;`
)();

// Three equal services: each owns one third of the ring, clockwise from 12.
const third = CIRCUMFERENCE / 3;
const arcs = [
  { label: 'AEPS', offset: 0, span: third },
  { label: 'DMT', offset: third, span: third },
  { label: 'Recharge', offset: 2 * third, span: third },
];

/** A point on the middle of the band, `deg` clockwise from twelve o'clock. */
const onBand = (deg) => {
  const rad = (deg * Math.PI) / 180;
  return [SIZE / 2 + RADIUS * Math.sin(rad), SIZE / 2 - RADIUS * Math.cos(rad)];
};
const hit = (deg) => arcAtPoint(arcs, ...onBand(deg))?.label ?? null;

// Twelve o'clock is the start of the first segment, and it runs CLOCKWISE.
assert.strictEqual(hit(0), 'AEPS', 'twelve o\'clock is the first segment');
// 90 degrees is a QUARTER of the ring, which still falls inside the first
// third — the segments are thirds (120 degrees), not quadrants.
assert.strictEqual(hit(90), 'AEPS', 'three o\'clock is 0.25 of the ring, inside the first third');
assert.strictEqual(hit(150), 'DMT');
assert.strictEqual(hit(180), 'DMT', 'six o\'clock');
assert.strictEqual(hit(270), 'Recharge', 'nine o\'clock — anticlockwise would say DMT');
assert.strictEqual(hit(359.9), 'Recharge', 'just before wrapping back to zero');

// Either side of a boundary resolves to the right neighbour. The exact tie
// (120.0 degrees) is left alone: `(120/360)*C` and `C/3` differ by a float
// epsilon, so which side wins there is arbitrary and nobody can tap it.
assert.strictEqual(hit(119), 'AEPS');
assert.strictEqual(hit(121), 'DMT');
assert.strictEqual(hit(239), 'DMT');
assert.strictEqual(hit(241), 'Recharge');

// The hole and the outside are not targets: the middle prints the total.
assert.strictEqual(arcAtPoint(arcs, SIZE / 2, SIZE / 2), null, 'the centre is a miss');
assert.strictEqual(arcAtPoint(arcs, 0, 0), null, 'the corner is a miss');

// A fingertip landing slightly off the band still counts, either side.
const nearBand = (deg, dr) => {
  const rad = (deg * Math.PI) / 180;
  return [SIZE / 2 + (RADIUS + dr) * Math.sin(rad), SIZE / 2 - (RADIUS + dr) * Math.cos(rad)];
};
assert.ok(arcAtPoint(arcs, ...nearBand(45, 16)), 'just outside the stroke is still a hit');
assert.ok(arcAtPoint(arcs, ...nearBand(45, -16)), 'just inside the stroke is still a hit');
assert.strictEqual(arcAtPoint(arcs, ...nearBand(45, 40)), null, 'well outside is not');

// Every angle resolves to something — no gap may swallow a tap.
for (let deg = 0; deg < 360; deg += 0.5) {
  assert.ok(hit(deg), `no segment at ${deg} degrees`);
}

// A single service owns the whole ring.
const solo = [{ label: 'AEPS', offset: 0, span: CIRCUMFERENCE }];
for (const deg of [0, 90, 180, 270]) {
  assert.strictEqual(arcAtPoint(solo, ...onBand(deg))?.label, 'AEPS');
}

console.log('donut: a tap on the ring resolves to the service under it OK');
