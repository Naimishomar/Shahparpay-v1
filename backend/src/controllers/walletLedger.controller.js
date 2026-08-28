import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';

// Credit types where the wallet receives the transaction amount PLUS the
// retailer's commission (verified against applyAepsWithdrawalSuccess).
const CREDIT_WITH_COMMISSION = new Set(['AEPS_WITHDRAWAL']);

// Credit types where the wallet receives only the transaction amount
// (topups, refunds and AadhaarPay never earn commission on the ledger).
const CREDIT_AMOUNT_ONLY = new Set([
  'AADHAAR_PAY',
  'WALLET_TOPUP',
  'DIRECT_PAYOUT_REFUND',
  'AEPS_DEPOSIT_REFUND',
  'FUND_REQUEST',
  'REFUND',
]);

const MONEY_MOVING_STATUSES = ['SUCCESS', 'REFUNDED', 'APPROVED'];

// Which wallet each transaction actually moves money in/out of.
// Verified against the controllers: daily auth (MAIN), PAN (debitMainWallet),
// ITR (MAIN), GST_REGISTRATION (MAIN), AEPS_SETTLEMENT (AEPS), etc.
const WALLET_LABELS = {
  AEPS_WITHDRAWAL: 'AEPS',
  AADHAAR_PAY: 'AEPS',
  AEPS_SETTLEMENT: 'AEPS',
  AEPSTOMAIN: 'AEPS→Main',
};

export const getWalletLabel = (tx) => WALLET_LABELS[tx.type] || 'Main';

const TXNTYPE_LABELS = {
  AEPS_WITHDRAWAL: 'AEPS Wallet',
  AADHAAR_PAY: 'AadhaarPay',
  WALLET_TOPUP: 'Wallet Topup',
  RECHARGE: 'Recharge',
  BILL_PAYMENT: 'BBPS',
  DMT: 'DMT',
  AEPS_SETTLEMENT: 'Settlement',
  DIRECT_PAYOUT: 'Direct Payout',
  AEPS_DEPOSIT: 'AEPS Deposit',
  PAN_CARD: 'PAN Card',
  PAN_SERVICE: 'PAN Service',
  PAN_COUPON: 'PAN Coupon',
  ITR: 'ITR',
  GST_REGISTRATION: 'GST Registration',
  DAILY_AUTH_CHARGE: 'Daily Auth',
  MERCHANT_ONBOARDING_CHARGE: 'Onboarding Charge',
  AEPSTOMAIN: 'Wallet Transfer',
  DIRECT_PAYOUT_REFUND: 'Refund',
  AEPS_DEPOSIT_REFUND: 'Refund',
  FUND_REQUEST: 'Fund Request',
  FUND_TRANSFER: 'Fund Transfer',
  STD_PAN_CARD: 'PAN Card',
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(toNumber(v) * 100) / 100;

// Refund rows are identified by a `REF-` or `REFUND-` transaction-id prefix
// (AEPS/DIRECT_PAYOUT refunds use `REF-`; historical ITR refunds used `REFUND-`
// and still exist in the database). Both must be recognized so refund credits are
// not miscounted as debits.
const isRefundTxnId = (id) => /^REF(UND)?-/.test(String(id || ''));

export const getNarration = (tx) => {
  const m = tx.metadata || {};
  const isRefund = isRefundTxnId(tx.transactionId);
  if (isRefund)
    return `Refund ${m.originalTxn ? 'for ' + m.originalTxn : 'for failed transaction'}`;

  switch (tx.type) {
    case 'AEPS_WITHDRAWAL':
    case 'AADHAAR_PAY':
      return `Aadhaar *${m.aadhaar ? String(m.aadhaar).slice(-4) : 'N/A'} withdrawal`;
    case 'WALLET_TOPUP':
      return `Wallet Top-up ${m.utr ? 'UTR ' + m.utr : ''}`.trim();
    case 'RECHARGE':
      return `${m.operator || 'Recharge'} ${m.caNumber || ''}`.trim();
    case 'BILL_PAYMENT':
      return `Bill Payment ${m.caNumber || ''}`.trim();
    case 'DMT':
      return `DMT A/C ${m.beneficiaryAccount || 'N/A'}`;
    case 'AEPS_SETTLEMENT':
      return `AEPS Settlement A/C ${m.bankAccount || m.accountNumber || 'N/A'}`;
    case 'DIRECT_PAYOUT':
      return `Direct Payout A/C ${m.bankAccount || m.accountNumber || 'N/A'}`;
    case 'AEPS_DEPOSIT':
      return (
        `AEPS Deposit ${m.aadhaar ? '*' + String(m.aadhaar).slice(-4) : ''}`.trim() ||
        'AEPS Deposit'
      );
    case 'PAN_CARD':
    case 'PAN_SERVICE':
    case 'PAN_COUPON':
    case 'STD_PAN_CARD':
      return `PAN Application ${m.name || ''}`.trim();
    case 'ITR':
      return `ITR Filing ${m.name || ''}`.trim();
    case 'GST_REGISTRATION':
      return `GST Registration ${m.name || ''}`.trim();
    case 'DAILY_AUTH_CHARGE':
      return 'Daily 2FA Auth Charge';
    case 'MERCHANT_ONBOARDING_CHARGE':
      return `PaySprint onboarding charge${m.requestId ? ' ref ' + m.requestId : ''}`;
    case 'AEPSTOMAIN':
      return 'AEPS → Main Transfer';
    default:
      return tx.type ? String(tx.type).replace(/_/g, ' ') : 'Transaction';
  }
};

// AEPS cash-withdrawal retailer commission (slab based).
//   ₹300–₹3000    → 0.35% of the amount
//   ₹3001–₹10000  → flat ₹12
//   below ₹300    → ₹0 (no commission)
// Mirrors getAepsWithdrawalCommission in wallet.util.js.
// Kept only as a reference for the commission display fallback below.
const getAepsWithdrawalCommission = (amount) => {
  const amt = toNumber(amount);
  if (amt < 300) return 0;
  if (amt <= 3000) return round2(amt * 0.0035);
  return 12;
};

/**
 * Splits a transaction's retailer commission into gross, TDS (2%) and the net
 * actually credited to the wallet. The wallet is credited with the commission
 * that was ACTUALLY paid at the time of the transaction, which is the value
 * stored under `commissions.retailerEarned` (gross; TDS tracked separately) —
 * NOT a slab recomputation from the amount. Historical rows predating
 * commission tracking store 0 even for large amounts (the wallet received no
 * commission then), so recomputing from the slab would over-credit AEPS.
 * GST is no longer deducted from commission — only 2% TDS.
 */
const getCommissionSplit = (tx) => {
  const stored = toNumber(tx.commissions?.retailerEarned);
  const gross = round2(stored);
  // Cash-deposit commission is credited in full — no TDS/GST is deducted.
  if (tx.type === 'AEPS_DEPOSIT') {
    return { gross, tds: 0, net: gross };
  }
  const tds = round2(gross * 0.02);
  const net = round2(gross - tds);
  return { gross, tds, net };
};

/**
 * Net effect of a transaction on EACH wallet independently.
 * `main` = change to the Main wallet, `aeps` = change to the AEPS wallet.
 * Positive = money in, negative = money out. AEPSTOMAIN moves AEPS → Main.
 * Commission is credited NET of 2% TDS.
 */
export const getWalletDeltas = (tx) => {
  const amount = toNumber(tx.amount);
  const { net } = getCommissionSplit(tx);
  const isRefund = isRefundTxnId(tx.transactionId);

  // Refund entries always credit back to the same wallet the original used.
  if (isRefund) {
    if (
      tx.type === 'AEPS_WITHDRAWAL' ||
      tx.type === 'AADHAAR_PAY' ||
      tx.type === 'AEPS_SETTLEMENT'
    ) {
      return { main: 0, aeps: round2(amount) };
    }
    return { main: round2(amount), aeps: 0 };
  }

  // Internal transfer AEPS → Main.
  if (tx.type === 'AEPSTOMAIN') {
    return { main: round2(amount), aeps: round2(-amount) };
  }

  // AEPS wallet credits.
  if (CREDIT_WITH_COMMISSION.has(tx.type)) {
    return { main: 0, aeps: round2(amount + net) };
  }
  if (tx.type === 'AADHAAR_PAY') {
    return { main: 0, aeps: round2(amount) };
  }

  // AEPS wallet debit (settlement).
  if (tx.type === 'AEPS_SETTLEMENT') {
    return { main: 0, aeps: round2(-amount) };
  }

  // PAN_SERVICE: the eSevaTech flow applies fee debit + commission credit in a
  // single atomic MAIN wallet update (-fee + retailerEarned), so the ledger must
  // mirror that net impact instead of the plain -amount of other PAN flows.
  if (tx.type === 'PAN_SERVICE') {
    const commission = toNumber(tx.commissions?.retailerEarned);
    return { main: round2(-amount + commission), aeps: 0 };
  }

  // Everything else moves money in/out of the Main wallet.
  if (CREDIT_AMOUNT_ONLY.has(tx.type)) {
    return { main: round2(amount), aeps: 0 };
  }

  // Debit types: money leaves the Main wallet, retailer commission (if any)
  // is credited back net of TDS.
  return { main: round2(-amount + net), aeps: 0 };
};

export const getWalletLedger = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, limit, wallet } = req.query;

    const walletFilter = String(wallet || 'all').toUpperCase();

    const mainWallet = await MainWallet.findOne({ userId });
    const aepsWallet = await AepsWallet.findOne({ userId });
    const currentMain = round2(mainWallet?.balance || 0);
    const currentAeps = round2(aepsWallet?.balance || 0);
    const currentCombined = round2(currentMain + currentAeps);

    const query = {
      userId,
      status: { $in: MONEY_MOVING_STATUSES },
    };

    const transactions = await Transaction.find(query).sort({ createdAt: 1 }).lean();

    // Failed/pending AEPS_SETTLEMENT and DIRECT_PAYOUT transactions moved
    // money at lock time (lockFundsForTransaction) even though they never
    // reached SUCCESS. Their refunds come back either as REF- rows (already
    // in the money-moving set above) or via resolveTransaction (flagged with
    // metadata.refundStatus = COMPLETED, which creates NO transaction row).
    // Include the original debits + synthesized resolveTransaction credits so
    // the reconstruction reconciles exactly with the live wallet balances.
    const refRows = await Transaction.find({ userId, transactionId: /^REF(UND)?-/ }).lean();
    const refOriginalIds = new Set();
    for (const r of refRows) {
      if (r.metadata?.originalTxn) refOriginalIds.add(String(r.metadata.originalTxn));
      refOriginalIds.add(String(r.transactionId).replace(/^REF(UND)?-/, ''));
    }

    const pendingLocks = await Transaction.find({
      userId,
      type: { $in: ['AEPS_SETTLEMENT', 'DIRECT_PAYOUT', 'AEPS_DEPOSIT'] },
      status: { $nin: MONEY_MOVING_STATUSES },
    })
      .sort({ createdAt: 1 })
      .lean();

    const ledgerSource = [...transactions];
    for (const t of pendingLocks) {
      ledgerSource.push(t);
      const refundedViaResolve =
        t.metadata?.refundStatus === 'COMPLETED' && !refOriginalIds.has(String(t.transactionId));
      if (refundedViaResolve) {
        ledgerSource.push({
          ...t,
          _id: t._id,
          transactionId: `REF-${t.transactionId}`,
          amount: Math.abs(toNumber(t.amount)),
          status: 'REFUNDED',
          metadata: {
            ...(t.metadata || {}),
            originalTxn: t.transactionId,
            note: 'Auto-refund for failed transaction',
          },
          createdAt: new Date(new Date(t.createdAt).getTime() + 1),
        });
      }
    }
    ledgerSource.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Per-wallet deltas. The running balance is anchored BACKWARD to the
    // actual wallet documents, so the final CLOSING always equals the live
    // wallet balance (the "header" balance). This stays exact even when
    // wallet money moved outside the money-moving transaction set (e.g. a
    // failed AEPS settlement that was locked and later refunded).
    const deltas = ledgerSource.map((tx) => ({ tx, delta: getWalletDeltas(tx) }));

    const totalMain = deltas.reduce((s, d) => s + d.delta.main, 0);
    const totalAeps = deltas.reduce((s, d) => s + d.delta.aeps, 0);

    // Cumulative sums so each row's backward-anchored balance is O(1).
    let cumMain = 0,
      cumAeps = 0;
    const cum = deltas.map((d) => {
      cumMain += d.delta.main;
      cumAeps += d.delta.aeps;
      return { main: cumMain, aeps: cumAeps };
    });

    const rows = deltas.map(({ tx, delta }, i) => {
      const closingMain = round2(currentMain - (totalMain - cum[i].main));
      const openingMain = round2(closingMain - delta.main);
      const closingAeps = round2(currentAeps - (totalAeps - cum[i].aeps));
      const openingAeps = round2(closingAeps - delta.aeps);

      const { gross, tds, net } = getCommissionSplit(tx);
      const isDailyAuth = tx.type === 'DAILY_AUTH_CHARGE';
      const isRefundRow = isRefundTxnId(tx.transactionId);
      // Commission is never shown on refund rows (refunds credit the amount only).
      const hasCommission =
        gross > 0 && (tx.type === 'AEPS_WITHDRAWAL' || tx.type === 'AEPS_DEPOSIT') && !isRefundRow;

      // TDS (2%) is deducted ONLY from commission-paying transactions, never
      // from the principal. The daily 2FA auth charge is shown under GST (₹1).
      const tdsShown = hasCommission ? tds : 0;
      // Daily 2FA auth charge of ₹1 is shown as GST; commission GST is zero.
      const gstShown = isDailyAuth ? round2(toNumber(tx.amount)) : 0;

      const type =
        delta.main + delta.aeps > 0 ? 'credit' : delta.main + delta.aeps < 0 ? 'debit' : 'transfer';
      const txntype = isRefundRow
        ? 'Refund'
        : TXNTYPE_LABELS[tx.type] || String(tx.type || '').replace(/_/g, ' ');

      return {
        SNO: String(tx.transactionId || tx._id || ''),
        UTR: String(tx.transactionId || tx._id || ''),
        USERNAME: req.user.retailerId || req.user.distributorId || '',
        WALLET: getWalletLabel(tx),
        OPENING: openingMain,
        AMOUNT: round2(toNumber(tx.amount)),
        COMMISSION: hasCommission ? gross : 0,
        TDS: tdsShown,
        GST: gstShown,
        CLOSING: closingMain,
        AEPS_OPENING: openingAeps,
        AEPS_CLOSING: closingAeps,
        MAIN_OPENING: openingMain,
        MAIN_CLOSING: closingMain,
        TYPE: type,
        NARRATION: getNarration(tx),
        remarks: tx.status || '',
        TXNTYPE: txntype,
        DATE: tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
      };
    });

    // Wallet-scoped view: OPENING/CLOSING reflect only that wallet.
    let filtered = rows;
    if (walletFilter === 'AEPS') {
      filtered = filtered.filter((r) => r.AEPS_CLOSING !== r.AEPS_OPENING);
      filtered = filtered.map((r) => ({ ...r, OPENING: r.AEPS_OPENING, CLOSING: r.AEPS_CLOSING }));
    } else if (walletFilter === 'MAIN') {
      filtered = filtered.filter((r) => r.MAIN_CLOSING !== r.MAIN_OPENING);
      filtered = filtered.map((r) => ({ ...r, OPENING: r.MAIN_OPENING, CLOSING: r.MAIN_CLOSING }));
    } else {
      // All-wallets view: show the balance of the wallet each row actually
      // affects. Main-wallet rows (2FA, ITR, PAN, recharge, DMT, payouts…)
      // show the MAIN balance; AEPS rows show the AEPS balance. This makes
      // it obvious that e.g. the ₹1 daily 2FA charge comes OUT of Main.
      filtered = filtered.map((r) => {
        const isAepsRow = r.WALLET === 'AEPS' || r.WALLET === 'AEPS→Main';
        return {
          ...r,
          OPENING: isAepsRow ? r.AEPS_OPENING : r.MAIN_OPENING,
          CLOSING: isAepsRow ? r.AEPS_CLOSING : r.MAIN_CLOSING,
        };
      });
    }

    // Apply date window (balances already account for full history).
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      filtered = filtered.filter((r) => {
        const d = new Date(r.DATE).getTime();
        return d >= start && d <= endMs;
      });
    }

    // Newest first for display.
    filtered = filtered.sort((a, b) => (a.DATE < b.DATE ? 1 : a.DATE > b.DATE ? -1 : 0));

    if (limit) {
      filtered = filtered.slice(0, Number(limit) || filtered.length);
    }

    return res.status(200).json({
      success: true,
      currentCombined,
      currentMain,
      currentAeps,
      wallet: walletFilter === 'AEPS' ? 'AEPS' : walletFilter === 'MAIN' ? 'Main' : 'All',
      total: filtered.length,
      data: filtered,
    });
  } catch (error) {
    console.error('Wallet ledger error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
