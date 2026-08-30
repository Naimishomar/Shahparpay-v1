// Run: node src/screens/reports/ledger.test.mjs
// The wallet ledger answers with uppercase column names, not the camelCase
// transaction shape every other report uses. Reading the wrong keys fails
// silently — no crash, no empty state, just ₹0.00 rows with an UNKNOWN pill —
// so this ties the screen's accessors to the backend that feeds them.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const reports = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
const walletLedger = readFileSync(
  new URL('../../../../backend/src/controllers/walletLedger.controller.js', import.meta.url),
  'utf8'
);

/** The block of JSX for one report component. */
const componentSource = (name) => {
  const start = reports.indexOf(`export const ${name}`);
  assert.ok(start > -1, `${name} not found`);
  const end = reports.indexOf('export const ', start + 10);
  return reports.slice(start, end === -1 ? undefined : end);
};

// --- the backend really does emit these column names ----------------------
for (const key of ['UTR', 'WALLET', 'AMOUNT', 'TYPE', 'NARRATION', 'TXNTYPE', 'DATE']) {
  assert.ok(
    new RegExp(`\\b${key}:`).test(walletLedger),
    `walletLedger.controller no longer returns ${key} — the app mapping must follow`
  );
}
assert.ok(/remarks: tx\.status/.test(walletLedger), 'wallet ledger status still rides on `remarks`');
// A failed row must carry WHY it failed; the gateways write it under either key.
assert.ok(
  /REASON: tx\.metadata\?\.apiMessage \|\| tx\.metadata\?\.gatewayMessage/.test(walletLedger),
  'wallet ledger must emit REASON from apiMessage/gatewayMessage'
);
// --- and the screens read exactly those ----------------------------------
const wallet = componentSource('WalletLedgerReport');
for (const key of ['UTR', 'WALLET', 'TYPE', 'NARRATION', 'DATE', 'remarks', 'REASON']) {
  assert.ok(wallet.includes(`?.${key}`), `WalletLedgerReport must read i?.${key}`);
}

// --- the shared money helpers, exercised for real ------------------------
// Lift the whole helper block in one slice and strip the type annotations;
// picking the functions out individually is fragile when they sit adjacent.
const blockStart = reports.indexOf('/** Signed amount:');
const blockEnd = reports.indexOf('const LEDGER_STATUSES');
assert.ok(blockStart > -1 && blockEnd > blockStart, 'ledger helper block not found');
const helperSource = reports
  .slice(blockStart, blockEnd)
  .replace('(i: any)', '(i)')
  .replace('(rows: any[])', '(rows)')
  .replace(/\(key: string\)/g, '(key)')
  .replace(/ as const/g, '');

const { ledgerAmount, ledgerSummary } = new Function(
  `const money = (v) => 'INR' + Number(v ?? 0).toFixed(2);
   ${helperSource}
   return { ledgerAmount, ledgerSummary };`
)();

// Credits add, debits subtract — otherwise the net total counts money leaving
// the wallet as money arriving.
assert.strictEqual(ledgerAmount({ TYPE: 'credit', AMOUNT: 500 }), 500);
assert.strictEqual(ledgerAmount({ TYPE: 'debit', AMOUNT: 500 }), -500);
assert.strictEqual(ledgerAmount({ TYPE: 'DEBIT', AMOUNT: 500 }), -500, 'case-insensitive');
assert.strictEqual(ledgerAmount({ AMOUNT: 500 }), 500, 'missing TYPE is not a debit');
assert.strictEqual(ledgerAmount({}), 0, 'a malformed row must not produce NaN');

// The tiles the web portal shows: net, commission, TDS, GST — never a
// "failed" count, which is meaningless in a ledger of money that moved.
const tiles = ledgerSummary([
  { TYPE: 'credit', AMOUNT: 1000, COMMISSION: 12, TDS: 1.2, GST: 2.16 },
  { TYPE: 'debit', AMOUNT: 400, COMMISSION: 0, TDS: 0, GST: 0 },
  { TYPE: 'credit', AMOUNT: 250, COMMISSION: 3 },
]);
assert.deepStrictEqual(
  tiles.map((tile) => tile.label),
  ['Net amount', 'Commission', 'TDS', 'GST']
);
assert.strictEqual(tiles[0].value, 'INR850.00', '1000 - 400 + 250');
assert.strictEqual(tiles[1].value, 'INR15.00');
assert.strictEqual(tiles[2].value, 'INR1.20');
assert.strictEqual(tiles[3].value, 'INR2.16', 'a missing GST column counts as zero, not NaN');
assert.strictEqual(tiles[0].tone, 'success');

// A net outflow reads as negative, not as a failure-free green.
assert.strictEqual(ledgerSummary([{ TYPE: 'debit', AMOUNT: 100 }])[0].tone, 'error');

// Empty range must not divide by zero or render NaN.
assert.strictEqual(ledgerSummary([])[0].value, 'INR0.00');

// The camelCase keys that were silently returning undefined must not return.
for (const [name, source] of [['WalletLedgerReport', wallet]]) {
  for (const stale of [
    '?.transactionId',
    '?.narration',
    '?.openingBalance',
    '?.closingBalance',
    '?.refid',
    '?.opening_bal',
    '?.closing_bal',
    '?.createdAt',
  ]) {
    assert.ok(!source.includes(stale), `${name} still reads the stale key ${stale}`);
  }
}

// The ledger must use the shared signed-amount and summary helpers.
for (const [name, source] of [['WalletLedgerReport', wallet]]) {
  assert.ok(source.includes('amountOf={ledgerAmount}'), `${name} must sign debits negative`);
  assert.ok(source.includes('summary={ledgerSummary}'), `${name} needs the ledger money tiles`);
  assert.ok(source.includes('statuses={LEDGER_STATUSES}'), `${name} filters by CREDIT/DEBIT`);
}

// The reason rides on the card for failed rows only — a successful row would
// otherwise repeat its gateway message ("Settlement successful") as a subtitle.
const ledgerFailed = new Function(
  `return ${/const ledgerFailed = (\(i: any\) => .*);/.exec(reports)[1].replace('(i: any)', '(i)')};`
)();
assert.strictEqual(ledgerFailed({ remarks: 'FAILED' }), true);
assert.strictEqual(ledgerFailed({ remarks: 'REJECTED' }), true);
assert.strictEqual(ledgerFailed({ remarks: 'SUCCESS' }), false);
assert.strictEqual(ledgerFailed({}), false, 'a row with no status is not a failure');
assert.ok(
  wallet.includes('ledgerFailed(i) ? i?.REASON'),
  'WalletLedgerReport must show the reason on failed cards'
);

// StatusPill has to colour a ledger direction, not fall through to UNKNOWN.
const screen = readFileSync(new URL('../../components/ui/Screen.tsx', import.meta.url), 'utf8');
assert.ok(/CREDIT: \{ tone: 'success'/.test(screen), 'CREDIT needs a StatusPill mapping');
assert.ok(/DEBIT: \{ tone: 'info'/.test(screen), 'DEBIT needs a StatusPill mapping');

console.log('reports: ledger field mapping matches the backend OK');
