// Run: node src/services/api.test.mjs
// Pins the rule that caused retailers to be logged out mid-shift: a refresh
// that never reached the server must NOT end the session. Only a server that
// actually refused the refresh token may.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

// Lift the classification out of the TS module — importing it would pull in
// axios, AsyncStorage and expo-constants.
const classify = (error) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

// The source must still derive `rejected` from the status, not from the mere
// presence of an error.
assert.ok(
  /rejected:\s*status === 401 \|\| status === 403/.test(src),
  'refreshAccessToken must classify failures by HTTP status'
);
assert.ok(
  !/}\s*catch\s*{\s*return null;\s*}/.test(src),
  'a bare catch that swallows every failure has come back'
);
assert.ok(
  /if \(result\.rejected\) await this\.handleUnauthorized\(\)/.test(src),
  'the session may only be cleared when the refresh was actually rejected'
);

// Session-ending failures.
assert.strictEqual(classify({ response: { status: 401 } }), true);
assert.strictEqual(classify({ response: { status: 403 } }), true);

// Everything a bad mobile connection produces must keep the session.
for (const transient of [
  { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }, // slow 4G
  { message: 'Network Error' }, // offline / DNS
  { response: { status: 500 } }, // backend restart
  { response: { status: 502 } }, // gateway blip
  { response: { status: 503 } },
  { response: { status: 504 } },
  {},
]) {
  assert.strictEqual(
    classify(transient),
    false,
    `transient failure ${JSON.stringify(transient)} must not end the session`
  );
}

// Public endpoints answer 401 while logged out and must never trigger a
// refresh-and-retry loop; authenticated /api/auth/* routes must.
const PUBLIC = ['/api/auth/login', '/api/auth/verify-login-otp', '/api/auth/refresh-token'];
const AUTHENTICATED = [
  '/api/auth/update-profile',
  '/api/auth/change-password',
  '/api/auth/paysprint/get-onboard-url',
  '/api/auth/create-retailer',
];
const isPublic = (url) => PUBLIC.some((p) => url.startsWith(p));

for (const url of PUBLIC) assert.strictEqual(isPublic(url), true, url);
for (const url of AUTHENTICATED) {
  assert.strictEqual(
    isPublic(url),
    false,
    `${url} needs the token refresh — the old /api/auth/ prefix check skipped it`
  );
}

// The old blanket prefix check would have wrongly exempted all of them.
for (const url of AUTHENTICATED) {
  assert.ok(url.startsWith('/api/auth/'), 'guards the regression this test exists for');
}

// --- startup contract ----------------------------------------------------
// A reload always finds an expired access token (they live 15 minutes), so the
// session is refreshed once during initialisation. Without that, every screen's
// first request 401s at the same moment and races the same recovery.
const auth = readFileSync(new URL('../context/AuthContext.tsx', import.meta.url), 'utf8');

assert.ok(
  /api\.ensureFreshToken\(\)/.test(auth),
  'startup must refresh the token before screens mount'
);
assert.ok(
  /BOOT_REFRESH_GRACE_MS/.test(auth),
  'the startup refresh must be bounded, or an offline launch strands the splash'
);
assert.ok(
  /setIsInitializing\(false\)/.test(auth) && /} finally {/.test(auth),
  'initialisation must complete even when the refresh throws'
);

// Restore, then refresh — never gate the restore on the network, or an offline
// launch shows the login screen to someone who is signed in.
const restoreAt = auth.indexOf('setToken(storedToken)');
const refreshAt = auth.indexOf('api.ensureFreshToken()');
assert.ok(restoreAt > -1 && refreshAt > restoreAt, 'restore the stored session before refreshing it');

// Only an explicit rejection may clear; a timeout must not.
assert.ok(
  /else if \(result\.rejected\)/.test(auth),
  'startup may only sign out when the refresh was actually rejected'
);

// A session with no refresh token cannot survive 15 minutes — say so rather
// than letting it look like a random logout later.
assert.ok(/no refresh token/i.test(auth), 'warn when restoring a session with no refresh token');
assert.ok(/no refreshToken/i.test(auth), 'warn when login returns no refresh token');

// --- base URL ------------------------------------------------------------
// A gitignored .env never reaches the EAS git archive, so a standalone build
// resolved to the handset's own loopback and every request failed with
// "could not reach the server". The URL must come from build config.
import { readFileSync as read } from 'node:fs';
const easJson = JSON.parse(read(new URL('../../eas.json', import.meta.url), 'utf8'));
for (const profile of ['apk', 'production']) {
  const url = easJson.build?.[profile]?.env?.EXPO_PUBLIC_BACKEND_URL;
  assert.ok(url, `eas.json build.${profile}.env must set EXPO_PUBLIC_BACKEND_URL`);
  assert.ok(/^https?:\/\//.test(url), `${profile}: ${url} is not an absolute URL`);
  assert.ok(!/localhost|127\.0\.0\.1/.test(url), `${profile} points at loopback: ${url}`);
}

// And the fallback has to complain rather than quietly ship loopback again.
assert.ok(
  /EXPO_PUBLIC_BACKEND_URL is missing from this build/.test(src),
  'the localhost fallback must warn in a release build'
);

console.log('api: refresh classification + startup contract + base URL OK');
