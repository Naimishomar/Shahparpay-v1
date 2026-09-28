import { useEffect, useState } from 'react';

// Same class strings as the redesigned retailer pages.
export const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
export const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
export const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
export const PRIMARY_BUTTON = `${ACTIVE_BUTTON} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50`;
export const SECONDARY_BUTTON = 'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border bg-card/70 backdrop-blur px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50';
export const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground';
export const CARD = 'rounded-2xl border bg-card p-6 shadow-sm';

export const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const inrShort = (v: number) =>
    v >= 1e7 ? `₹${(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)}L` : v >= 1e3 ? `₹${(v / 1e3).toFixed(1)}K` : inr.format(v);

export const SERVICE_LABELS: Record<string, string> = {
    AEPS_WITHDRAWAL: 'AEPS Withdrawal',
    AEPS_DEPOSIT: 'AEPS Deposit',
    AADHAAR_PAY: 'Aadhaar Pay',
    MATM: 'Micro ATM',
    DMT: 'DMT',
    DIRECT_PAYOUT: 'Direct Payout',
    RECHARGE: 'Recharge',
    BILL_PAYMENT: 'BBPS',
    PAN_CARD: 'PAN Card',
    STD_PAN_CARD: 'PAN Card',
    PAN_SERVICE: 'PAN Service',
    PAN_COUPON: 'PAN Coupon',
    ITR: 'ITR',
    GST_REGISTRATION: 'GST',
    PG_COLLECTION: 'Collections',
};
export const serviceLabel = (type: string) => SERVICE_LABELS[type] || type.replace(/_/g, ' ');

export const STATUS_PILL: Record<string, string> = {
    SUCCESS: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    FAILED: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
    REFUNDED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20',
};
export const PENDING_PILL = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';

/** "3h ago", "2d ago" — for last-active columns where the exact time is noise. */
export const ago = (value?: string | null) => {
    if (!value) return 'Never';
    const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const daysSince = (value?: string | null) =>
    value ? Math.floor((Date.now() - new Date(value).getTime()) / 86400000) : Infinity;

/** Percent change vs the previous period; null when there is nothing to compare against. */
export const delta = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export type Totals = { earned: number; volume: number; count: number };
export type TrendPoint = Totals & { date: string };
export type ServiceRow = Totals & { type: string };

export type NetworkRetailer = Totals & {
    _id: string;
    name: string;
    retailerId?: string;
    businessName?: string;
    profilePicture?: string;
    isMerchantKycComplete?: boolean;
    createdAt: string;
    lastAt: string | null;
    lifetimeEarned: number;
    lastActiveAt: string | null;
};

export type RecentTxn = {
    _id: string;
    transactionId: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    commissions?: { distributorEarned?: number };
    retailer?: { _id: string; name: string; retailerId?: string } | null;
};

export type NetworkAnalytics = {
    days: number;
    totals: Totals & { activeRetailers: number; totalRetailers: number };
    previous: Totals;
    lifetimeEarned: number;
    trend: TrendPoint[];
    byService: ServiceRow[];
    retailers: NetworkRetailer[];
    recent: RecentTxn[];
};

export type RetailerPerformance = Omit<NetworkAnalytics, 'retailers' | 'totals'> & {
    totals: Totals & { activeRetailers: number };
    lastActiveAt: string | null;
};

/**
 * Fetches `path` with the bearer token and refetches when `days` changes.
 * State is only set from the response, keyed by request, so `loading` is just
 * "the last result is for a different request".
 */
export function useDistributorData<T>(token: string | null, path: string | null, days: number) {
    const key = path ? `${path}${path.includes('?') ? '&' : '?'}days=${days}` : null;
    const [result, setResult] = useState<{ key: string | null; data: T | null; error: string }>({ key: null, data: null, error: '' });

    useEffect(() => {
        if (!token || !key) return;
        let cancelled = false;
        fetch(`${import.meta.env.VITE_BACKEND_URL}${key}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((json) => {
                if (cancelled) return;
                setResult((prev) => json.success
                    ? { key, data: json.data, error: '' }
                    : { key, data: prev.data, error: json.message || 'Could not load data' });
            })
            .catch(() => !cancelled && setResult((prev) => ({ key, data: prev.data, error: 'Network error. Please try again.' })));
        return () => {
            cancelled = true;
        };
    }, [token, key]);

    // Previous data stays on screen while a new range loads, so charts animate instead of blanking.
    return { data: result.data, loading: result.key !== key, error: result.key === key ? result.error : '' };
}

export const RANGES = [7, 30, 90] as const;

