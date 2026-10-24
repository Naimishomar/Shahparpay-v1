// Run: node src/controllers/icchhamatiMatm.test.mjs
// Reading the MATM driver's result decides whether a wallet is credited.
import assert from 'node:assert';
import { readMatmResult } from './icchhamatiMatm.controller.js';

// The documented withdrawal result.
const withdrawal = readMatmResult({
  transactionAmount: 1000,
  transactionStatus: 'successful',
  transactionType: 'WDLS',
  fpTransactionId: 'MACB7916913040926132636021W',
  errorCode: '00',
  errorMessage: 'Success',
});
assert.deepEqual(withdrawal, {
  amount: 1000,
  type: 'WDLS',
  withdrawal: true,
  succeeded: true,
  reference: 'MACB7916913040926132636021W',
});

// A decline is not a success, whatever the amount says.
assert.ok(!readMatmResult({ transactionAmount: 1000, transactionStatus: 'failed', errorCode: '91', fpTransactionId: 'X' }).succeeded);
assert.ok(!readMatmResult({ transactionAmount: 1000, transactionStatus: 'successful', errorCode: '51', fpTransactionId: 'X' }).succeeded);

// A balance enquiry moves no money, even when it carries the balance as an amount.
assert.ok(!readMatmResult({ transactionAmount: 0, transactionType: 'BAL', errorCode: '00', transactionStatus: 'successful' }).withdrawal);
assert.ok(!readMatmResult({ transactionAmount: 613.07, transactionType: 'BALANCE ENQUIRY', errorCode: '00', transactionStatus: 'successful' }).withdrawal);

assert.equal(readMatmResult({}).reference, '', 'no id, nothing to record');

console.log('icchhamatiMatm tests passed');
