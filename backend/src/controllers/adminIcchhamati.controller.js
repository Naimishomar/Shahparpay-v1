import { icchhamatiGet, icchhamatiPost, isOk, providerMessage } from '../utils/icchhamati.util.js';
import { logActivity } from '../utils/activity.js';

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
