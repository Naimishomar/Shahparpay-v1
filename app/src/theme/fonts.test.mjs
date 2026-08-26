// Run: node src/theme/fonts.test.mjs
// A wrong weight->family map fails silently: the text still renders, just in
// the wrong face (or fake-bolded on Android). These assertions pin the mapping
// and the fontWeight strip that stops the double-bold.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./fonts.ts', import.meta.url), 'utf8');

// Lift FONTS, the weight map, and withFont out of the TS module — importing it
// would pull in react-native.
const body = src
  .slice(src.indexOf('export const FONTS'), src.indexOf('let patched'))
  .replace('export const FONTS = {', 'const FONTS = {')
  .replace(' as const;', ';')
  .replace('const FAMILY_FOR_WEIGHT: Record<string, string> = {', 'const FAMILY_FOR_WEIGHT = {')
  .replace('const withFont = (style: any) => {', 'const withFont = (style) => {')
  // Plain objects in, plain objects out: flatten is identity here.
  .replace('StyleSheet.flatten(style)', 'style');
const { withFont, FONTS } = new Function(`${body}; return { withFont, FONTS };`)();

// Every weight the codebase actually uses resolves to its own real face.
assert.strictEqual(withFont({ fontWeight: '400' }).fontFamily, FONTS.regular);
assert.strictEqual(withFont({ fontWeight: '500' }).fontFamily, FONTS.medium);
assert.strictEqual(withFont({ fontWeight: '600' }).fontFamily, FONTS.semibold);
assert.strictEqual(withFont({ fontWeight: '700' }).fontFamily, FONTS.bold);
// 800 is used by the receipt amount; the family ships nothing above 700.
assert.strictEqual(withFont({ fontWeight: '800' }).fontFamily, FONTS.bold);
assert.strictEqual(withFont({ fontWeight: 'bold' }).fontFamily, FONTS.bold);

// Unweighted and unstyled text still gets the app face, never the system one.
assert.strictEqual(withFont({}).fontFamily, FONTS.regular);
assert.strictEqual(withFont(undefined).fontFamily, FONTS.regular);
assert.strictEqual(withFont({ fontWeight: '999' }).fontFamily, FONTS.regular);

// fontWeight must be gone once a family is set, or Android fake-bolds on top.
for (const weight of ['500', '600', '700', '800', 'bold']) {
  assert.ok(
    !('fontWeight' in withFont({ fontWeight: weight })),
    `fontWeight ${weight} survived alongside an explicit family`
  );
}

// Everything else on the style is preserved untouched.
const kept = withFont({ fontWeight: '700', fontSize: 17, color: '#fff', letterSpacing: 0.2 });
assert.strictEqual(kept.fontSize, 17);
assert.strictEqual(kept.color, '#fff');
assert.strictEqual(kept.letterSpacing, 0.2);

// An explicit family at the call site wins and is returned unchanged.
const explicit = { fontFamily: 'SomeOtherFont', fontWeight: '700' };
assert.strictEqual(withFont(explicit), explicit);

// The style must be injected into the props going IN. React Native renders a
// top-level <Text> as <TextAncestor.Provider><NativeText/></Provider>, so a
// style written onto the RETURNED element lands on the Provider and is
// silently dropped — every top-level label kept the handset's font.
assert.ok(
  /render\.call\(this, \{ \.\.\.props, style: withFont\(props\?\.style\) \}, ref\)/.test(src),
  'the font must be injected via props, not written onto the returned element'
);
assert.ok(
  !/\{ \.\.\.element, props:/.test(src),
  'the element-spread patch (which the TextAncestor.Provider swallows) is back'
);

console.log('fonts: weight-to-family mapping + props injection OK');
