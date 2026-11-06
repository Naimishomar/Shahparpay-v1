// Run: node src/utils/aadhaarQr.test.mjs
// The onboarding form's address comes from the Aadhaar QR; a misread field lands in the shop address.
import assert from 'node:assert';
import zlib from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { parseAadhaarQr, readAadhaarQr } from './aadhaarQr.js';

/** A Secure QR payload as UIDAI builds it: fields split by 255, gzip, as one decimal number. */
const secureQr = (fields) => {
  const parts = fields.flatMap((f) => [Buffer.from(f, 'utf8'), Buffer.from([255])]);
  const gz = zlib.gzipSync(Buffer.concat([...parts, Buffer.alloc(256, 7)]));
  return BigInt(`0x${gz.toString('hex')}`).toString();
};
const FIELDS = ['3', '123420241106', 'Ravi Kumar', '01-01-1990', 'M', 'S/O Ram', 'Hooghly', 'Near Kali Mandir', '4/1', 'Telinipara', '712125', 'Bhadreswar', 'West Bengal', 'Victoria Lane', 'Chandannagar', 'Bhadreswar'];
const expected = {
  businessAddress: '4/1, Victoria Lane, Telinipara, Bhadreswar - 712125',
  city: 'Bhadreswar', district: 'Hooghly', state: 'West Bengal', landmark: 'Near Kali Mandir', pincode: '712125',
};

assert.deepEqual(parseAadhaarQr(secureQr(FIELDS)), expected);
assert.deepEqual(parseAadhaarQr(secureQr(['V2', ...FIELDS, '9876'])), expected, 'V2 shifts the fields by one');

const xml = '<?xml version="1.0"?><PrintLetterBarcodeData uid="123412341234" name="Ravi" house="12" street="MG Road" lm="Opp Bank" loc="Rajwada" vtc="Indore" po="Indore GPO" dist="Indore" state="Madhya Pradesh" pc="452001"/>';
assert.deepEqual(parseAadhaarQr(xml), {
  businessAddress: '12, MG Road, Rajwada, Indore GPO - 452001',
  city: 'Indore', district: 'Indore', state: 'Madhya Pradesh', landmark: 'Opp Bank', pincode: '452001',
});

assert.equal(parseAadhaarQr('https://example.com'), null);
assert.equal(parseAadhaarQr('9'.repeat(200)), null, 'a long number that is not gzip');
assert.equal(parseAadhaarQr(''), null);

// A photo with no QR reads as null, not an error.
const blank = path.join(os.tmpdir(), `aadhaar-qr-test-${process.pid}.png`);
await sharp({ create: { width: 400, height: 300, channels: 3, background: '#fff' } }).png().toFile(blank);
assert.equal(await readAadhaarQr(blank), null);

console.log('aadhaarQr tests passed');
