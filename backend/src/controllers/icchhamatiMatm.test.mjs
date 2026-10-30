// Run: node src/controllers/icchhamatiMatm.test.mjs
// Reading the MATM driver's result decides whether a wallet is credited.
import assert from 'node:assert';
import { readMatmResult, sdkCredentials } from './icchhamatiMatm.controller.js';

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

// The SDK gets the merchant's own login and never Icchhamati's super-merchant one.
{
  const draft = {
    request_data: { username: 'SUPERUSER', password: 'f'.repeat(32), supermerchantId: 1262, merchant: { merchantLoginId: 'AGENT1647', merchantLoginPin: '9000002742' } },
    response_data: { status: true, data: { merchantLoginId: 'AGENT1647', superMerchantId: 1262 } },
  };
  const creds = sdkCredentials(draft);
  assert.deepEqual(creds, { merchantUserId: 'AGENT1647', merchantPassword: '9000002742', superMerchantId: '1262' });
  assert.ok(!JSON.stringify(creds).includes('SUPERUSER'));
  // Stored as JSON strings too.
  assert.equal(sdkCredentials({ request_data: JSON.stringify(draft.request_data), response_data: JSON.stringify(draft.response_data) }).superMerchantId, '1262');
  // Not on Fingpay yet: no login to hand out.
  assert.equal(sdkCredentials({ request_data: null, response_data: null }), null);
}

console.log('icchhamatiMatm tests passed');
