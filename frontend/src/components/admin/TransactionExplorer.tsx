import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Filter, Loader2, Receipt, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { CARD, INPUT, LABEL, PENDING_PILL, SECONDARY_BUTTON, SILVER_TILE, STATUS_PILL, SERVICE_LABELS, inr, inrShort, useApiGet } from '../distributor/shared';
import { Skeleton } from '../distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Every Transaction.type on the backend, services first.
const TYPES = [
    'AEPS_WITHDRAWAL', 'AEPS_DEPOSIT', 'AADHAAR_PAY', 'MATM', 'DMT', 'DIRECT_PAYOUT', 'RECHARGE', 'BILL_PAYMENT',
    'PAN_CARD', 'STD_PAN_CARD', 'PAN_SERVICE', 'PAN_COUPON', 'ITR', 'GST_REGISTRATION', 'PG_COLLECTION',
    'WALLET_TOPUP', 'FUND_REQUEST', 'FUND_TRANSFER', 'AEPSTOMAIN', 'QRTO_MAIN', 'AEPS_SETTLEMENT',
    'DIRECT_PAYOUT_REFUND', 'AEPS_DEPOSIT_REFUND', 'DAILY_AUTH_CHARGE', 'MERCHANT_ONBOARDING_CHARGE',
];
const TYPE_LABEL = (t: string) => SERVICE_LABELS[t] || t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const STATUSES = ['SUCCESS', 'PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'APPROVED', 'REJECTED'];

export type TxnQuery = Partial<Record<'q' | 'type' | 'status' | 'from' | 'to' | 'retailer' | 'distributor', string>>;

type Result = {
    rows: any[];
    total: number;
    page: number;
    limit: number;
    summary: { volume: number; success: number; failed: number; adminEarned: number };
};

const qs = (q: TxnQuery, extra: Record<string, string | number>) =>
    new URLSearchParams(Object.entries({ ...q, ...extra }).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, String(v)])).toString();

const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const TransactionExplorer = ({
    token, initial, onOpenUser,
}: {
    token: string | null;
    initial: TxnQuery;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
}) => {
    const [draft, setDraft] = useState<TxnQuery>(initial);
    const [query, setQuery] = useState<TxnQuery>(initial);
    const [pageNo, setPageNo] = useState(1);
    const [selected, setSelected] = useState<any>(null);
    const [exporting, setExporting] = useState(false);
    const limit = 25;

    const { data, loading, error } = useApiGet<Result>(token, `/api/admin/console/transactions?${qs(query, { page: pageNo, limit })}`);
    const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
    const apply = (next: TxnQuery) => { setQuery(next); setPageNo(1); };
    const activeFilters = Object.entries(query).filter(([, v]) => v);

    const exportCsv = async () => {
        setExporting(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/transactions?${qs(query, { page: 1, limit: 1000 })}`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            const header = ['Date', 'Transaction ID', 'Type', 'Status', 'Amount', 'Retailer', 'Retailer ID', 'Distributor', 'Admin earned', 'Distributor earned', 'Retailer earned'];
            const lines = json.data.rows.map((t: any) => [
                new Date(t.createdAt).toISOString(), t.transactionId, t.type, t.status, t.amount,
                t.userId?.name, t.userId?.retailerId, t.userId?.distributorId?.name,
                t.commissions?.adminEarned ?? 0, t.commissions?.distributorEarned ?? 0, t.commissions?.retailerEarned ?? 0,
            ].map(csvCell).join(','));
            const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
            Object.assign(document.createElement('a'), { href: url, download: `transactions-${new Date().toISOString().slice(0, 10)}.csv` }).click();
            URL.revokeObjectURL(url);
            if (json.data.total > 1000) toast.message(`Exported the latest 1,000 of ${json.data.total.toLocaleString('en-IN')}. Narrow the filters for the rest.`);
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col gap-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Receipt className="h-7 w-7" /></div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
                                <p className="text-sm text-muted-foreground">Every transaction by every retailer, searchable.</p>
                            </div>
                        </div>
                        <button onClick={exportCsv} disabled={exporting || !data?.total} className={`${SECONDARY_BUTTON} py-2`}>
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
                        </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            ['Matching', data ? data.total.toLocaleString('en-IN') : '–'],
                            ['Volume', data ? inrShort(data.summary.volume) : '–'],
                            ['Success / failed', data ? `${data.summary.success.toLocaleString('en-IN')} / ${data.summary.failed.toLocaleString('en-IN')}` : '–'],
                            ['Admin earned', data ? inr.format(data.summary.adminEarned) : '–'],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border bg-background/70 backdrop-blur p-4">
                                <p className={LABEL}>{label}</p>
                                <p className="mt-1.5 truncate text-xl font-bold tabular-nums">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Filters */}
            <form
                onSubmit={(e) => { e.preventDefault(); apply(draft); }}
                className={`${CARD} grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]`}
            >
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={draft.q || ''} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Txn ID, UTR, retailer name / ID / mobile" className={`${INPUT} pl-9`} />
                </div>
                <select value={draft.type || ''} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={INPUT} aria-label="Type">
                    <option value="">All types</option>
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL(t)}</option>)}
                </select>
                <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={INPUT} aria-label="Status">
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="date" value={draft.from || ''} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${INPUT} dark:[color-scheme:dark]`} aria-label="From" />
                <input type="date" value={draft.to || ''} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${INPUT} dark:[color-scheme:dark]`} aria-label="To" />
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                    <Filter size={16} /> Apply
                </button>
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-6">
                        {activeFilters.map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
                                <span className="text-muted-foreground">{k}:</span> {k === 'retailer' || k === 'distributor' ? 'selected user' : v}
                                <button type="button" onClick={() => { const next = { ...query, [k]: '' }; setDraft(next); apply(next); }} aria-label={`Clear ${k}`}><X size={12} /></button>
                            </span>
                        ))}
                        <button type="button" onClick={() => { setDraft({}); apply({}); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear all</button>
                    </div>
                )}
            </form>

            <section className={`${CARD} overflow-hidden p-0`}>
                {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Retailer</th>
                                <th className="px-4 py-3 font-medium">Distributor</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium text-right">Admin</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
                            {loading && !data ? (
                                Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-2"><Skeleton className="h-9" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">No transactions match these filters.</td></tr>
                            ) : data.rows.map((t) => (
                                <tr key={t._id} onClick={() => setSelected(t)} className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-4 py-3">
                                        {t.userId ? (
                                            <button onClick={(e) => { e.stopPropagation(); onOpenUser('retailer', t.userId._id); }} className="text-left hover:underline">
                                                <p className="font-medium">{t.userId.name}</p>
                                                <p className="font-mono text-[11px] text-muted-foreground">{t.userId.retailerId}</p>
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.userId?.distributorId ? (
                                            <button onClick={(e) => { e.stopPropagation(); onOpenUser('distributor', t.userId.distributorId._id); }} className="text-left hover:underline">{t.userId.distributorId.name}</button>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3">{TYPE_LABEL(t.type)}</td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr.format(t.amount)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{t.commissions?.adminEarned ? inr.format(t.commissions.adminEarned) : '—'}</td>
                                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[t.status] || PENDING_PILL}`}>{t.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                    <p className={LABEL}>Page {pageNo} of {pages}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </section>

            {/* Detail drawer */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelected(null)}>
                    <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto border-l bg-card p-6 shadow-2xl animate-in slide-in-from-right-8 duration-300">
                        <div className="mb-6 flex items-start justify-between gap-3">
                            <div>
                                <p className={LABEL}>{TYPE_LABEL(selected.type)}</p>
                                <p className="mt-1 text-3xl font-bold tabular-nums">{inr.format(selected.amount)}</p>
                                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[selected.status] || PENDING_PILL}`}>{selected.status}</span>
                            </div>
                            <button onClick={() => setSelected(null)} className="rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close"><X size={18} /></button>
                        </div>
                        <dl className="divide-y rounded-2xl border bg-background text-sm">
                            {[
                                ['Transaction ID', selected.transactionId],
                                ['Date', new Date(selected.createdAt).toLocaleString('en-IN')],
                                ['Retailer', selected.userId ? `${selected.userId.name} (${selected.userId.retailerId})` : '—'],
                                ['Distributor', selected.userId?.distributorId?.name || '—'],
                                ['Admin earned', inr.format(selected.commissions?.adminEarned || 0)],
                                ['Distributor earned', inr.format(selected.commissions?.distributorEarned || 0)],
                                ['Retailer earned', inr.format(selected.commissions?.retailerEarned || 0)],
                                ['Charge deducted', inr.format(selected.commissions?.chargeDeducted || 0)],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="text-right font-medium break-all">{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {selected.metadata && (
                            <div className="mt-4">
                                <p className={`${LABEL} mb-2`}>Provider details</p>
                                <pre className="max-h-96 overflow-auto rounded-2xl border bg-background p-4 text-xs leading-relaxed">{JSON.stringify(selected.metadata, null, 2)}</pre>
                            </div>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
};

export default TransactionExplorer;
