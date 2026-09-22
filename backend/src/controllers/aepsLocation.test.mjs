// Run: node src/controllers/aepsLocation.test.mjs
// PaySprint allows three base-location changes per merchant per calendar year
// and silently no-ops past that. The quota accounting and the coordinate bounds
// are the only things stopping a retailer from burning all three on a bad GPS
// fix and then being stuck at the wrong location for a year.
import assert from 'node:assert';

const MAX_UPDATES_PER_YEAR = 3;
const IN_BOUNDS = { minLat: 6, maxLat: 37.5, minLong: 68, maxLong: 97.5 };

// Same expression the controller uses.
const quotaFor = (retailer) => {
  const year = new Date().getFullYear();
  const stored = retailer.aepsBaseLocation || {};
  const used = stored.countYear === year ? stored.countThisYear || 0 : 0;
  return { year, used, remaining: Math.max(0, MAX_UPDATES_PER_YEAR - used) };
};

const thisYear = new Date().getFullYear();

// ------------------------------------------------------------------ quota
assert.deepStrictEqual(quotaFor({}), { year: thisYear, used: 0, remaining: 3 });
assert.strictEqual(quotaFor({ aepsBaseLocation: { countYear: thisYear, countThisYear: 2 } }).remaining, 1);
assert.strictEqual(quotaFor({ aepsBaseLocation: { countYear: thisYear, countThisYear: 3 } }).remaining, 0);

// Last year's usage must not carry over — the provider's cap is per calendar year.
assert.strictEqual(
  quotaFor({ aepsBaseLocation: { countYear: thisYear - 1, countThisYear: 3 } }).remaining,
  3,
  "a previous year's usage must not eat into this year's allowance"
);

// A count above the cap (set by hand, or by a provider-side change we did not
// see) must clamp at zero rather than report a negative allowance.
assert.strictEqual(
  quotaFor({ aepsBaseLocation: { countYear: thisYear, countThisYear: 9 } }).remaining,
  0
);

// ----------------------------------------------------------------- bounds
const inIndia = (lat, long) =>
  lat >= IN_BOUNDS.minLat && lat <= IN_BOUNDS.maxLat &&
  long >= IN_BOUNDS.minLong && long <= IN_BOUNDS.maxLong;

// Real Indian shops.
assert.ok(inIndia(22.8996, 88.3565), 'Bhadreswar, the registered office, must be accepted');
assert.ok(inIndia(28.6139, 77.2090), 'Delhi must be accepted');
assert.ok(inIndia(8.5241, 76.9366), 'Thiruvananthapuram must be accepted');
assert.ok(inIndia(34.0837, 74.7973), 'Srinagar must be accepted');

// The failure modes worth spending a check on: a null island fix from a device
// with no GPS lock, and coordinates that are simply not in India.
assert.strictEqual(inIndia(0, 0), false, 'a 0,0 fix is a broken GPS read, not a shop');
assert.strictEqual(inIndia(51.5072, -0.1276), false, 'London must be refused');
assert.strictEqual(inIndia(-33.8688, 151.2093), false, 'Sydney must be refused');

// Swapped lat/long is the classic integration bug: Kolkata's pair reversed
// lands outside the box and must be caught rather than registered.
assert.strictEqual(inIndia(88.3565, 22.8996), false, 'swapped lat/long must be refused');

// ------------------------------------------------------------ parse guard
// The controller reads coordinates with Number() + Number.isFinite. Outright
// garbage becomes NaN and is refused there.
for (const bad of ['abc', {}, undefined, NaN]) {
  assert.strictEqual(Number.isFinite(Number(bad)), false, `${String(bad)} must not parse as a coordinate`);
}

// These are the sharp edge: null, '' and [] all coerce to 0, which IS finite,
// so the finite check alone would wave them through as lat 0 / long 0. The
// bounds check is what actually stops them, which is why it is not optional.
for (const sneaky of [null, '', []]) {
  assert.strictEqual(Number.isFinite(Number(sneaky)), true, 'coerces to 0, so finite');
  assert.strictEqual(inIndia(Number(sneaky), Number(sneaky)), false, 'and must be refused by bounds');
}

console.log('aepsLocation: yearly quota and coordinate bounds hold');
