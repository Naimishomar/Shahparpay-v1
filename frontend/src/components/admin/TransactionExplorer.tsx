import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Filter, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_QUIET, FIELD, ICON_BUTTON, SERVICE_LABELS, TABLE, TD, TH, THEAD, TR, inr, inrShort, useApiGet } from '../distributor/shared';
import { Empty, PageHeader, Panel, Skeleton, StatStrip, StatusDot } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';
import { txnRef } from "@/lib/txnRef";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Every Transaction.type on the backend, services first.
const TYPES = [
    'AEPS_WITHDRAWAL', 'AEPS_DEPOSIT', 'AADHAAR_PAY', 'UPI_CASH_WITHDRAWAL', 'MATM', 'DMT', 'DIRECT_PAYOUT', 'RECHARGE', 'BILL_PAYMENT',
    'PAN_CARD', 'STD_PAN_CARD', 'PAN_SERVICE', 'PAN_COUPON', 'ITR', 'GST_REGISTRATION', 'PG_COLLECTION',
    'WALLET_TOPUP', 'FUND_REQUEST', 'FUND_TRANSFER', 'AEPSTOMAIN', 'QRTO_MAIN', 'AEPS_SETTLEMENT',
    'DIRECT_PAYOUT_REFUND', 'AEPS_DEPOSIT_REFUND', 'DAILY_AUTH_CHARGE', 'ACCOUNT_VERIFICATION', 'MERCHANT_ONBOARDING_CHARGE',
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
                new Date(t.createdAt).toISOString(), txnRef(t), t.type, t.status, t.amount,
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

    const stats = data ? [
        { label: 'Matching', value: data.total.toLocaleString('en-IN') },
        { label: 'Volume', value: inrShort(data.summary.volume) },
        { label: 'Success / failed', value: `${data.summary.success.toLocaleString('en-IN')} / ${data.summary.failed.toLocaleString('en-IN')}` },
        { label: 'Admin earned', value: inr.format(data.summary.adminEarned) },
    ] : [];
    const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Money"
                title="Transactions"
                description="Every transaction by every retailer, searchable."
                actions={
                    <button type="button" onClick={exportCsv} disabled={exporting || !data?.total} className={BUTTON_QUIET}>
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={1.75} />} Export CSV
                    </button>
                }
            />

            {(data || loading) && <StatStrip items={stats} loading={loading} />}

            <Panel flush>
                {/* Filters: one toolbar row */}
                <form onSubmit={(e) => { e.preventDefault(); apply(draft); }} className="border-b p-4">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={draft.q || ''} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Txn ID, UTR, retailer name / ID / mobile" className={`${FIELD} pl-9`} />
                        </div>
                        <select value={draft.type || ''} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={FIELD} aria-label="Type">
                            <option value="">All types</option>
                            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL(t)}</option>)}
                        </select>
                        <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={FIELD} aria-label="Status">
                            <option value="">All statuses</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{sentence(s)}</option>)}
                        </select>
                        <input type="date" value={draft.from || ''} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${FIELD} dark:[color-scheme:dark]`} aria-label="From" />
                        <input type="date" value={draft.to || ''} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${FIELD} dark:[color-scheme:dark]`} aria-label="To" />
                        <button type="submit" className={BUTTON}>
                            <Filter size={16} strokeWidth={1.75} /> Apply
                        </button>
                    </div>
                    {activeFilters.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {activeFilters.map(([k, v]) => (
                                <span key={k} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-background pl-2.5 pr-1 text-[13px]">
                                    <span className="text-muted-foreground">{k}</span> {k === 'retailer' || k === 'distributor' ? 'selected user' : v}
                                    <button type="button" onClick={() => { const next = { ...query, [k]: '' }; setDraft(next); apply(next); }} aria-label={`Clear ${k}`} className="rounded p-1 text-muted-foreground hover:text-foreground"><X size={12} /></button>
                                </span>
                            ))}
                            <button type="button" onClick={() => { setDraft({}); apply({}); }} className="text-[13px] text-muted-foreground hover:text-foreground">Clear all</button>
                        </div>
                    )}
                </form>

                {error && <div className={`${ALERT_ERROR} m-4`}>{error}</div>}
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                <th className={TH}>Date</th>
                                <th className={TH}>Retailer</th>
                                <th className={TH}>Distributor</th>
                                <th className={TH}>Type</th>
                                <th className={`${TH} text-right`}>Amount</th>
                                <th className={`${TH} text-right`}>Admin</th>
                                <th className={TH}>Status</th>
                            </tr>
                        </thead>
                        <tbody className={`transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
                            {loading && !data ? (
                                Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-2"><Skeleton className="h-9" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={7}><Empty>No transactions match these filters.</Empty></td></tr>
                            ) : data.rows.map((t) => (
                                <tr key={t._id} onClick={() => setSelected(t)} className={`${TR} cursor-pointer`}>
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className={TD}>
                                        {t.userId ? (
                                            <button onClick={(e) => { e.stopPropagation(); onOpenUser('retailer', t.userId._id); }} className="text-left hover:underline">
                                                <p className="text-foreground">{t.userId.name}</p>
                                                <p className="lp-figure text-[12px] text-muted-foreground">{t.userId.retailerId}</p>
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td className={TD}>
                                        {t.userId?.distributorId ? (
                                            <button onClick={(e) => { e.stopPropagation(); onOpenUser('distributor', t.userId.distributorId._id); }} className="text-left text-foreground hover:underline">{t.userId.distributorId.name}</button>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className={TD}>{TYPE_LABEL(t.type)}</td>
                                    <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(t.amount)}</td>
                                    <td className={`${TD} lp-figure text-right text-muted-foreground`}>{t.commissions?.adminEarned ? inr.format(t.commissions.adminEarned) : '—'}</td>
                                    <td className={TD}><StatusDot status={t.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                    <p className="text-[13px] text-muted-foreground">Page <span className="lp-figure">{pageNo}</span> of <span className="lp-figure">{pages}</span></p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={ICON_BUTTON} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={ICON_BUTTON} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </Panel>

            {/* Detail drawer */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200" onClick={() => setSelected(null)}>
                    <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto border-l bg-card shadow-2xl animate-in slide-in-from-right-8 duration-300">
                        <div className="flex items-start justify-between gap-3 border-b p-6">
                            <div>
                                <p className="text-sm text-muted-foreground">{TYPE_LABEL(selected.type)}</p>
                                <p className="lp-figure mt-1 text-[32px] leading-none tracking-[-0.02em] text-foreground">{inr.format(selected.amount)}</p>
                                <div className="mt-3"><StatusDot status={selected.status} /></div>
                            </div>
                            <button onClick={() => setSelected(null)} className={ICON_BUTTON} aria-label="Close"><X size={16} /></button>
                        </div>
                        <dl className="px-6 py-2 text-sm">
                            {[
                                ['Transaction ID', txnRef(selected)],
                                ['Our reference', selected.transactionId],
                                ['Date', new Date(selected.createdAt).toLocaleString('en-IN')],
                                ['Retailer', selected.userId ? `${selected.userId.name} (${selected.userId.retailerId})` : '—'],
                                ['Distributor', selected.userId?.distributorId?.name || '—'],
                                ['Admin earned', inr.format(selected.commissions?.adminEarned || 0)],
                                ['Distributor earned', inr.format(selected.commissions?.distributorEarned || 0)],
                                ['Retailer earned', inr.format(selected.commissions?.retailerEarned || 0)],
                                ['Charge deducted', inr.format(selected.commissions?.chargeDeducted || 0)],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 border-b py-3 last:border-0">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="break-all text-right text-foreground">{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {selected.metadata && (
                            <div className="border-t px-6 py-5">
                                <p className="mb-2 text-sm text-muted-foreground">Provider details</p>
                                <pre className="max-h-96 overflow-auto rounded-xl border bg-background p-4 text-xs leading-relaxed">{JSON.stringify(selected.metadata, null, 2)}</pre>
                            </div>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
};

export default TransactionExplorer;
