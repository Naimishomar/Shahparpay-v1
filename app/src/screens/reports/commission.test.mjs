// Run: node src/screens/reports/commission.test.mjs
// Home's Earnings tile and the wallet ledger report the same money two ways:
// the ledger's COMMISSION column is GROSS, while Home sums retailerNetCommission,
// which is net of 2% TDS. They differed by exactly the TDS with nothing on
// either screen saying so. This pins gross - TDS = net across both sides.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const here = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const reports = here('./index.tsx');
const walletUtil = here('../../../../backend/src/utils/wallet.util.js');
const ledgerCtl = here('../../../../backend/src/controllers/walletLedger.controller.js');
const dashboardCtl = here('../../../../backend/src/controllers/dashboard.controller.js');

// --- backend: Home's tile is net, the ledger column is gross ---------------
assert.ok(
  /stats\.TotalCommission \+= retailerNetCommission\(txn\)/.test(dashboardCtl),
  'Home Earnings must still come from retailerNetCommission'
);
assert.ok(
  /const net = round2\(gross - tds\)/.test(ledgerCtl),
  'the ledger must still split commission into gross/tds/net'
);
assert.ok(
  /COMMISSION: hasCommission \? gross : 0/.test(ledgerCtl),
  'the COMMISSION column is the GROSS figure — the app label depends on it'
);
assert.ok(/TDS: tdsShown/.test(ledgerCtl), 'the ledger must expose TDS for the app to net off');

// --- both sides net off the SAME quantity ---------------------------------
for (const [name, src] of [['retailerNetCommission', walletUtil], ['getCommissionSplit', ledgerCtl]]) {
  assert.ok(
    /stored(Tds)? === undefined \|\| stored(Tds)? === null \? fallback/.test(src) &&
      /: gross \* 0\.02;/.test(src),
    `${name} must fall back to 2% TDS for rows booked before the field existed`
  );
}

// --- the app shows the web ledger's footer, gross commission and TDS apart --
// (frontend/src/pages/WalletLedger.tsx): Commission is the gross column and
// TDS sits beside it, so gross - TDS is the net Home reports.
const summary = reports.slice(
  reports.indexOf('const ledgerTiles'),
  reports.indexOf('const LEDGER_STATUSES')
);
for (const label of ['Net Amount', 'Commission', 'TDS', 'GST (18%)']) {
  assert.ok(summary.includes(`label: '${label}'`), `the ledger must show the web's ${label} total`);
}
const web = here('../../../../frontend/src/pages/WalletLedger.tsx');
assert.ok(/GST \(18%\)/.test(web) && />Commission</.test(web), 'the web footer labels changed — follow them');

console.log('commission: ledger shows gross commission and TDS as the web does OK');
