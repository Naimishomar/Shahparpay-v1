// Run: node src/services/rdService.test.mjs
// The two pure pieces of the RD Service bridge, both of which fail silently
// if they break: a PidOptions XML that drifts from the UIDAI spec is rejected
// by every scanner with errCode 100, and a response classifier that says "ok"
// on a failed capture would ship a garbage PID block to the bank.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// The module is TypeScript and imports react-native; lift the pure functions
// out by slicing the source, the way useResponsive.test.mjs does.
const src = readFileSync(new URL('./rdService.ts', import.meta.url), 'utf8');

const lift = (from, to, signature, replacement) =>
  new Function(
    `${src.slice(src.indexOf(from), src.indexOf(to)).replace(signature, replacement)}; return ${replacement.match(/(?:const|function)\s+(\w+)/)[1]};`
  )();

const buildCaptureXml = lift(
  'export const buildCaptureXml',
  'export interface RdCaptureResult',
  'export const buildCaptureXml = (options: CaptureOptions = {}): string =>',
  'const buildCaptureXml = (options = {}) =>'
);

const attrSrc = src
  .slice(src.indexOf('/** Pulls the first matching'), src.indexOf('/** Turns an errCode'))
  .replace('const attr = (xml: string, name: string) =>', 'const attr = (xml, name) =>');
const isSuccessfulPid = new Function(
  `${attrSrc}
   const isSuccessfulPid = (xml) => attr(xml, 'errCode') === '0' && xml.includes('PidData');
   return isSuccessfulPid;`
)();

// ---------------------------------------------------------------- XML shape

const plain = buildCaptureXml();
assert.ok(plain.startsWith('<PidOptions ver="1.0">'), 'no XML declaration, spec-strict opening tag');
assert.ok(!plain.includes('CustOpts'), 'CustOpts breaks Morpho/Startek RD services');
assert.ok(plain.includes('fCount="1"') && plain.includes('fType="2"'), 'single FMR+FIR finger');
assert.ok(!plain.includes('wadh=') && !plain.includes('otp='), 'AEPS transactions send neither');
assert.strictEqual(plain.split('\n').length, 1, 'must stay on one line');

const ekyc = buildCaptureXml({ wadh: 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=' });
assert.ok(ekyc.includes('wadh="E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc="'), 'eKYC WADH bound');

const withOtp = buildCaptureXml({ otp: '123456' });
assert.ok(withOtp.includes('otp="123456"'), 'withdrawal OTP bound into the capture');

// ------------------------------------------------------------ PID classifier

const success =
  '<PidData><Resp errCode="0" errInfo="Success" fCount="1" /><Data type="X">abc</Data></PidData>';
assert.strictEqual(isSuccessfulPid(success), true, 'errCode 0 with PidData is a real capture');

assert.strictEqual(
  isSuccessfulPid('<Resp errCode="100" errInfo="Invalid PidOptions input" />'),
  false,
  'a spec rejection must never pass as a capture'
);
assert.strictEqual(
  isSuccessfulPid('<Resp errCode="0" errInfo="Success" />'),
  false,
  'errCode 0 without a PidData block is not usable'
);
assert.strictEqual(isSuccessfulPid(''), false, 'empty response is a failure');

console.log('rdService: XML builder and PID classifier OK');
