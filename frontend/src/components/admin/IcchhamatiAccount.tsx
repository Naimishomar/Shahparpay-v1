import { useState } from 'react';
import { ArrowRight, Landmark, Loader2, RefreshCcw, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, inr, useApiGet } from '../distributor/shared';
import { Skeleton } from '../distributor/ui';

type IcchWallet = { id: number; name: string; number: string; isPrimary: boolean; balance: number; available: number; hold: number; active: boolean };
type Payout = {
    id: number; transactionId: string; name: string | null; mobile: string | null; bankName: string | null; ifsc: string | null;
    account: string | null; amount: number; charge: number; type: string | null; status: string; utr: string | null; message: string | null; createdAt: string | null;
};
type PayoutPage = { rows: Payout[]; page: number; lastPage: number; total: number };

const STATUS_PILL: Record<string, string> = {
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
};
const PENDING = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';

/**
 * Shahparpay's own Icchhamati account: the float every retailer transacts
 * through, the payouts sent from it, and moving money between its wallets.
 */
const IcchhamatiAccount = ({ token }: { token: string | null }) => {
    const wallets = useApiGet<IcchWallet[]>(token, '/api/admin/icchhamati/wallets');
    const [filters, setFilters] = useState({ search: '', status: '', date_from: '', date_to: '' });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const query = new URLSearchParams({ page: String(page), per_page: '25', ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) });
    const payouts = useApiGet<PayoutPage>(token, `/api/admin/icchhamati/payouts?${query}`);

    const primary = wallets.data?.find((w) => w.isPrimary);
    const targets = wallets.data?.filter((w) => !w.isPrimary && w.active) ?? [];
    const [transfer, setTransfer] = useState({ targetAccountId: '', amount: '', mpin: '', details: '' });
    const [sending, setSending] = useState(false);

    const sendTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transfer.targetAccountId) return toast.error('Choose the wallet to transfer into.');
        if (!(Number(transfer.amount) > 0)) return toast.error('Enter a valid amount.');
        if (!/^\d{4}$/.test(transfer.mpin)) return toast.error('Enter the 4-digit Icchhamati MPIN.');
        const target = targets.find((w) => String(w.id) === transfer.targetAccountId);
        if (!window.confirm(`Move ${inr.format(Number(transfer.amount))} from ${primary?.name ?? 'the primary wallet'} to ${target?.name}?`)) return;
        setSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/icchhamati/self-transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(transfer),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(json.message || 'Transfer completed');
            setTransfer({ targetAccountId: '', amount: '', mpin: '', details: '' });
            wallets.reload();
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Transfer failed');
        } finally {
            // The MPIN is never kept around after an attempt.
            setTransfer((t) => ({ ...t, mpin: '' }));
            setSending(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Landmark className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Icchhamati account</h1>
                            <p className="text-sm text-muted-foreground">The company float every retailer transacts through. Admins only.</p>
                        </div>
                    </div>
                    <button onClick={() => { wallets.reload(); payouts.reload(); }} className={`${SECONDARY_BUTTON} py-2`}><RefreshCcw size={16} /> Refresh</button>
                </div>
            </section>

            {wallets.error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{wallets.error}</p>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {wallets.loading && !wallets.data
                    ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
                    : wallets.data?.map((w) => (
                        <div key={w.id} className={CARD}>
                            <div className="flex items-center justify-between gap-2">
                                <p className="flex items-center gap-2 font-semibold"><Wallet size={16} /> {w.name}</p>
                                {w.isPrimary && <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold">Primary</span>}
                            </div>
                            <p className="mt-3 text-2xl font-bold tabular-nums">{inr.format(w.available)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                <span className="font-mono">{w.number}</span>{w.hold > 0 && <> · {inr.format(w.hold)} on hold</>}{!w.active && ' · inactive'}
                            </p>
                        </div>
                    ))}
            </div>

            {primary && targets.length > 0 && (
                <form onSubmit={sendTransfer} className={`${CARD} space-y-4`}>
                    <div>
                        <p className="text-lg font-semibold">Move money between wallets</p>
                        <p className="text-sm text-muted-foreground">Icchhamati moves money out of the primary wallet ({primary.name}) only. Nothing leaves the account.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        <label className="block space-y-1.5"><span className="text-sm font-medium">To</span>
                            <select value={transfer.targetAccountId} onChange={(e) => setTransfer({ ...transfer, targetAccountId: e.target.value })} className={INPUT}>
                                <option value="" disabled>Select wallet</option>
                                {targets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.number})</option>)}
                            </select>
                        </label>
                        <label className="block space-y-1.5"><span className="text-sm font-medium">Amount</span>
                            <input value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder={`Up to ${inr.format(primary.available)}`} className={INPUT} />
                        </label>
                        <label className="block space-y-1.5"><span className="text-sm font-medium">Icchhamati MPIN</span>
                            <input value={transfer.mpin} onChange={(e) => setTransfer({ ...transfer, mpin: e.target.value.replace(/\D/g, '').slice(0, 4) })} type="password" inputMode="numeric" autoComplete="off" className={`${INPUT} font-mono tracking-[0.4em]`} />
                        </label>
                        <label className="block space-y-1.5"><span className="text-sm font-medium">Note (optional)</span>
                            <input value={transfer.details} onChange={(e) => setTransfer({ ...transfer, details: e.target.value })} className={INPUT} />
                        </label>
                    </div>
                    <button disabled={sending} className={PRIMARY_BUTTON}>{sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Transfer</button>
                </form>
            )}

            <section className={CARD}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-lg font-semibold">Payouts</p>
                        <p className="text-sm text-muted-foreground">IMPS / NEFT sent from the Icchhamati account{payouts.data ? ` · ${payouts.data.total} total` : ''}</p>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }} className="flex flex-wrap items-end gap-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, account, UTR…" className={`${INPUT} w-56 pl-9`} />
                        </div>
                        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={`${INPUT} w-36`}>
                            <option value="">All statuses</option>
                            <option value="success">Success</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                        </select>
                        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={`${INPUT} w-40 dark:[color-scheme:dark]`} aria-label="From date" />
                        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={`${INPUT} w-40 dark:[color-scheme:dark]`} aria-label="To date" />
                        <button className={`${SECONDARY_BUTTON} py-2.5`}>Apply</button>
                    </form>
                </div>

                {payouts.error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{payouts.error}</p>}
                {payouts.loading && !payouts.data ? (
                    <Skeleton className="h-64 rounded-xl" />
                ) : !payouts.data?.rows.length ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No payouts match.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`border-b text-left ${LABEL}`}>
                                    {['Date', 'Beneficiary', 'Bank', 'Amount', 'Mode', 'UTR', 'Reference', 'Status'].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {payouts.data.rows.map((p) => (
                                    <tr key={p.id}>
                                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleString('en-IN') : '—'}</td>
                                        <td className="py-3 pr-4"><p className="font-medium">{p.name || '—'}</p><p className="text-xs text-muted-foreground">{p.mobile}</p></td>
                                        <td className="py-3 pr-4"><p>{p.bankName || '—'}</p><p className="font-mono text-xs text-muted-foreground">{p.account} · {p.ifsc}</p></td>
                                        <td className="py-3 pr-4 font-medium tabular-nums">{inr.format(p.amount)}{p.charge > 0 && <p className="text-xs text-muted-foreground">+{inr.format(p.charge)} fee</p>}</td>
                                        <td className="py-3 pr-4">{p.type || '—'}</td>
                                        <td className="py-3 pr-4 font-mono text-xs">{p.utr || '—'}</td>
                                        <td className="py-3 pr-4 font-mono text-xs">{p.transactionId}</td>
                                        <td className="py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${STATUS_PILL[p.status] || PENDING}`} title={p.message || undefined}>{p.status || 'pending'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {payouts.data && payouts.data.lastPage > 1 && (
                    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={`${SECONDARY_BUTTON} py-1.5`}>Previous</button>
                        <span className="text-muted-foreground">Page {payouts.data.page} of {payouts.data.lastPage}</span>
                        <button disabled={page >= payouts.data.lastPage} onClick={() => setPage(page + 1)} className={`${SECONDARY_BUTTON} py-1.5`}>Next</button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default IcchhamatiAccount;
