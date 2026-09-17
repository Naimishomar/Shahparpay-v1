// Run: node src/screens/retailer/walletTransfer.test.mjs
// /api/wallet/transfer is transferQrToMain on the backend: it debits the QR
// wallet. The app screen used to offer the AEPS balance and validate against
// it, so a retailer with AEPS money and an empty QR wallet was shown a
// transfer the server could only refuse. This ties the screen's wallet to the
// one the controller actually moves.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const here = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const screen = here('./WalletTransferScreen.tsx');
const api = here('../../services/api.ts');
const controller = here('../../../../backend/src/controllers/wallet.controller.js');
const route = here('../../../../backend/src/routes/wallet.route.js');

// --- the backend route really is the QR -> MAIN transfer -------------------
assert.ok(
  /router\.post\('\/transfer',\s*transferQrToMain\)/.test(route),
  '/api/wallet/transfer is no longer transferQrToMain — the app must follow'
);
assert.ok(
  /transferBetweenWallets\(userId, 'QR', 'MAIN'/.test(controller),
  'transferQrToMain must debit QR and credit MAIN'
);
// ...and the balance payload really carries qrBalance.
assert.ok(/qrBalance: qrWallet\.balance/.test(controller), 'getBalances must return qrBalance');

// --- the app spends the QR wallet, not the AEPS one ------------------------
assert.ok(
  /const available = balances\.data\?\.qrBalance/.test(screen),
  'the transfer must be validated against the QR balance'
);
assert.ok(
  !/const available = balances\.data\?\.aepsBalance/.test(screen),
  'the AEPS balance is not what this endpoint moves'
);
assert.ok(/api\.transferQrToMain\(/.test(screen), 'screen must call transferQrToMain');
// Comments stripped first: the method documents its old name right above it.
const apiCode = api.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.ok(
  /async transferQrToMain\(/.test(apiCode) && !/transferAepsToMain/.test(apiCode),
  'the api method must be named for the wallet it actually debits'
);

// --- and qrBalance is threaded through the shared balance type -------------
assert.ok(/qrBalance: number/.test(here('../../types/index.ts')), 'WalletBalances needs qrBalance');

console.log('wallet transfer: app debits the same QR wallet the backend does OK');
