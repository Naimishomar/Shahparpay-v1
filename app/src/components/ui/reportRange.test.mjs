// Run: TZ=Asia/Kolkata node src/components/ui/reportRange.test.mjs
// Every report's date filter is built here. It used to go through
// toISOString().slice(0, 10), which converts to UTC first — so between
// midnight and 05:30 IST both ends of the "Today" range landed on the previous
// day and the report came back empty on the shift where it matters most.
// This pins the range to the LOCAL day for a clock inside that window.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const here = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

const screen = here('./Screen.tsx');
const report = here('./TransactionReport.tsx');

// Guard against the UTC helper creeping back in. Comment lines are stripped
// first — the fix documents the old call by name right where it was made.
const code = report.replace(/^\s*\/\/.*$/gm, '');
assert.ok(
  !/toISOString\(\)/.test(code),
  'TransactionReport must not build API date filters from toISOString()'
);

// isoDate is a one-line arrow; keep a copy here and assert Screen.tsx still
// matches it, so a rewrite there cannot silently invalidate this test.
const isoDateSrc = `const isoDate = (d) =>
  \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;`;
assert.ok(
  screen.includes("`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`"),
  'isoDate no longer formats the LOCAL date — this test is out of step with Screen.tsx'
);

const rangeSrc = report
  .slice(report.indexOf('function rangeToDates'), report.indexOf('\n}', report.indexOf('function rangeToDates')) + 2)
  .replace('function rangeToDates(key: RangeKey): { startDate?: string; endDate?: string } {', 'function rangeToDates(key) {');

const rangeToDates = new Function(`${isoDateSrc}\n${rangeSrc}\nreturn rangeToDates;`)();

// 00:30 IST on 17 Sep 2026 — 19:00 UTC on the 16th, the window that broke.
const earlyIst = new Date('2026-09-16T19:00:00.000Z');
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [earlyIst.getTime()]));
  }
  static now() {
    return earlyIst.getTime();
  }
};

try {
  assert.deepStrictEqual(
    rangeToDates('today'),
    { startDate: '2026-09-17', endDate: '2026-09-17' },
    'a 00:30 IST "Today" must ask for today, not yesterday'
  );
  assert.deepStrictEqual(rangeToDates('all'), {}, '"All time" sends no date filter');
  assert.strictEqual(rangeToDates('7d').endDate, '2026-09-17');
  assert.strictEqual(rangeToDates('7d').startDate, '2026-09-10');
  assert.strictEqual(rangeToDates('30d').startDate, '2026-08-18');
} finally {
  globalThis.Date = RealDate;
}

console.log('reports: date range is the local IST day, not the UTC one OK');
