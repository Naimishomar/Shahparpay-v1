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
    /storedTds === undefined \|\| storedTds === null \? gross \* 0\.02/.test(src) ||
      /stored === undefined \|\| stored === null \? gross \* 0\.02/.test(src),
    `${name} must fall back to 2% TDS for rows booked before the field existed`
  );
}

// --- the app reconciles them instead of showing gross alone ---------------
const summary = reports.slice(
  reports.indexOf('const ledgerSummary'),
  reports.indexOf('const LEDGER_STATUSES')
);
assert.ok(/money\(gross - tds\)/.test(summary), 'the earned tile must be net of TDS');
assert.ok(/Commission earned/.test(summary) && /Commission \(gross\)/.test(summary),
  'both the net and the gross must be labelled as such');
assert.ok(
  !/label: 'Commission',/.test(summary),
  'a bare "Commission" label is the ambiguity this fixes'
);

console.log('commission: ledger gross - TDS reconciles with Home net earnings OK');
