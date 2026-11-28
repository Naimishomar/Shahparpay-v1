import { icchhamatiGet, icchhamatiPost, isOk, providerMessage, fetchRechargeStatus, fetchPayoutStatus, normaliseStatus } from '../utils/icchhamati.util.js';
import { logActivity } from '../utils/activity.js';
import { parseLedgerDetails, istDate, MATCH_FIELDS, refsOf, refVariants, pickMatch } from '../utils/icchhamatiLedger.js';
import { upiCwOutcome, answerIsFor } from '../utils/upiCashWithdrawal.js';
import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';
import Setting from '../models/setting.model.js';

/**
 * Shahparpay's own Icchhamati account, for admins: its wallets, the payouts
 * sent from it, and moving money between its wallets.
 *
 * Every retailer transacts through this one account, so none of this is for
 * retailers or distributors: the payouts carry other retailers' customers'
 * bank details, and the wallets are the company's float.
 *
 * These are Icchhamati's own portal endpoints, not their documented partner
 * API. They answer to our mid/mkey today, but may change without notice.
 */

const forbid = (req, res) => {
  if (req.user?.role === 'admin') return false;
  res.status(403).json({ success: false, message: 'Unauthorized access' });
  return true;
};

const unreachable = (res, label, error) => {
  console.error(`Icchhamati admin ${label} error:`, error?.message);
  return res.status(502).json({ success: false, message: 'Could not reach Icchhamati. Please try again.' });
};

const amountOf = (value) => {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Wallet rows without the full account number and UPI handle. */
export const toWallet = (row) => ({
  id: row.id,
  name: row.name || row.wallet_type,
  number: row.number,
  isPrimary: Boolean(row.is_primary ?? row.primary_status),
  balance: amountOf(row.raw_balance ?? row.balance),
  available: amountOf(row.raw_available_balance ?? row.available_balance),
  hold: amountOf(row.raw_hold_amount ?? row.hold_amount),
  active: Number(row.status) === 1,
});

const fetchWallets = async () => {
  const data = await icchhamatiGet('/api/accounts');
  if (!isOk(data)) return { error: providerMessage(data, 'Could not load Icchhamati wallets.') };
  const rows = data.data?.accounts ?? data.data ?? [];
  return { wallets: (Array.isArray(rows) ? rows : []).map(toWallet) };
};

/** GET /api/admin/icchhamati/wallets */
export const getWallets = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const { wallets, error } = await fetchWallets();
    if (error) return res.status(502).json({ success: false, message: error });
    return res.status(200).json({ success: true, data: wallets });
  } catch (error) {
    return unreachable(res, 'wallets', error);
  }
};

const PAYOUT_FILTERS = ['search', 'status', 'date_from', 'date_to'];

/** GET /api/admin/icchhamati/payouts?page&per_page&search&status&date_from&date_to */
export const getPayouts = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const params = {
      page: Math.max(1, Number(req.query.page) || 1),
      per_page: Math.min(100, Math.max(1, Number(req.query.per_page) || 25)),
    };
    for (const key of PAYOUT_FILTERS) {
      const value = String(req.query[key] ?? '').trim();
      if (value) params[key] = value.slice(0, 64);
    }
    const data = await icchhamatiGet('/api/v2/payouts', params);
    if (!isOk(data)) {
      return res.status(502).json({ success: false, message: providerMessage(data, 'Could not load Icchhamati payouts.') });
    }
    const page = data.data || {};
    const rows = Array.isArray(page.data) ? page.data : Array.isArray(page) ? page : [];
    return res.status(200).json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          transactionId: r.transaction_id,
          name: r.name ?? r.beneficiary?.name ?? null,
          mobile: r.mobile ?? null,
          bankName: r.bank_name ?? null,
          ifsc: r.ifsc ?? null,
          account: r.account ?? null,
          amount: amountOf(r.amount),
          charge: amountOf(r.charge),
          type: r.type ?? null,
          status: String(r.status ?? '').toLowerCase(),
          utr: r.utr ?? null,
          message: r.message ?? null,
          createdAt: r.created_at ?? null,
        })),
        page: page.current_page ?? params.page,
        lastPage: page.last_page ?? 1,
        total: page.total ?? rows.length,
      },
    });
  } catch (error) {
    return unreachable(res, 'payouts', error);
  }
};

/**
 * POST /api/admin/icchhamati/self-transfer { targetAccountId, amount, mpin, details? }
 *
 * Icchhamati moves money out of the primary wallet only, into another of our
 * own wallets. The MPIN is Icchhamati's; it is forwarded and never stored or
 * logged.
 */
export const selfTransfer = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const { targetAccountId, mpin, details } = req.body || {};
    const amount = Number(req.body?.amount);
    if (!/^\d{4}$/.test(String(mpin ?? ''))) {
      return res.status(400).json({ success: false, message: 'Enter the 4-digit Icchhamati MPIN.' });
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(req.body?.amount ?? '')) || !(amount > 0)) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount.' });
    }

    const { wallets, error } = await fetchWallets();
    if (error) return res.status(502).json({ success: false, message: error });
    const source = wallets.find((w) => w.isPrimary);
    const target = wallets.find((w) => String(w.id) === String(targetAccountId));
    if (!target || target.isPrimary) {
      return res.status(400).json({ success: false, message: 'Choose a non-primary wallet to transfer into.' });
    }
    if (source && amount > source.available) {
      return res.status(400).json({ success: false, message: `The ${source.name} has only ₹${source.available} available.` });
    }

    const data = await icchhamatiPost('/api/accounts/self-transfer', {
      target_account_id: target.id,
      amount,
      mpin: String(mpin),
      details: String(details || 'Self Transfer from Primary Account').slice(0, 100),
    });
    if (!isOk(data)) {
      return res.status(400).json({ success: false, message: providerMessage(data, 'Transfer failed.') });
    }
    logActivity({
      req,
      action: 'icchhamati.self_transfer',
      summary: `Moved ₹${amount} from ${source?.name || 'primary wallet'} to ${target.name} on Icchhamati`,
      meta: { amount, from: source?.id ?? null, to: target.id },
    });
    return res.status(200).json({ success: true, message: providerMessage(data, 'Transfer completed.') });
  } catch (error) {
    return unreachable(res, 'self-transfer', error);
  }
};

/** GET /api/admin/icchhamati/upicw/history?page&search */
export const getProviderUpiCwHistory = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const params = {
      page: Math.max(1, Number(req.query.page) || 1),
    };
    if (req.query.search) params.search = String(req.query.search).trim();
    const data = await icchhamatiGet('/api/v2/upicw/history', params);
    if (!isOk(data)) {
      return res.status(502).json({ success: false, message: providerMessage(data, 'Could not load Icchhamati UPI CW history.') });
    }
    return res.status(200).json({ success: true, data: data.data || {} });
  } catch (error) {
    return unreachable(res, 'UPI CW history', error);
  }
};


/** One line of an Icchhamati wallet's statement; amounts arrive as "-₹4.00", "₹16,173.50". */
export const toLedgerRow = (r) => ({
  id: r.id,
  details: r.details ?? null,
  type: r.type === 'DR' ? 'DR' : 'CR',
  amount: Math.abs(amountOf(r.amount)),
  preBalance: amountOf(r.pre_balance),
  balance: amountOf(r.balance),
  date: r.date ?? null,
  ...parseLedgerDetails(r.details),
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/admin/icchhamati/wallets/:id/ledger?page&per_page&date_from&date_to */
export const getWalletLedger = async (req, res) => {
  if (forbid(req, res)) return;
  const id = String(req.params.id ?? '');
  if (!/^\d+$/.test(id)) return res.status(400).json({ success: false, message: 'Invalid wallet.' });
  try {
    const params = {
      page: Math.max(1, Number(req.query.page) || 1),
      per_page: Math.min(100, Math.max(1, Number(req.query.per_page) || 25)),
    };
    // Icchhamati filters only when both ends are given; one end alone means that one day.
    const from = DAY.test(req.query.date_from) ? req.query.date_from : null;
    const to = DAY.test(req.query.date_to) ? req.query.date_to : null;
    if (from || to) { params.start_date = from || to; params.end_date = to || from; }

    const data = await icchhamatiGet(`/api/accounts/${id}`, params);
    if (!isOk(data)) {
      return res.status(502).json({ success: false, message: providerMessage(data, 'Could not load the wallet statement.') });
    }
    const rows = Array.isArray(data.data?.recent_transactions) ? data.data.recent_transactions : [];
    const pg = data.data?.pagination || {};
    return res.status(200).json({
      success: true,
      data: { rows: rows.map(toLedgerRow), page: pg.current_page ?? params.page, lastPage: pg.last_page ?? 1, total: pg.total ?? rows.length },
    });
  } catch (error) {
    return unreachable(res, 'ledger', error);
  }
};

// ---------------------------------------------------------------- statement

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STATEMENT_PAGES = 30;

/** Every line of one wallet's statement between two IST days, all pages. */
const fetchStatement = async (walletId, from, to) => {
  const rows = [];
  for (let page = 1; page <= MAX_STATEMENT_PAGES; page += 1) {
    const data = await icchhamatiGet(`/api/accounts/${walletId}`, { page, per_page: 100, start_date: from, end_date: to });
    if (!isOk(data)) throw new Error(providerMessage(data, 'Could not load the wallet statement.'));
    const batch = Array.isArray(data.data?.recent_transactions) ? data.data.recent_transactions : [];
    rows.push(...batch.map(toLedgerRow));
    if (page >= Number(data.data?.pagination?.last_page || 1) || !batch.length) break;
  }
  return rows;
};

/** Statement lines of every wallet for one IST day, each tagged with its wallet. */
const fetchDayStatement = async (day) => {
  const { wallets, error } = await fetchWallets();
  if (error) throw new Error(error);
  const perWallet = await Promise.all(
    wallets.map(async (w) => (await fetchStatement(w.id, day, day)).map((r) => ({ ...r, walletId: w.id, wallet: w.name })))
  );
  return { wallets, entries: perWallet.flat() };
};

const OUR_FIELDS = 'transactionId type status amount createdAt userId metadata commissions';

/** Our transactions sharing a reference with any of `entries`, around their dates. */
const candidatesFor = async (entries) => {
  const refs = [...new Set(entries.map((e) => e.ref).filter(Boolean))];
  if (!refs.length) return [];
  const times = entries.map((e) => istDate(e.date)?.getTime()).filter(Boolean);
  const from = new Date((times.length ? Math.min(...times) : Date.now()) - 2 * DAY_MS);
  const to = new Date((times.length ? Math.max(...times) : Date.now()) + 2 * DAY_MS);
  const values = refVariants(refs);
  // ponytail: metadata fields are unindexed, so this scans the date window; add
  // indexes on the busiest ref fields if the window ever grows past a few days.
  return Transaction.find({ createdAt: { $gte: from, $lte: to }, $or: MATCH_FIELDS.map((f) => ({ [f]: { $in: values } })) })
    .select(OUR_FIELDS)
    .populate('userId', 'name retailerId businessName')
    .lean();
};

/** What the admin sees of one of our transactions next to a statement line. */
const toOurs = (t) => t && ({
  id: String(t._id),
  transactionId: t.transactionId,
  type: t.type,
  status: t.status,
  amount: t.amount,
  createdAt: t.createdAt,
  retailer: t.userId ? { id: String(t.userId._id), name: t.userId.name, retailerId: t.userId.retailerId, businessName: t.userId.businessName } : null,
  commissions: t.commissions || null,
  message: t.metadata?.apiMessage || t.metadata?.gatewayMessage || null,
});

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayIst = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * GET /api/admin/icchhamati/ledger-match?ref&date&amount&role
 * The transaction of ours one statement line belongs to, for its detail view.
 */
export const getLedgerMatch = async (req, res) => {
  if (forbid(req, res)) return;
  const ref = String(req.query.ref ?? '').trim().slice(0, 64);
  if (!ref) return res.status(200).json({ success: true, data: null });
  try {
    const entry = { ref, date: String(req.query.date ?? ''), amount: Number(req.query.amount) || 0, role: String(req.query.role ?? 'principal') };
    const match = pickMatch(entry, await candidatesFor([entry]));
    return res.status(200).json({ success: true, data: toOurs(match) });
  } catch (error) {
    console.error('Icchhamati ledger match error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not look up the matching transaction.' });
  }
};

// ----------------------------------------------------------- reconciliation

/** Services whose every success shows on the statement; only these can be "missing at Icchhamati". */
const STATEMENT_TYPES = ['AEPS_WITHDRAWAL', 'UPI_CASH_WITHDRAWAL', 'RECHARGE', 'BILL_PAYMENT', 'PG_COLLECTION', 'DMT', 'AEPS_SETTLEMENT'];
const OPEN = ['PENDING', 'PROCESSING'];
const CLOSED_BAD = ['FAILED', 'REFUNDED', 'REJECTED'];
// A transaction this close to midnight may be booked on the next day at Icchhamati.
const EDGE_MS = 15 * 60 * 1000;

/**
 * Lines up one IST day of Icchhamati's statement against our transactions.
 * Pure, so the rules can be tested without the provider or the database.
 */
export const reconcileDay = ({ day, entries, candidates, ours, now = Date.now() }) => {
  const issues = [];
  const used = new Set();
  const refunded = new Set(entries.filter((e) => e.role === 'refund' && e.ref).map((e) => String(e.ref)));
  let matched = 0;

  for (const e of entries.filter((x) => x.role === 'principal' && x.ref)) {
    const t = pickMatch(e, candidates, used);
    const entry = { id: e.id, wallet: e.wallet, date: e.date, details: e.details, label: e.label, ref: e.ref, type: e.type, amount: e.amount };
    if (!t) {
      issues.push({ kind: 'missing_ours', entry });
      continue;
    }
    used.add(String(t._id));
    const our = toOurs(t);
    if (OPEN.includes(t.status)) issues.push({ kind: 'stuck_ours', entry, ours: our });
    else if (CLOSED_BAD.includes(t.status) && !refunded.has(String(e.ref))) issues.push({ kind: 'failed_ours', entry, ours: our });
    else if (Math.abs(Number(t.amount) - e.amount) >= 0.01 && t.type !== 'BILL_PAYMENT') issues.push({ kind: 'amount', entry, ours: our });
    else matched += 1;
  }

  const start = istDate(`${day} 00:00:00`).getTime();
  for (const t of ours) {
    const at = new Date(t.createdAt).getTime();
    if (used.has(String(t._id)) || at - start < EDGE_MS || start + DAY_MS - at < EDGE_MS || now - at < EDGE_MS) continue;
    issues.push({ kind: 'missing_theirs', ours: toOurs(t) });
  }

  return { matched, issues };
};

/** GET /api/admin/icchhamati/reconcile?date=YYYY-MM-DD (IST day, today by default) */
export const getReconciliation = async (req, res) => {
  if (forbid(req, res)) return;
  const day = DAY_RE.test(req.query.date) ? req.query.date : todayIst();
  try {
    const { wallets, entries } = await fetchDayStatement(day);
    const start = istDate(`${day} 00:00:00`);
    const [candidates, ours] = await Promise.all([
      candidatesFor(entries.filter((e) => e.role === 'principal')),
      Transaction.find({
        createdAt: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) },
        status: 'SUCCESS',
        type: { $in: STATEMENT_TYPES },
        'metadata.provider': /^icchhamati$/i,
      }).select(OUR_FIELDS).populate('userId', 'name retailerId businessName').lean(),
    ]);
    const { matched, issues } = reconcileDay({ day, entries, candidates, ours });
    const sum = (list, type) => list.filter((e) => e.type === type).reduce((a, e) => a + e.amount, 0);
    return res.status(200).json({
      success: true,
      data: {
        day,
        wallets: wallets.map((w) => {
          const mine = entries.filter((e) => e.walletId === w.id);
          return { id: w.id, name: w.name, entries: mine.length, credits: sum(mine, 'CR'), debits: sum(mine, 'DR') };
        }),
        entries: entries.length,
        principal: entries.filter((e) => e.role === 'principal').length,
        ours: ours.length,
        matched,
        issues,
      },
    });
  } catch (error) {
    return unreachable(res, 'reconcile', error);
  }
};

// ------------------------------------------------------------- status check

const PAYOUT_TYPES = ['DMT', 'AEPS_SETTLEMENT', 'DIRECT_PAYOUT'];

/** Icchhamati's own answer for one of our transactions. Reads only; settles nothing. */
const askProvider = async (t) => {
  const m = t.metadata || {};
  if (t.type === 'RECHARGE' || t.type === 'BILL_PAYMENT') {
    const { finalStatus, data } = await fetchRechargeStatus(m.orderId || m.operatorTxnId || t.transactionId, t);
    return { source: 'Bill / recharge status', status: finalStatus === 'PROCESSING' ? 'PENDING' : finalStatus, message: providerMessage(data, '') || null };
  }
  if (PAYOUT_TYPES.includes(t.type)) {
    const { finalStatus, data } = await fetchPayoutStatus(m.providerTxnId || m.apiResponse?.data?.transaction_id || m.refid || t.transactionId);
    return { source: 'Payout listing', status: finalStatus === 'PROCESSING' ? 'PENDING' : finalStatus, message: data?.message || null, utr: data?.utr && data.utr !== 'NA' ? data.utr : null };
  }
  if (t.type === 'UPI_CASH_WITHDRAWAL') {
    const data = await icchhamatiPost('/api/v2/upicw/check-status', { partnerRequestId: m.partnerRequestId, fingpayTxnId: m.fingpayTxnId });
    if (!answerIsFor(t, data)) return { source: 'UPI cash withdrawal status', status: 'UNKNOWN', message: 'Icchhamati answered for a different transaction.' };
    return { source: 'UPI cash withdrawal status', status: upiCwOutcome(data, t.createdAt), message: providerMessage(data, '') || null };
  }
  if (t.type === 'PG_COLLECTION') {
    const data = await icchhamatiPost('/api/pg/verify', { txnid: t.transactionId });
    const inner = String(data?.data?.status ?? '').trim();
    return { source: 'Payment gateway', status: inner ? normaliseStatus(inner) : 'UNKNOWN', message: providerMessage(data, '') || null };
  }
  return null;
};

/**
 * GET /api/admin/icchhamati/status?q=<our id, Icchhamati id, RRN or UTR>
 * Our record, Icchhamati's status answer where it publishes one, and the
 * statement lines carrying the transaction's references on its day.
 */
export const getStatusCheck = async (req, res) => {
  if (forbid(req, res)) return;
  const q = String(req.query.q ?? '').trim().slice(0, 64);
  if (!q) return res.status(400).json({ success: false, message: 'Enter a transaction id, RRN or UTR.' });
  try {
    const values = refVariants([q]);
    const t = await Transaction.findOne({ $or: MATCH_FIELDS.map((f) => ({ [f]: { $in: values } })) })
      .sort({ createdAt: -1 })
      .select(OUR_FIELDS)
      .populate('userId', 'name retailerId businessName')
      .lean();
    if (!t) return res.status(404).json({ success: false, message: 'No Shahparpay transaction has that reference.' });

    const day = new Date(new Date(t.createdAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const refs = refsOf(t);
    const [provider, statement] = await Promise.all([
      askProvider(t).catch((e) => ({ source: 'Status API', status: 'UNKNOWN', message: e.message })),
      fetchDayStatement(day).then(({ entries }) => entries.filter((e) => e.ref && refs.includes(String(e.ref)))).catch(() => null),
    ]);

    // With no status API, a principal line on the statement is Icchhamati's answer.
    const principal = statement?.find((e) => e.role === 'principal');
    const refund = statement?.find((e) => e.role === 'refund');
    const theirs = provider?.status
      ?? (refund ? 'FAILED' : principal ? 'SUCCESS' : statement ? 'NOT_FOUND' : 'UNKNOWN');
    const ours = ['APPROVED'].includes(t.status) ? 'SUCCESS' : CLOSED_BAD.includes(t.status) ? 'FAILED' : OPEN.includes(t.status) ? 'PENDING' : t.status;
    const verdict = ['UNKNOWN', 'NOT_FOUND'].includes(theirs) || (theirs === 'PENDING' && ours === 'PENDING') ? 'unknown' : theirs === ours ? 'match' : 'mismatch';

    return res.status(200).json({
      success: true,
      data: { ours: toOurs(t), provider: provider || { source: 'Wallet statement', status: theirs, message: null }, statement: statement || [], statementError: statement === null, verdict },
    });
  } catch (error) {
    return unreachable(res, 'status check', error);
  }
};

// ------------------------------------------------------------ beneficiaries

const maskAccount = (v) => (v ? `•••• ${String(v).slice(-4)}` : null);

/** GET /api/admin/icchhamati/beneficiaries?page */
export const getBeneficiaries = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const data = await icchhamatiGet('/api/v2/beneficiaries', { page, per_page: 25 });
    if (!isOk(data)) return res.status(502).json({ success: false, message: providerMessage(data, 'Could not load beneficiaries.') });
    const pg = data.data || {};
    const rows = Array.isArray(pg.data) ? pg.data : [];
    const yes = (v) => v === true || v === 1 || v === '1' || v === 'true';
    return res.status(200).json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          name: r.name ?? null,
          mobile: r.mobile ?? null,
          account: maskAccount(r.account),
          ifsc: r.ifsc ?? null,
          bank: r.bank ?? null,
          branch: r.branch ?? null,
          verified: yes(r.account_verified),
          active: Number(r.status) === 1,
          payments: Number(r.payment_count) || 0,
          lastPaidAt: r.last_payment_date ?? null,
          createdAt: r.created_at ?? null,
        })),
        page: pg.current_page ?? page,
        lastPage: pg.last_page ?? 1,
        total: pg.total ?? rows.length,
      },
    });
  } catch (error) {
    return unreachable(res, 'beneficiaries', error);
  }
};

// ---------------------------------------------------------- AEPS onboarding

const STEP_ORDER = ['register', 'pan', 'mobile', 'email', 'aadhaar', 'bank', 'video', 'video_review', 'onboard', 'ekyc', 'twofa', 'ready'];
const DONE_STEPS = ['twofa', 'ready'];

/** GET /api/admin/icchhamati/aeps-onboarding — how many retailers stand at each step, and who is stuck. */
export const getAepsOnboarding = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    const active = { isActive: { $ne: false } };
    const [counts, stuck] = await Promise.all([
      Retailer.aggregate([{ $match: active }, { $group: { _id: { $ifNull: ['$icchhamatiAeps.step', 'register'] }, n: { $sum: 1 } } }]),
      Retailer.find({ ...active, 'icchhamatiAeps.step': { $nin: DONE_STEPS } })
        .select('name retailerId businessName icchhamatiAeps.step icchhamatiAeps.stepAt createdAt distributorId')
        .populate('distributorId', 'name')
        .sort({ 'icchhamatiAeps.stepAt': 1, createdAt: 1 })
        .limit(300)
        .lean(),
    ]);
    const byStep = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    return res.status(200).json({
      success: true,
      data: {
        steps: STEP_ORDER.map((step) => ({ step, count: byStep[step] || 0 })),
        done: DONE_STEPS.reduce((a, s) => a + (byStep[s] || 0), 0),
        total: counts.reduce((a, c) => a + c.n, 0),
        retailers: stuck.map((r) => ({
          id: String(r._id),
          name: r.name,
          retailerId: r.retailerId,
          businessName: r.businessName,
          step: r.icchhamatiAeps?.step || 'register',
          stepAt: r.icchhamatiAeps?.stepAt || null,
          joinedAt: r.createdAt,
          distributor: r.distributorId?.name || null,
        })),
      },
    });
  } catch (error) {
    console.error('AEPS onboarding summary error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load AEPS onboarding.' });
  }
};

// -------------------------------------------------------- low-balance alert

export const LOW_BALANCE_KEY = 'icchhamatiLowBalance';

/** { thresholds: { [walletId]: rupees }, alerted: { [walletId]: ISO date } } */
export const readLowBalance = async () => {
  const doc = await Setting.findOne({ key: LOW_BALANCE_KEY }).lean();
  return { thresholds: doc?.value?.thresholds || {}, alerted: doc?.value?.alerted || {} };
};

/** GET /api/admin/icchhamati/alerts */
export const getLowBalanceAlerts = async (req, res) => {
  if (forbid(req, res)) return;
  try {
    return res.status(200).json({ success: true, data: await readLowBalance() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not load alert settings.' });
  }
};

/** PUT /api/admin/icchhamati/alerts { walletId, threshold } — 0 turns the alert off. */
export const setLowBalanceAlert = async (req, res) => {
  if (forbid(req, res)) return;
  const walletId = String(req.body?.walletId ?? '');
  const threshold = Number(req.body?.threshold);
  if (!/^\d+$/.test(walletId)) return res.status(400).json({ success: false, message: 'Invalid wallet.' });
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1e8) {
    return res.status(400).json({ success: false, message: 'Enter an amount between ₹0 and ₹10,00,00,000.' });
  }
  try {
    const value = await readLowBalance();
    if (threshold > 0) value.thresholds[walletId] = Math.round(threshold * 100) / 100;
    else delete value.thresholds[walletId];
    // A changed threshold is judged afresh on the next check.
    delete value.alerted[walletId];
    await Setting.findOneAndUpdate({ key: LOW_BALANCE_KEY }, { value }, { upsert: true });
    logActivity({
      req,
      action: 'icchhamati.low_balance_alert',
      summary: threshold > 0 ? `Set Icchhamati low-balance alert at ₹${threshold} for wallet ${walletId}` : `Turned off Icchhamati low-balance alert for wallet ${walletId}`,
      meta: { walletId, threshold },
    });
    return res.status(200).json({ success: true, data: value, message: threshold > 0 ? 'Alert saved' : 'Alert turned off' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not save the alert.' });
  }
};

export { fetchWallets };
