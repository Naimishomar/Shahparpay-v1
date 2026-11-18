// Run: node src/utils/upiCashWithdrawal.test.mjs
// Only a definite bank answer settles a UPI cash withdrawal, and the ledger reads it as a Trade credit.
import assert from 'node:assert';
import { upiCwOutcome, answerIsFor } from './upiCashWithdrawal.js';
import { getWalletDeltas, getWalletLabel } from '../controllers/walletLedger.controller.js';
import { getUpiCashWithdrawalCommission } from './wallet.util.js';

// Rate card: ₹500–1,000 → ₹1, ₹1,001–3,000 → ₹3, ₹3,001–5,000 → ₹6; outside the range nothing.
assert.deepEqual([499, 500, 1000, 1001, 3000, 3001, 5000, 5001].map(getUpiCashWithdrawalCommission), [0, 1, 1, 3, 3, 6, 6, 0]);

assert.equal(upiCwOutcome({ status: true, data: { txnStatus: 'SUCCESS' } }), 'SUCCESS');
assert.equal(upiCwOutcome({ status: true, data: { txnStatus: 'Failed' } }), 'FAILED');
assert.equal(upiCwOutcome({ status: true, data: { txnStatus: 'PENDING' } }), 'PENDING');
// No answer, or a refused enquiry, is not a failure: the customer may have paid.
assert.equal(upiCwOutcome(null), 'PENDING');
assert.equal(upiCwOutcome({ status: false, message: 'Missing parameter(s)' }), 'PENDING');

const tx = { type: 'UPI_CASH_WITHDRAWAL', amount: 500, status: 'SUCCESS', transactionId: 'UCW1', metadata: {} };
assert.deepEqual(getWalletDeltas(tx), { main: 0, aeps: 500 });
// With its ₹1 commission booked, the ledger adds it net of 2% TDS.
const paid = getWalletDeltas({ ...tx, commissions: { retailerEarned: 1, retailerTds: 0.02 } });
assert.equal(paid.aeps, 500.98);
assert.equal(getWalletLabel(tx), 'Trade');

// A status answer only settles the withdrawal it names.
const mine = { metadata: { partnerRequestId: 'UPICW1', fingpayTxnId: 'FP1' } };
assert.equal(answerIsFor(mine, { data: { partnerRequestId: 'UPICW1', fingpayTxnId: 'FP1', txnStatus: 'SUCCESS' } }), true);
assert.equal(answerIsFor(mine, { data: { txnStatus: 'SUCCESS' } }), true);
assert.equal(answerIsFor(mine, { data: { partnerRequestId: 'UPICW2', fingpayTxnId: 'FP1', txnStatus: 'SUCCESS' } }), false);
assert.equal(answerIsFor(mine, { data: { partnerRequestId: 'UPICW1', fingpayTxnId: 'FP9', txnStatus: 'SUCCESS' } }), false);
assert.equal(answerIsFor({ metadata: {} }, { data: { txnStatus: 'SUCCESS' } }), false);

console.log('upi cash withdrawal tests passed');
