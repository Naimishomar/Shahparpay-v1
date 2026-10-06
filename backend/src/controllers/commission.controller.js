import {
  getAepsWithdrawalCommission,
  getAepsDepositCommission,
  getMatmCommission,
  getRechargeCommissionRate,
  getBbpsCommissionRule,
  getBbpsCharge,
  getDmtCharge,
  commissionTdsRate,
  PAN_RATES,
  LEAD_RATES,
} from '../utils/wallet.util.js';

/**
 * The published commission rates.
 *
 * Every number here is read back out of the same functions that credit the
 * wallet, never retyped. A rate change in wallet.util.js therefore shows on the
 * public page automatically, and the page can never advertise a rate the
 * platform does not actually pay.
 */

// Probed at a representative amount inside each slab, so the figures shown are
// the ones a retailer would really be credited.
const AEPS_WITHDRAWAL_SLABS = [
  { label: 'Below ₹300', sample: 200 },
  { label: '₹300 – ₹2,999', sample: 2000 },
  { label: '₹3,000 – ₹10,000', sample: 5000 },
];

const AEPS_DEPOSIT_SLABS = [
  { label: 'Below ₹500', sample: 300 },
  { label: '₹500 – ₹2,999', sample: 2000 },
  { label: '₹3,000 – ₹10,000', sample: 5000 },
];

const MATM_SLABS = [
  { label: 'Below ₹500', sample: 300 },
  { label: '₹500 – ₹2,999', sample: 2000 },
  { label: '₹3,000 – ₹10,000', sample: 5000 },
];

// Probed at the top of each DMT charge slab.
const DMT_SLABS = [
  { label: '₹100 – ₹1,000', sample: 1000 },
  { label: '₹1,001 – ₹2,000', sample: 2000 },
  { label: '₹2,001 – ₹3,000', sample: 3000 },
  { label: '₹3,001 – ₹4,000', sample: 4000 },
  { label: '₹4,001 – ₹5,000', sample: 5000 },
];

const PREPAID_OPERATORS = [
  { name: 'BSNL', probe: 'BSNL TOPUP' },
  { name: 'Vodafone Idea (Vi)', probe: 'Vodafone Idea' },
  { name: 'Airtel', probe: 'Airtel Prepaid' },
  { name: 'MTNL', probe: 'MTNL Delhi' },
  { name: 'Reliance Jio', probe: 'Reliance Jio' },
];

const DTH_OPERATORS = [
  { name: 'Airtel Digital TV', probe: 'Airtel Digital TV' },
  { name: 'Dish TV', probe: 'Dish TV' },
  { name: 'Videocon d2h', probe: 'Videocon D2H' },
  { name: 'Sun Direct', probe: 'Sun Direct' },
  { name: 'Tata Play', probe: 'Tata Play' },
];

const BBPS_SERVICES = [
  { name: 'Electricity', probe: 'electricity' },
  { name: 'Water', probe: 'water' },
  { name: 'Gas & LPG', probe: 'gas' },
  { name: 'Loan & EMI', probe: 'loan' },
  { name: 'Insurance premium', probe: 'insurance' },
  { name: 'FASTag', probe: 'fastag' },
  { name: 'Other billers', probe: 'other' },
];

export const getPublicCommissionRates = async (req, res) => {
  try {
    const tdsPercent = commissionTdsRate() * 100;

    const withdrawal = AEPS_WITHDRAWAL_SLABS.map(({ label, sample }) => ({
      label,
      // 0.35% inside the first paid slab, flat rupees above it. Reported as the
      // amount earned on the sample so the retailer sees a real figure.
      sample,
      earns: getAepsWithdrawalCommission(sample),
    }));

    const deposit = AEPS_DEPOSIT_SLABS.map(({ label, sample }) => ({
      label,
      sample,
      earns: getAepsDepositCommission(sample),
    }));

    const matm = MATM_SLABS.map(({ label, sample }) => ({
      label,
      sample,
      earns: getMatmCommission(sample),
    }));

    // Charges the retailer pays, rather than earns.
    const charges = [
      ...DMT_SLABS.map(({ label, sample }) => ({
        name: `Money transfer ${label}`,
        fee: getDmtCharge(sample).fee,
        plusGst: true,
      })),
      { name: 'Credit card bill payment', fee: getBbpsCharge('creditcard'), plusGst: false },
    ];

    // Sorted rather than hand-ordered: a rate change in wallet.util.js would
    // otherwise leave a lower-paying operator sitting above a higher one.
    const map = (list, mode) =>
      list
        .map(({ name, probe }) => ({ name, percent: getRechargeCommissionRate(probe, mode) }))
        .sort((a, b) => b.percent - a.percent);

    const bbps = BBPS_SERVICES.map(({ name, probe }) => {
      const rule = getBbpsCommissionRule(probe);
      return { name, kind: rule.kind, value: rule.value };
    });

    return res.status(200).json({
      success: true,
      data: {
        aeps: { withdrawal, deposit, tdsPercent },
        matm,
        pan: { fee: PAN_RATES.fee, earns: PAN_RATES.retailer },
        charges,
        leads: [
          { name: 'Zero-balance savings account', earns: LEAD_RATES.SA.retailer },
          { name: 'Credit card', earns: LEAD_RATES.CC.retailer },
          { name: 'Instant loan', earns: LEAD_RATES.IL.retailer },
        ],
        prepaid: map(PREPAID_OPERATORS, 'prepaid'),
        dth: map(DTH_OPERATORS, 'dth'),
        bbps,
        // Services with no published rate card yet. Listed explicitly rather
        // than silently omitted, so the page can say "on request" instead of
        // leaving a retailer to assume they earn nothing.
        onRequest: ['ITR filing', 'Personal & business loan leads', 'UPI QR collections'],
      },
    });
  } catch (error) {
    console.error('[Commission] getPublicCommissionRates failed:', error);
    return res.status(500).json({ success: false, message: 'Could not load commission rates.' });
  }
};
