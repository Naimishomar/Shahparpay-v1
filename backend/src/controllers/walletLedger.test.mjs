// Run: node src/controllers/walletLedger.test.mjs
// The ledger is reconstructed from Transaction rows, so a transaction type the
// schema refuses never reaches it — the row is never written, the money moved
// anyway, and the reconstruction quietly rebalances around the hole. Two things
// are pinned here: every type a controller writes is a type the schema accepts,
// and every accepted type lands in the right wallet with the right sign.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import Transaction from '../models/transaction.model.js';
import { getWalletDeltas, getWalletLabel, getNarration } from './walletLedger.controller.js';

const TYPES = Transaction.schema.path('type').enumValues;

// --- the schema accepts everything the code writes ------------------------

const sources = ['controllers', 'utils', 'workers'].flatMap((dir) => {
  const base = new URL(`../${dir}/`, import.meta.url);
  return readdirSync(base)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(new URL(f, base), 'utf8'));
});

// `type: 'X'` also matches PaySprint's own transactiontype codes (BE, CW, MS,
// M, IMPS), which are payload fields, not Transaction types. Every real type is
// either multi-word or long, so that is the filter.
const written = new Set(
  sources
    .flatMap((src) => [...src.matchAll(/\btype: '([A-Z][A-Z_]*)'/g)].map((m) => m[1]))
    .filter((t) => t.includes('_') || t.length >= 8)
);

for (const type of written) {
  assert.ok(
    TYPES.includes(type),
    `a controller writes type '${type}' but transaction.model.js rejects it — ` +
      `every such row fails validation and never reaches the ledger`
  );
}

// --- and every accepted type has a defined ledger effect ------------------

const tx = (type, over = {}) => ({
  transactionId: 'TXN1',
  type,
  amount: 100,
  commissions: { retailerEarned: 0 },
  ...over,
});

// Which wallet each type moves, and in which direction. Getting this wrong
// does not crash — it shows the retailer a balance that never happened.
const EXPECTED = {
  AEPS_WITHDRAWAL: ['aeps', +1],
  AADHAAR_PAY: ['aeps', +1],
  AEPS_SETTLEMENT: ['aeps', -1],
  WALLET_TOPUP: ['main', +1],
  FUND_REQUEST: ['main', +1],
  DIRECT_PAYOUT_REFUND: ['main', +1],
  AEPS_DEPOSIT_REFUND: ['main', +1],
  FUND_TRANSFER: ['main', -1],
  RECHARGE: ['main', -1],
  BILL_PAYMENT: ['main', -1],
  DMT: ['main', -1],
  DIRECT_PAYOUT: ['main', -1],
  AEPS_DEPOSIT: ['main', -1],
  PAN_CARD: ['main', -1],
  STD_PAN_CARD: ['main', -1],
  PAN_COUPON: ['main', -1],
  PAN_SERVICE: ['main', -1],
  ITR: ['main', -1],
  GST_REGISTRATION: ['main', -1],
  UPI_CASHOUT: ['main', -1],
  DAILY_AUTH_CHARGE: ['main', -1],
  MERCHANT_ONBOARDING_CHARGE: ['main', -1],
};

// AEPSTOMAIN is the one type that moves both wallets at once.
const aepsToMain = getWalletDeltas(tx('AEPSTOMAIN'));
assert.strictEqual(aepsToMain.main, 100);
assert.strictEqual(aepsToMain.aeps, -100);

for (const type of TYPES) {
  if (type === 'AEPSTOMAIN') continue;
  const expected = EXPECTED[type];
  assert.ok(expected, `${type} is in the schema enum but has no pinned ledger effect here`);
  const [wallet, sign] = expected;
  const delta = getWalletDeltas(tx(type));
  const other = wallet === 'main' ? 'aeps' : 'main';

  assert.strictEqual(delta[other], 0, `${type} must not touch the ${other} wallet`);
  assert.strictEqual(
    Math.sign(delta[wallet]),
    sign,
    `${type} must ${sign > 0 ? 'credit' : 'debit'} the ${wallet} wallet`
  );
  assert.strictEqual(Math.abs(delta[wallet]), 100, `${type} must move the full amount`);
}

// The onboarding charge is a plain MAIN debit — no commission, no TDS, and it
// must not be mistaken for an AEPS row in the all-wallets view.
assert.strictEqual(getWalletLabel(tx('MERCHANT_ONBOARDING_CHARGE')), 'Main');
assert.ok(
  getNarration(tx('MERCHANT_ONBOARDING_CHARGE', { metadata: { requestId: '322432' } })).includes(
    '322432'
  ),
  'the onboarding charge should name the PaySprint request it came from'
);

// A refund row credits back to the wallet its original type debited, whatever
// the type says — the `REF-` prefix is the only signal.
assert.strictEqual(getWalletDeltas(tx('AEPS_WITHDRAWAL', { transactionId: 'REF-X' })).aeps, 100);
assert.strictEqual(getWalletDeltas(tx('RECHARGE', { transactionId: 'REF-X' })).main, 100);

// Withdrawal commission is credited net of 2% TDS on top of the amount.
assert.strictEqual(
  getWalletDeltas(tx('AEPS_WITHDRAWAL', { commissions: { retailerEarned: 10 } })).aeps,
  109.8
);
// Cash-deposit commission carries no TDS, but the deposit itself is a debit.
assert.strictEqual(
  getWalletDeltas(tx('AEPS_DEPOSIT', { commissions: { retailerEarned: 5 } })).main,
  -95
);

console.log(`walletLedger: ${TYPES.length} transaction types map to a wallet effect OK`);
