// Run: node src/utils/bankAccountVerification.test.mjs
// A stored penny-drop answer is re-read against a corrected name on retry.
import assert from 'node:assert';
import { evaluateBankVerification } from './bankAccountVerification.util.js';

const response = {
  status: 1,
  data: { status: 'SUCCESS', accountStatus: 'VALID', AccountNumber: '3838957273', AccountName: 'MD SAUD ALAM' },
};
const check = (name, accountNumber = '3838957273', r = response) =>
  evaluateBankVerification({ name, accountNumber, response: r });

// Typo: account valid, name wrong. providerValid lets the retry reuse it.
const typo = check('Saud Alarm');
assert.equal(typo.providerValid, true);
assert.equal(typo.verified, false);
assert.equal(check('Md Saud  Alam').verified, true);
assert.equal(check('Saud Alam').verified, true);
assert.equal(check('Saud Alam', '3838957274').verified, false);

// Refused or INVALID answers are not reusable.
assert.equal(check('Saud Alam', '3838957273', { status: 0, message: 'Low balance' }).providerValid, false);
assert.equal(check('Saud Alam', '3838957273', { status: 1, data: { ...response.data, accountStatus: 'INVALID' } }).providerValid, false);

console.log('bank account verification tests passed');
