// Run: node src/utils/commissionRateCard.test.mjs
// Retailer rates from "Retailer Service Commission Structure" (Nov 2026), partner
// rates from "Proposal all service Final 6-10-2026". Where the provider's
// commission is known (AEPS, Micro ATM) the merchant, partner and admin columns
// must add up to it, so the admin's share never goes negative or leaks.
import assert from 'node:assert';
import {
  getAepsWithdrawalCommission,
  getAepsDepositCommission,
  getMatmCommission,
  getDistributorCommission,
  getApiCommission,
  getBbpsCommission,
  getBbpsCharge,
  getDmtCharge,
} from './wallet.util.js';

const round2 = (n) => Math.round(n * 100) / 100;
const admin = (type, retailer, amount) =>
  round2(
    getApiCommission(type, amount) - retailer(amount) - getDistributorCommission(type, amount)
  );

// AEPS withdrawal: 0.45% = 0.05 admin + 0.10 partner + 0.30 merchant; ₹13.5 = 2 + 0.5 + 11
// (₹3,000–₹7,999) or 1 + 0.5 + 12 (₹8,000+).
assert.strictEqual(getAepsWithdrawalCommission(299), 0);
assert.strictEqual(getAepsWithdrawalCommission(2000), 6);
assert.strictEqual(getAepsWithdrawalCommission(3000), 11);
assert.strictEqual(getAepsWithdrawalCommission(7999), 11);
assert.strictEqual(getAepsWithdrawalCommission(8000), 12);
assert.strictEqual(getDistributorCommission('AEPS_WITHDRAWAL', 2000), 2);
assert.strictEqual(getDistributorCommission('AEPS_WITHDRAWAL', 5000), 0.5);
assert.strictEqual(admin('AEPS_WITHDRAWAL', getAepsWithdrawalCommission, 2000), 1);
assert.strictEqual(admin('AEPS_WITHDRAWAL', getAepsWithdrawalCommission, 5000), 2);
assert.strictEqual(admin('AEPS_WITHDRAWAL', getAepsWithdrawalCommission, 10000), 1);

// AEPS deposit: 0.20% / ₹8 merchant, ₹0.25 / ₹0.50 partner.
assert.strictEqual(getAepsDepositCommission(299), 0);
assert.strictEqual(getAepsDepositCommission(1000), 2);
assert.strictEqual(getAepsDepositCommission(2999), 6);
assert.strictEqual(getAepsDepositCommission(3000), 8);
assert.strictEqual(getDistributorCommission('AEPS_DEPOSIT', 1000), 0.25);
assert.strictEqual(admin('AEPS_DEPOSIT', getAepsDepositCommission, 1000), 1.95);
assert.strictEqual(admin('AEPS_DEPOSIT', getAepsDepositCommission, 5000), 4.25);

// Micro ATM: ₹13.5 = 4 admin + 0.5 partner + 9 merchant.
assert.strictEqual(getMatmCommission(299), 0);
assert.strictEqual(getMatmCommission(400), 1.2);
assert.strictEqual(getMatmCommission(1000), 3);
assert.strictEqual(getMatmCommission(5000), 9);
assert.strictEqual(admin('MATM', getMatmCommission, 5000), 4);
assert.strictEqual(admin('MATM', getMatmCommission, 400), 0.6);
assert.strictEqual(admin('MATM', getMatmCommission, 1000), 0.5);

// Recharge partner is a flat ₹0.20; BBPS partner ₹0.25 except FASTag and credit card.
assert.strictEqual(getDistributorCommission('RECHARGE', 500), 0.2);
assert.strictEqual(getDistributorCommission('BILL_PAYMENT', 900, 'Electricity'), 0.25);
assert.strictEqual(getDistributorCommission('BILL_PAYMENT', 900, 'FASTag'), 0);
assert.strictEqual(getDistributorCommission('BILL_PAYMENT', 900, 'Credit Card'), 0);
assert.strictEqual(getBbpsCommission(900, 'Electricity'), 1);
assert.strictEqual(getBbpsCommission(1000, 'FASTag'), 0.5);
assert.strictEqual(getBbpsCommission(1000, 'Credit Card'), 0);
assert.strictEqual(getBbpsCharge('Credit Card'), 10);
assert.strictEqual(getBbpsCharge('Electricity'), 0);

// DMT charge slabs, plus 18% GST.
assert.deepStrictEqual(getDmtCharge(1000), { fee: 6, gst: 1.08, total: 7.08 });
assert.strictEqual(getDmtCharge(2000).fee, 6);
assert.strictEqual(getDmtCharge(3000).fee, 7);
assert.strictEqual(getDmtCharge(4000).fee, 8);
assert.strictEqual(getDmtCharge(5000).total, 10.62);
assert.strictEqual(getDistributorCommission('DMT', 5000), 0.25);

// PAN ₹1 and ITR ₹25 to the partner.
assert.strictEqual(getDistributorCommission('PAN_SERVICE'), 1);
assert.strictEqual(getDistributorCommission('ITR', 600), 25);
assert.strictEqual(getDistributorCommission('GST_REGISTRATION', 600), 0);

console.log('commission rate card: all assertions passed');
