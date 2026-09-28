// Run: node src/controllers/distributorAnalytics.test.mjs
// The distributor charts bucket by IST calendar day. If the window drifts to
// UTC or to "now minus N days", the first bar becomes a partial day and late
// evening transactions land on the wrong date.
import assert from 'node:assert';
import { windowFor } from './distributorAnalytics.controller.js';

// 00:30 IST on 5 Mar is still 4 Mar in UTC — the case that breaks a UTC window.
const now = new Date('2026-03-04T19:00:00Z');
const { since, prevSince, labels } = windowFor(7, now);

assert.strictEqual(labels.length, 7);
assert.strictEqual(labels.at(-1), '2026-03-05', 'last bucket is today in IST');
assert.strictEqual(labels[0], '2026-02-27');
assert.strictEqual(since.toISOString(), '2026-02-26T18:30:00.000Z', 'window opens at IST midnight');
assert.strictEqual(since.getTime() - prevSince.getTime(), 7 * 86400000, 'previous period is the same length');
assert.deepStrictEqual(new Set(labels).size, 7, 'no duplicate days');

console.log('distributorAnalytics: IST day window OK');
