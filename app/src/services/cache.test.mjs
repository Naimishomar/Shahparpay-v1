// Run: node src/services/cache.test.mjs
// The GET cache is opt-in per endpoint. A wrong entry here shows a retailer a
// stale balance or a settled transaction that has not settled — so the policy
// is pinned: what is cached, for how long, and what must never be.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const constants = readFileSync(new URL('../constants/index.ts', import.meta.url), 'utf8');

// Lift the TTL table and its lookup, resolving API_ENDPOINTS references to the
// literal paths the constants file actually declares.
const endpoints = {};
for (const [, key, value] of constants.matchAll(/^\s{4}(\w+): '([^']+)',/gm)) {
  endpoints[key] = value;
}
assert.ok(Object.keys(endpoints).length > 30, 'failed to parse API_ENDPOINTS');

const tableSrc = src.slice(src.indexOf('const CACHE_TTL'), src.indexOf('/** Endpoints that legitimately'));
// The lifted table references API_ENDPOINTS; stand in a proxy that resolves to
// the literal paths parsed above, so a renamed constant fails loudly here.
globalThis.ENDPOINTS = endpoints;
const { CACHE_TTL, cacheTtlFor } = new Function(
  `const MINUTE = 60000;
   const API_ENDPOINTS = new Proxy({}, { get: () => new Proxy({}, {
     get: (_t, k) => globalThis.ENDPOINTS[k] ?? '/__unknown__/' + String(k),
   })});
   ${tableSrc
     .replace('const CACHE_TTL: Record<string, number> =', 'const CACHE_TTL =')
     .replace('export const cacheTtlFor = (url: string): number =>', 'const cacheTtlFor = (url) =>')}
   return { CACHE_TTL, cacheTtlFor };`
)();

// Every cached path must be a real endpoint — a typo would silently never hit.
for (const path of Object.keys(CACHE_TTL)) {
  assert.ok(
    path.startsWith('/api/') && !path.includes('__unknown__'),
    `cached path "${path}" does not resolve to a declared endpoint`
  );
}

// --- what is cached -------------------------------------------------------
assert.strictEqual(cacheTtlFor(endpoints.balance), 20_000, 'wallet balance');
assert.strictEqual(cacheTtlFor(endpoints.banks), 3_600_000, 'AEPS bank list');
assert.ok(cacheTtlFor(endpoints.merchantStatus) > 0, 'merchant status');

// Prefix matching: `/operators/:type` and `/status/:id` inherit their parent.
assert.strictEqual(
  cacheTtlFor(`${endpoints.operators}/mobile`),
  cacheTtlFor(endpoints.operators),
  'path parameters must inherit the parent TTL'
);
// ...but a sibling path must not be swallowed by a prefix match.
assert.strictEqual(cacheTtlFor('/api/wallet/balance-history'), 0, 'prefix must not over-match');

// --- what must never be cached -------------------------------------------
// Anything whose staleness would misinform a live transaction or hide money.
const NEVER = [
  endpoints.history, // wallet + recharge history
  endpoints.ledger,
  endpoints.creditLedger,
  endpoints.status, // settlement / recharge status polling
  endpoints.accountStatus,
  endpoints.onboardingPlan,
  endpoints.settings,
  '/api/aeps/txn-status',
  '/api/settlement/history',
];
for (const path of NEVER) {
  if (!path) continue;
  assert.strictEqual(cacheTtlFor(path), 0, `${path} must always hit the network`);
}

// An endpoint nobody listed is never cached — the default has to be off, so a
// new route cannot become stale by omission.
assert.strictEqual(cacheTtlFor('/api/something/brand-new'), 0);

// --- invalidation ---------------------------------------------------------
// Only GET reads the cache; every write drops it, including multipart.
for (const verb of ['post', 'put', 'patch', 'delete', 'postForm', 'putForm']) {
  const at = src.indexOf(`async ${verb}<T = any>(`);
  assert.ok(at > -1, `${verb} not found`);
  const body = src.slice(at, at + 700);
  assert.ok(body.includes('this.invalidateCache()'), `${verb} must flush the cache`);
}

// Signing out must not leave one account's data readable by the next.
const clearAt = src.indexOf('async clearSession()');
assert.ok(
  src.slice(clearAt, clearAt + 300).includes('this.invalidateCache()'),
  'clearSession must drop cached responses'
);

// Pull-to-refresh means "get me the real numbers".
const useAsync = readFileSync(new URL('../hooks/useAsync.ts', import.meta.url), 'utf8');
assert.ok(
  /if \(isRefresh\) api\.invalidateCache\(\)/.test(useAsync),
  'pull-to-refresh must bypass the cache'
);

console.log('api: GET cache policy and invalidation OK');
