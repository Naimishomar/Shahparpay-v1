// Run: node src/controllers/settlement.test.mjs
// AEPS settlement pays Icchhamati beneficiaries of the registered mobile only.
import assert from 'node:assert';
import { toSettlementBank } from './settlement.controller.js';
import { beneficiaryMobile } from './dmt.controller.js';
import { payoutOutcome } from '../utils/icchhamati.util.js';

// --- A provider beneficiary reads as a saved bank --------------------------

{
  const row = { id: 904, name: 'A2Z CLICK SOLUTIONS', mobile: '9000002742', account: '10293618096', ifsc: 'IDFB0061501', bank: 'IDFC FIRST Bank' };
  const bank = toSettlementBank(row);
  assert.equal(bank._id, '904');
  assert.equal(bank.beneId, '904');
  assert.equal(bank.accountNumber, '10293618096');
  assert.equal(bank.ifscCode, 'IDFB0061501');
  assert.equal(bank.bankName, 'IDFC FIRST Bank');
  assert.equal(bank.status, 'VERIFIED');
  assert.equal(toSettlementBank({ beneficiary_id: 7 })._id, '7');
}

// --- Only the registered mobile's beneficiaries ----------------------------

{
  const rows = [{ id: 1, mobile: '9000002742' }, { id: 2, mobile: '8240039776' }, { id: 3, user: { mobile: '+91 90000 02742' } }];
  const mine = rows.filter((r) => beneficiaryMobile(r) === '9000002742').map((r) => r.id);
  assert.deepEqual(mine, [1]);
}

// --- Payout answers ---------------------------------------------------------

assert.equal(payoutOutcome({ status: 1, data: { status: 'success' } }), 'SUCCESS');
assert.equal(payoutOutcome({ status: 1, data: { status: 'Pending' } }), 'PENDING');
assert.equal(payoutOutcome({ status: 1, data: {} }), 'PENDING');
assert.equal(payoutOutcome({ status: 0, message: 'Insufficient balance' }), 'FAILED');

console.log('settlement tests passed');
