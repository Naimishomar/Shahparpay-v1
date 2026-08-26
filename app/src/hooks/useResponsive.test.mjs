// Run: node src/hooks/useResponsive.test.mjs
// Guards the one thing here that can silently break the layout: a row of
// `columns` cards plus the gaps must fit inside the padded content width.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// The hook file is TypeScript; lift the pure function out by stripping types.
const src = readFileSync(new URL('./useResponsive.ts', import.meta.url), 'utf8');
const body = src
  .slice(src.indexOf('export function responsiveLayout'), src.indexOf('export function useResponsive'))
  .replace('export function responsiveLayout(width: number, height: number)', 'function responsiveLayout(width, height)');
const responsiveLayout = new Function(`${body}; return responsiveLayout;`)();

const DEVICES = [
  ['iPhone SE', 320, 568],
  ['iPhone 12 mini', 360, 780],
  ['Pixel 5', 393, 851],
  ['iPhone 14 Pro Max', 430, 932],
  ['iPad mini portrait', 744, 1133],
  ['iPad Pro landscape', 1366, 1024],
];

for (const [name, w, h] of DEVICES) {
  const l = responsiveLayout(w, h);
  const rowWidth = l.columnWidth * l.columns + l.gap * (l.columns - 1);
  assert.ok(l.columnWidth > 0, `${name}: non-positive column width`);
  assert.ok(
    rowWidth <= l.contentWidth,
    `${name}: a row of ${l.columns} cards (${rowWidth}px) overflows the ${l.contentWidth}px content area`
  );
  // Leftover must be smaller than one more gap, i.e. the row really is full.
  assert.ok(l.contentWidth - rowWidth < l.columns, `${name}: wasted ${l.contentWidth - rowWidth}px`);
  assert.ok(l.sidebarWidth < w, `${name}: sidebar covers the whole screen`);
}

// A phone in landscape must not still be treated as a tablet-width grid.
assert.strictEqual(responsiveLayout(320, 568).columns, 1, 'SE should be single column');
assert.strictEqual(responsiveLayout(393, 851).columns, 2, 'standard phone should be two columns');
assert.ok(responsiveLayout(1366, 1024).isLandscape, 'landscape detection');

console.log(`OK: responsive grid fits on ${DEVICES.length} device widths`);
