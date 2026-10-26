// Run: node src/controllers/icchhamatiAeps.test.mjs
// The two calls that decide what a retailer sees and whether money moves.
import assert from 'node:assert';
import { onboardingStep, transactionOutcome, normaliseStates, normaliseBanks, recordStep, fingpayFailed } from './icchhamatiAeps.controller.js';
import { parseServicesUpdate, usesAepsProvider } from '../utils/services.js';

// --- Fingpay's answer inside Icchhamati's ---------------------------------

assert.equal(fingpayFailed({ status: 1, message: 'Success', data: { status: false, message: 'Invalid device' } }), true);
assert.equal(fingpayFailed({ status: 1, data: { status: true, primaryKeyId: '1' } }), false);
assert.equal(fingpayFailed({ status: 1, data: { aeps_status: 0 } }), false);

// --- onboarding step ------------------------------------------------------

const verified = {
  pan_verified_at: 1,
  phone_verified_at: 1,
  email_verified_at: 1,
  aadhaar_verified_at: 1,
  bank_verified_at: 1,
};
assert.equal(onboardingStep(null), 'register');
assert.equal(
  onboardingStep({ ...verified, pan_verified_at: 0, phone_verified_at: 0 }),
  'pan',
  'PAN is checked first'
);
assert.equal(onboardingStep({ ...verified, email_verified_at: 0 }), 'email');
assert.equal(onboardingStep({ ...verified, bank_verified_at: 0 }), 'bank');
assert.equal(onboardingStep({ ...verified, aeps_status: 3 }), 'video', 'no video yet');
const filmed = { ...verified, video_url: 'https://x/v.mp4', shop_inner: 'https://x/i.jpg', shop_outer: 'https://x/o.jpg' };
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 2, aeps_status: 0 }), 'video', 'rejected video goes back');
assert.equal(onboardingStep({ ...filmed, shop_inner: null, video_kyc_status: 1, aeps_status: 0 }), 'video', 'rejected photo goes back');
assert.equal(onboardingStep({ ...filmed, shop_outer: '', video_kyc_status: 1, aeps_status: 3 }), 'ready', 'live merchants keep working');
assert.equal(onboardingStep({ ...filmed, bank_verified_at: 0, video_kyc_status: 1, aeps_status: 0 }), 'bank', 'a cleared check goes back');
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 0, aeps_status: 0 }), 'video_review');
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 1, aeps_status: 0 }), 'onboard');
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 1, aeps_status: 1 }), 'ekyc');
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 1, aeps_status: '2' }), 'twofa');
assert.equal(onboardingStep({ ...filmed, video_kyc_status: 1, aeps_status: 3 }), 'ready');

// --- transaction outcome --------------------------------------------------

assert.equal(
  transactionOutcome({ status: 1, data: { status: true, statusCode: 10000 } }),
  'SUCCESS'
);
assert.equal(
  transactionOutcome({ status: 1, data: { status: false, message: 'Insufficient funds' } }),
  'FAILED'
);
assert.equal(transactionOutcome({ status: 0, message: 'Invalid biometric' }), 'FAILED');

// Anything short of an answer must never read as FAILED: the bank may have
// debited the customer, and FAILED would skip crediting the retailer.
assert.equal(transactionOutcome(null), 'PROCESSING', 'timeout');
assert.equal(transactionOutcome({ status: 2 }), 'PROCESSING');
const crash = {
  status: 0,
  message: 'An unexpected error occurred: Attempt to read property "mid" on null',
};
assert.equal(transactionOutcome(crash), 'PROCESSING');
const http500 = { status: 0, message: 'Server Error' };
Object.defineProperty(http500, 'httpStatus', { value: 502 });
assert.equal(transactionOutcome(http500), 'PROCESSING');

// --- provider switch ------------------------------------------------------

assert.deepEqual(parseServicesUpdate({ aepsProvider: 'icchhamati' }).set, {
  aepsProvider: 'icchhamati',
});
assert.ok(parseServicesUpdate({ aepsProvider: 'fingpay' }).error);
assert.deepEqual(parseServicesUpdate({ disabledServices: ['aeps'] }).set, {
  disabledServices: ['aeps'],
});
assert.ok(parseServicesUpdate({}).error);
assert.deepEqual(parseServicesUpdate({ aepsProvider: 'both' }).set, { aepsProvider: 'both' });

// --- which providers a retailer may use ------------------------------------

// PaySprint is switched off: every retailer is on Icchhamati whatever is stored.
assert.ok(usesAepsProvider({}, 'icchhamati'));
assert.ok(usesAepsProvider({ aepsProvider: 'paysprint' }, 'icchhamati'));
assert.ok(!usesAepsProvider({ aepsProvider: 'paysprint' }, 'paysprint'));
assert.ok(!usesAepsProvider({ aepsProvider: 'both' }, 'paysprint'));

// --- provider lists (shapes as the live gateway returns them) --------------

const states = normaliseStates([
  { stateId: 26, state: 'Uttarakhand', activeFlag: 1, stateCode: 'UK' },
  { stateId: 31, state: 'uttarakhand', activeFlag: 1, stateCode: 'UK' },
  { stateId: 30, state: 'Delhi', activeFlag: 1, stateCode: 'DL' },
  { stateId: 99, state: 'Select State', activeFlag: 1, stateCode: null },
]);
assert.deepEqual(states, [
  { stateId: '30', stateName: 'Delhi' },
  { stateId: '26', stateName: 'Uttarakhand' },
], 'placeholder dropped, duplicate state kept once');

assert.deepEqual(
  normaliseBanks([
    { id: 86, activeFlag: 1, bankName: 'Last Used Bank', iinno: 'NULL' },
    { id: 112, activeFlag: 1, bankName: 'Airtel Payment Bank', iinno: 990320 },
  ]),
  [{ iinno: '990320', bankName: 'Airtel Payment Bank' }],
  'a bank with no IIN cannot be transacted on'
);

// --- recorded step and "KYC verified" ---------------------------------------

const fakeRetailer = (step, done) => {
  const r = { icchhamatiAeps: { step }, isMerchantKycComplete: done, saves: 0 };
  r.save = async () => { r.saves += 1; };
  return r;
};
let r = fakeRetailer(null, true); // verified on PaySprint, never seen on Icchhamati
await recordStep(r, 'video_review');
assert.equal(r.isMerchantKycComplete, false, 'an old PaySprint verification does not count on Icchhamati');
assert.equal(r.icchhamatiAeps.step, 'video_review');
r = fakeRetailer('ekyc', false);
await recordStep(r, 'twofa');
assert.equal(r.isMerchantKycComplete, true, 'eKYC done: only the daily login is left');
r = fakeRetailer('ready', true);
await recordStep(r, 'ready');
assert.equal(r.saves, 0, 'nothing changed, nothing written');

console.log('icchhamatiAeps tests passed');
