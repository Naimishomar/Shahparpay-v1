// Run: node src/controllers/system.test.mjs
// Visitor beacon: bots and junk are dropped, no raw IP is stored, external
// referrers keep only their host. Log buffer: captures console lines, strips colour.
import assert from 'node:assert';
process.env.JWT_SECRET ||= 'x'.repeat(32);
const { readLogs } = await import('../utils/logBuffer.js');
const Visit = (await import('../models/visit.model.js')).default;
const { trackVisit } = await import('./system.controller.js');

const saved = [];
Visit.create = async (doc) => saved.push(doc);
const hit = async ({ ua = 'Mozilla/5.0 (iPhone) Mobile', path = '/about', ref, ip = '1.2.3.4' } = {}) => {
  let status;
  const res = { status(c) { status = c; return this; }, end() {} };
  await trackVisit({ headers: { 'user-agent': ua, 'cf-ipcountry': 'IN' }, body: { path, ref }, ip }, res);
  return status;
};

assert.strictEqual(await hit({ ua: 'Googlebot/2.1' }), 204);
assert.strictEqual(await hit({ path: 'https://evil' }), 204);
assert.strictEqual(saved.length, 0, 'bots and non-path values are not stored');

await hit({ path: '/contact?utm=x', ref: 'https://www.google.com/search?q=shahparpay' });
await hit({ ref: 'https://www.shahparpay.in/' });
await hit({ ip: '5.6.7.8' });
assert.strictEqual(saved[0].path, '/contact', 'query string dropped');
assert.strictEqual(saved[0].ref, 'google.com', 'external referrer kept as host');
assert.strictEqual(saved[1].ref, undefined, 'own site is not a referrer');
assert.strictEqual(saved[0].device, 'mobile');
assert.strictEqual(saved[0].country, 'IN');
assert.strictEqual(saved[0].vid, saved[1].vid, 'same visitor, same day, same id');
assert.notStrictEqual(saved[0].vid, saved[2].vid, 'different visitor, different id');
assert.ok(!JSON.stringify(saved).includes('1.2.3.4'), 'raw IP never stored');

console.log('\x1b[32mcoloured line\x1b[0m');
const last = readLogs(0).at(-1);
assert.strictEqual(last.line, 'coloured line', 'ANSI colour stripped');
assert.deepStrictEqual(readLogs(last.seq), [], 'since=seq returns only newer lines');

console.log('system: visitor beacon and log buffer OK');
