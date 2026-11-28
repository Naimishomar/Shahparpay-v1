import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_QUIET, FIELD, ICON_BUTTON, TABLE, TD, TH, THEAD, TR, inr, useApiGet } from '../distributor/shared';
import { Empty, PageHeader, Panel, Skeleton, StatusDot } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';

type IcchWallet = { id: number; name: string; number: string; isPrimary: boolean; balance: number; available: number; hold: number; active: boolean };
type Payout = {
    id: number; transactionId: string; name: string | null; mobile: string | null; bankName: string | null; ifsc: string | null;
    account: string | null; amount: number; charge: number; type: string | null; status: string; utr: string | null; message: string | null; createdAt: string | null;
};
type PayoutPage = { rows: Payout[]; page: number; lastPage: number; total: number };
type LedgerRow = { id: number; details: string | null; type: 'CR' | 'DR'; amount: number; preBalance: number; balance: number; date: string | null };
type LedgerPage = { rows: LedgerRow[]; page: number; lastPage: number; total: number };

const LBL = 'text-[13px] text-muted-foreground';

const Pager = ({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (p: number) => void }) => lastPage > 1 ? (
    <div className="flex items-center justify-between gap-2 border-t px-5 py-3 text-[13px]">
        <span className="text-muted-foreground">Page {page} of {lastPage}</span>
        <div className="flex gap-2">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={ICON_BUTTON}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= lastPage} onClick={() => onPage(page + 1)} className={ICON_BUTTON}><ChevronRight size={16} /></button>
        </div>
    </div>
) : null;

/** Icchhamati's own statement for one of our wallets, so nobody has to open their portal to see it. */
const WalletLedger = ({ token, wallets, nonce }: { token: string | null; wallets: IcchWallet[]; nonce: number }) => {
    const [walletId, setWalletId] = useState<number | null>(null);
    const [range, setRange] = useState({ date_from: '', date_to: '' });
    const [applied, setApplied] = useState(range);
    const [page, setPage] = useState(1);
    const id = walletId ?? wallets.find((w) => w.isPrimary)?.id ?? wallets[0]?.id;
    const query = new URLSearchParams({ page: String(page), per_page: '25', r: String(nonce), ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) });
    const ledger = useApiGet<LedgerPage>(token, id ? `/api/admin/icchhamati/wallets/${id}/ledger?${query}` : null);

    return (
        <Panel
            title="Wallet ledger"
            description={`Every credit and debit on Icchhamati's side${ledger.data ? ` · ${ledger.data.total} entries` : ''}`}
            action={
                <div className="flex gap-1 rounded-[10px] border p-1" role="tablist">
                    {wallets.map((w) => (
                        <button key={w.id} type="button" role="tab" aria-selected={w.id === id} onClick={() => { setWalletId(w.id); setPage(1); }}
                            className={`h-8 rounded-[8px] px-3 text-[13px] transition-colors ${w.id === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {w.name}
                        </button>
                    ))}
                </div>
            }
            flush
        >
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(range); }} className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
                <input type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="From date" />
                <input type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="To date" />
                <button className={BUTTON_QUIET}>Apply</button>
            </form>

            {ledger.error && <p className="px-5 pt-4 text-sm text-[var(--lp-danger)]">{ledger.error}</p>}
            {ledger.loading && !ledger.data ? (
                <div className="p-5"><Skeleton className="h-64 rounded-xl" /></div>
            ) : !ledger.data?.rows.length ? (
                <Empty>No entries in this range.</Empty>
            ) : (
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                {['Date', 'Details', 'Opening', 'Credit', 'Debit', 'Closing'].map((h) => <th key={h} className={`${TH} ${['Date', 'Details'].includes(h) ? '' : 'text-right'}`}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.data.rows.map((r) => (
                                <tr key={r.id} className={TR}>
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{r.date ? new Date(r.date.replace(' ', 'T')).toLocaleString('en-IN') : '—'}</td>
                                    <td className={`${TD} text-foreground`}>{r.details || '—'}</td>
                                    <td className={`${TD} lp-figure text-right text-muted-foreground`}>{inr.format(r.preBalance)}</td>
                                    <td className={`${TD} lp-figure text-right text-[var(--lp-positive)]`}>{r.type === 'CR' ? inr.format(r.amount) : ''}</td>
                                    <td className={`${TD} lp-figure text-right text-[var(--lp-danger)]`}>{r.type === 'DR' ? inr.format(r.amount) : ''}</td>
                                    <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(r.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {ledger.data && <Pager page={ledger.data.page} lastPage={ledger.data.lastPage} onPage={setPage} />}
        </Panel>
    );
};

/**
 * Shahparpay's own Icchhamati account: the float every retailer transacts
 * through, the payouts sent from it, and moving money between its wallets.
 */
const IcchhamatiAccount = ({ token }: { token: string | null }) => {
    const wallets = useApiGet<IcchWallet[]>(token, '/api/admin/icchhamati/wallets');
    const [filters, setFilters] = useState({ search: '', status: '', date_from: '', date_to: '' });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const [nonce, setNonce] = useState(0);
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
            setNonce((n) => n + 1);
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Transfer failed');
        } finally {
            // The MPIN is never kept around after an attempt.
            setTransfer((t) => ({ ...t, mpin: '' }));
            setSending(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Admin only"
                title="Icchhamati account"
                description="The company float every retailer transacts through, the payouts sent from it, and moving money between its wallets."
                actions={<button type="button" onClick={() => { wallets.reload(); payouts.reload(); setNonce((n) => n + 1); }} className={BUTTON_QUIET}><RefreshCcw size={16} strokeWidth={1.75} /> Refresh</button>}
            />

            {wallets.error && <p className={ALERT_ERROR}>{wallets.error}</p>}

            {/* Wallets: one strip, the primary first. */}
            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
                    {wallets.loading && !wallets.data
                        ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-16" /></div>)
                        : wallets.data?.map((w) => (
                            <div key={w.id} className="bg-card p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[13px] text-muted-foreground">{w.name}</p>
                                    {w.isPrimary && <span className="text-[12px] text-foreground">Primary</span>}
                                </div>
                                <p className="lp-figure mt-2 text-[24px] leading-none tracking-[-0.02em] text-foreground">{inr.format(w.available)}</p>
                                <p className="mt-2 text-[12px] text-muted-foreground">
                                    <span className="lp-figure">{w.number}</span>{w.hold > 0 && <> · {inr.format(w.hold)} on hold</>}{!w.active && ' · inactive'}
                                </p>
                            </div>
                        ))}
                </div>
            </section>

            {primary && targets.length > 0 && (
                <Panel title="Move money between wallets" description={`Icchhamati moves money out of the primary wallet (${primary.name}) only. Nothing leaves the account.`}>
                    <form onSubmit={sendTransfer} className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
                        <label className="flex flex-col gap-1.5"><span className={LBL}>To</span>
                            <select value={transfer.targetAccountId} onChange={(e) => setTransfer({ ...transfer, targetAccountId: e.target.value })} className={FIELD}>
                                <option value="" disabled>Select wallet</option>
                                {targets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.number})</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5"><span className={LBL}>Amount</span>
                            <input value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder={`Up to ${inr.format(primary.available)}`} className={`${FIELD} lp-figure`} />
                        </label>
                        <label className="flex flex-col gap-1.5"><span className={LBL}>Icchhamati MPIN</span>
                            <input value={transfer.mpin} onChange={(e) => setTransfer({ ...transfer, mpin: e.target.value.replace(/\D/g, '').slice(0, 4) })} type="password" inputMode="numeric" autoComplete="off" className={`${FIELD} lp-figure tracking-[0.4em]`} />
                        </label>
                        <label className="flex flex-col gap-1.5"><span className={LBL}>Note (optional)</span>
                            <input value={transfer.details} onChange={(e) => setTransfer({ ...transfer, details: e.target.value })} className={FIELD} />
                        </label>
                        <button disabled={sending} className={BUTTON}>{sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={1.75} />} Transfer</button>
                    </form>
                </Panel>
            )}

            {wallets.data && wallets.data.length > 0 && <WalletLedger token={token} wallets={wallets.data} nonce={nonce} />}

            <Panel title="Payouts" description={`IMPS and NEFT sent from the Icchhamati account${payouts.data ? ` · ${payouts.data.total} total` : ''}`} flush>
                <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }} className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
                    <div className="relative min-w-56 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, account, UTR…" className={`${FIELD} pl-9`} />
                    </div>
                    <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={`${FIELD} sm:w-36`}>
                        <option value="">All statuses</option>
                        <option value="success">Success</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                    </select>
                    <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="From date" />
                    <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="To date" />
                    <button className={BUTTON_QUIET}>Apply</button>
                </form>

                {payouts.error && <p className="px-5 pt-4 text-sm text-[var(--lp-danger)]">{payouts.error}</p>}
                {payouts.loading && !payouts.data ? (
                    <div className="p-5"><Skeleton className="h-64 rounded-xl" /></div>
                ) : !payouts.data?.rows.length ? (
                    <Empty>No payouts match.</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <table className={TABLE}>
                            <thead>
                                <tr className={THEAD}>
                                    {['Date', 'Beneficiary', 'Bank', 'Amount', 'Mode', 'UTR', 'Reference', 'Status'].map((h) => <th key={h} className={`${TH} ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.data.rows.map((p) => (
                                    <tr key={p.id} className={TR}>
                                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{p.createdAt ? new Date(p.createdAt).toLocaleString('en-IN') : '—'}</td>
                                        <td className={TD}><p className="text-foreground">{p.name || '—'}</p><p className="lp-figure text-[12px] text-muted-foreground">{p.mobile}</p></td>
                                        <td className={TD}><p className="text-foreground">{p.bankName || '—'}</p><p className="lp-figure text-[12px] text-muted-foreground">{p.account} · {p.ifsc}</p></td>
                                        <td className={`${TD} text-right`}><p className="lp-figure text-foreground">{inr.format(p.amount)}</p>{p.charge > 0 && <p className="lp-figure text-[12px] text-muted-foreground">+{inr.format(p.charge)} fee</p>}</td>
                                        <td className={TD}>{p.type || '—'}</td>
                                        <td className={`${TD} lp-figure text-[12px]`}>{p.utr || '—'}</td>
                                        <td className={`${TD} lp-figure text-[12px]`}>{p.transactionId}</td>
                                        <td className={TD}><span title={p.message || undefined}><StatusDot status={p.status || 'pending'} /></span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {payouts.data && <Pager page={payouts.data.page} lastPage={payouts.data.lastPage} onPage={setPage} />}
            </Panel>
        </div>
    );
};

export default IcchhamatiAccount;
