// Every `route` in src/constants must be a screen registered in AppNavigator,
// otherwise tapping it throws at runtime. Run: npm run check
const fs = require('fs');
const assert = require('assert');

const nav = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');
const constants = fs.readFileSync('src/constants/index.ts', 'utf8');

const registered = new Set([
  // Component names vary (FooScreen, FooReport), so match any identifier.
  ...[...nav.matchAll(/\[\s*'([A-Za-z]+)',\s*[A-Za-z][A-Za-z0-9_]*\s*\]/g)].map((m) => m[1]),
  ...[...nav.matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"/g)].map((m) => m[1]),
]);

const referenced = [...constants.matchAll(/route:\s*'([A-Za-z]+)'|route:\s*"([A-Za-z]+)"/g)]
  .map((m) => m[1] || m[2]);

assert(registered.size > 5, `parsed too few screens from AppNavigator: ${[...registered]}`);
assert(referenced.length > 5, `parsed too few routes from constants: ${referenced}`);

const missing = [...new Set(referenced)].filter((r) => !registered.has(r));
assert.deepStrictEqual(missing, [], `menu routes with no registered screen: ${missing.join(', ')}`);

console.log(`ok: ${referenced.length} menu routes all resolve (${registered.size} screens registered)`);

// --- icon names ---------------------------------------------------------
// A name that isn't in the font's glyphmap renders as "?" with no error, so
// check every literal icon name against the family it's rendered with.
const path = require('path');
const glyphDir = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps';
const glyphs = {};
for (const family of ['Ionicons', 'MaterialCommunityIcons', 'FontAwesome5Free', 'MaterialIcons']) {
  glyphs[family] = new Set(Object.keys(require(path.resolve(glyphDir, `${family}.json`))));
}
glyphs.FontAwesome5 = glyphs.FontAwesome5Free;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

const bad = [];
for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');

  // <Family name="literal"
  for (const m of src.matchAll(/<(Ionicons|MaterialCommunityIcons|FontAwesome5|MaterialIcons)\s+name="([^"]+)"/g)) {
    if (!glyphs[m[1]].has(m[2])) bad.push(`${file}: <${m[1]} name="${m[2]}">`);
  }

  // data-driven icons: `icon: 'name'` in this file, rendered by one family
  const families = [...new Set([...src.matchAll(/<(Ionicons|MaterialCommunityIcons|FontAwesome5|MaterialIcons)\s+name=\{[a-z]\w*\.icon/g)].map((m) => m[1]))];
  if (families.length === 1) {
    for (const m of src.matchAll(/icon:\s*'([^']+)'/g)) {
      if (!glyphs[families[0]].has(m[1])) bad.push(`${file}: ${families[0]} icon '${m[1]}'`);
    }
  }
}
// src/constants menus + quick actions are all rendered with MaterialCommunityIcons.
for (const m of constants.matchAll(/icon:\s*'([^']+)'/g)) {
  if (!glyphs.MaterialCommunityIcons.has(m[1])) bad.push(`src/constants/index.ts: MaterialCommunityIcons icon '${m[1]}'`);
}

assert.deepStrictEqual(bad, [], `unknown icon names:\n  ${bad.join('\n  ')}`);
console.log('ok: all literal icon names exist in their font');
