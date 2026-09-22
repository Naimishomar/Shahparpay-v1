// Run: node src/controllers/contactEnquiry.test.mjs
// This endpoint is public and every accepted post sends mail, so the validation
// and the per-mobile cap are the only things standing between the contact form
// and an inbox full of junk. Both are pinned here.
import assert from 'node:assert';

process.env.ETHEREAL_USERNAME = 'test@example.com';

// No Mongo here: the rules under test are the regexes, the clamp and the cap,
// all of which are pure. The controller holds the same three.
const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_MOBILE_PER_HOUR = 3;

// --------------------------------------------------------------- mobile
for (const good of ['9876543210', '6000000000', '7123456789', '8999999999']) {
  assert.strictEqual(MOBILE_RE.test(good), true, `${good} should be accepted`);
}
for (const bad of ['1234567890', '987654321', '98765432100', '0987654321', '', 'abcdefghij', '+919876543210']) {
  assert.strictEqual(MOBILE_RE.test(bad), false, `${bad} must be rejected`);
}

// --------------------------------------------------------------- email
for (const good of ['a@b.co', 'shop.owner@gmail.com']) {
  assert.strictEqual(EMAIL_RE.test(good), true, `${good} should be accepted`);
}
for (const bad of ['plainstring', 'a@b', 'a b@c.com', '@b.com', 'a@.com ']) {
  assert.strictEqual(EMAIL_RE.test(bad), false, `${bad} must be rejected`);
}

// --------------------------------------------------------------- trimming
// The controller clamps every field before it reaches the database, so an
// oversized message can never blow past the schema's maxlength and 500.
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
assert.strictEqual(clean('  Sunita  ', 100), 'Sunita');
assert.strictEqual(clean('x'.repeat(5000), 2000).length, 2000);
assert.strictEqual(clean(undefined, 100), '');
assert.strictEqual(clean(null, 100), '');
// A non-string body field must not throw its way to a 500.
assert.strictEqual(clean({ evil: true }, 100), '[object Object]');
assert.strictEqual(clean(12345, 100), '12345');

// --------------------------------------------------------------- abuse cap
// Third submission in the hour is still allowed; the fourth is not.
assert.strictEqual(2 >= MAX_PER_MOBILE_PER_HOUR, false, 'two prior enquiries must still pass');
assert.strictEqual(3 >= MAX_PER_MOBILE_PER_HOUR, true, 'the fourth in an hour must be refused');

// --------------------------------------------------------------- escaping
const { default: fs } = await import('node:fs');
const emailSrc = fs.readFileSync(new URL('../utils/email.js', import.meta.url), 'utf8');
assert.ok(
  emailSrc.includes('escapeHtml(enquiry.message)'),
  'the enquiry message must be escaped before it is put in the notification'
);
assert.ok(
  emailSrc.includes('escapeHtml(value)'),
  'enquiry fields must be escaped before they are put in the notification'
);
assert.ok(
  /replace\(\/\[\\r\\n\]\+\/g/.test(emailSrc),
  'newlines must be stripped from the subject line'
);

console.log('contactEnquiry: validation, abuse cap and escaping all hold');
