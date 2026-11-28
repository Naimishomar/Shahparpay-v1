import { useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, ExternalLink, Loader2, Percent, Receipt, RotateCcw } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { toast } from 'sonner';
import { BUTTON_QUIET, FIELD, inr, serviceLabel, useApiGet } from '../../distributor/shared';
import { Empty, Panel, Segmented, Skeleton } from '../../distributor/ui';
import ReceiptPrinter from '../../ReceiptPrinter';
import StatusMark from '../../StatusMark';
import logo from '../../../assets/logo.png';
import { ROLE_LABEL, dateTimeOf, dayHeading, signed, timeOf, type IcchWallet, type LedgerRow, type OurTxn, type Page, type ViewProps } from './shared';
import { Pager } from './ui';

/** The icon tile says what kind of line it is before the words do. */
const tileFor = (r: LedgerRow) => {
    if (r.role === 'refund') return { Icon: RotateCcw, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' };
    if (r.role === 'commission') return { Icon: Percent, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    return r.type === 'CR'
        ? { Icon: ArrowDownLeft, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
        : { Icon: ArrowUpRight, tone: 'bg-muted text-foreground/70' };
};

const Entry = ({ row: r, onOpen }: { row: LedgerRow; onOpen: () => void }) => {
    const { Icon, tone } = tileFor(r);
    return (
        <button type="button" onClick={onOpen} aria-haspopup="dialog" className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={18} /></span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                    {r.label}
                    {r.role !== 'principal' && r.role !== 'internal' && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">{ROLE_LABEL[r.role]}</span>}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                    <span className="lp-figure">{timeOf(r.date)}</span>{r.ref && <> · <span className="lp-figure">{r.ref}</span></>}
                </span>
            </span>
            <span className="shrink-0 text-right">
                <span className={`lp-figure block text-[15px] ${r.type === 'CR' ? 'text-[var(--lp-positive)]' : 'text-foreground'}`}>{signed(r.type, r.amount)}</span>
                <span className="lp-figure mt-0.5 block text-xs text-muted-foreground">Bal {inr.format(r.balance)}</span>
            </span>
            <Receipt aria-hidden size={16} className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
    );
};

/** Our transaction behind a statement line, inside the slip. */
const OurSide = ({ token, row, onOpenTransactions }: { token: string | null; row: LedgerRow; onOpenTransactions: ViewProps['onOpenTransactions'] }) => {
    const q = new URLSearchParams({ ref: row.ref || '', date: row.date || '', amount: String(row.amount), role: row.role });
    const match = useApiGet<OurTxn | null>(token, row.ref ? `/api/admin/icchhamati/ledger-match?${q}` : null);
    if (!row.ref) return <p className="text-center text-xs text-slate-500">An internal entry of the Icchhamati account: no Shahparpay transaction behind it.</p>;
    if (match.loading) return <p className="flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Finding the Shahparpay transaction…</p>;
    if (match.error) return <p className="text-center text-xs text-rose-600">{match.error}</p>;
    const t = match.data;
    if (!t) return <p className="text-center text-xs text-amber-700">No Shahparpay transaction found for reference {row.ref}. Run Reconcile for this day if it should be one of ours.</p>;
    const c = t.commissions || {};
    return (
        <div className="space-y-2 text-sm">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">Shahparpay transaction</p>
            {([
                ['Retailer', t.retailer ? `${t.retailer.name}${t.retailer.retailerId ? ` (${t.retailer.retailerId})` : ''}` : '—'],
                ['Service', serviceLabel(t.type)],
                ['Our status', t.status.charAt(0) + t.status.slice(1).toLowerCase()],
                ['Amount', inr.format(t.amount)],
                ['Retailer earned', inr.format(c.retailerEarned || 0)],
                ['Admin earned', inr.format(c.adminEarned || 0)],
                ['Reference', t.transactionId],
            ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-2 last:border-0">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className={`break-all text-right font-medium ${k === 'Our status' && t.status !== 'SUCCESS' ? 'text-amber-700' : ''}`}>{v}</dd>
                </div>
            ))}
            <button type="button" data-html2canvas-ignore onClick={() => onOpenTransactions({ q: t.transactionId })} className="mx-auto mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 underline-offset-4 hover:underline">
                Open in transactions <ExternalLink size={12} />
            </button>
        </div>
    );
};

const EntrySlip = ({ row: r, wallet, token, onClose, onOpenTransactions }: { row: LedgerRow; wallet: string; token: string | null; onClose: () => void; onOpenTransactions: ViewProps['onOpenTransactions'] }) => {
    const ref = useRef<HTMLDivElement>(null);
    const download = async () => {
        if (!ref.current) return;
        try {
            const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `Icchhamati_${r.id}.png`;
            a.click();
        } catch {
            toast.error('Could not download the receipt.');
        }
    };
    const rows: [string, string, boolean?][] = [
        ['Service', r.label],
        ['Entry type', `${ROLE_LABEL[r.role]} · ${r.type === 'CR' ? 'Credit' : 'Debit'}`],
        ['Reference', r.ref || '—'],
        ['Wallet', wallet],
        ['Date', dateTimeOf(r.date)],
        ['Balance before', inr.format(r.preBalance)],
        ['Amount', signed(r.type, r.amount), true],
        ['Balance after', inr.format(r.balance), true],
    ];
    return (
        <ReceiptPrinter
            label="Icchhamati ledger entry"
            onClose={onClose}
            actions={<>
                <button onClick={download} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-100"><Download className="h-4 w-4" /> Download</button>
                <button onClick={onClose} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold">Done</button>
            </>}
        >
            <div ref={ref} className="space-y-4 bg-white p-6 text-slate-800">
                <div className="border-b border-dashed border-slate-300 pb-4 text-center">
                    <img src={logo} alt="Shahparpay" className="mx-auto mb-2 h-auto w-56 max-w-full object-contain" />
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-900">Icchhamati ledger entry</p>
                </div>
                <div className="flex flex-col items-center text-center">
                    <StatusMark status={r.role === 'refund' ? 'cancelled' : 'done'} size={44} strokeWidth={3} color="#f59e0b" doneColor="#10b981" errorColor="#ef4444" className="mb-2" />
                    <p className={`text-3xl font-bold tabular-nums ${r.type === 'CR' ? 'text-emerald-600' : 'text-slate-900'}`}>{signed(r.type, r.amount)}</p>
                    <p className="mt-1 text-sm text-slate-500">{r.details || r.label}</p>
                </div>
                <dl className="space-y-2 text-sm">
                    {rows.map(([k, v, key]) => (
                        <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-2 last:border-0">
                            <dt className={key ? 'font-semibold text-slate-900' : 'text-slate-500'}>{k}</dt>
                            <dd className={`break-all text-right tabular-nums ${key ? 'text-base font-bold text-slate-900' : 'font-medium'}`}>{v}</dd>
                        </div>
                    ))}
                </dl>
                <div className="border-t border-dashed border-slate-300 pt-4">
                    <OurSide token={token} row={r} onOpenTransactions={(q) => { onClose(); onOpenTransactions(q); }} />
                </div>
                <p className="break-all text-center font-mono text-[11px] text-slate-400">Icchhamati entry #{r.id}</p>
            </div>
        </ReceiptPrinter>
    );
};

/** Icchhamati's own statement for one of our wallets, so nobody has to open their portal to see it. */
const Ledger = ({ token, wallets, nonce, onOpenTransactions }: ViewProps & { wallets: IcchWallet[] | null; nonce: number }) => {
    const [walletId, setWalletId] = useState<number | null>(null);
    const [range, setRange] = useState({ date_from: '', date_to: '' });
    const [applied, setApplied] = useState(range);
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<LedgerRow | null>(null);
    const list = wallets ?? [];
    const id = walletId ?? list.find((w) => w.isPrimary)?.id ?? list[0]?.id;
    const query = new URLSearchParams({ page: String(page), per_page: '25', r: String(nonce), ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) });
    const ledger = useApiGet<Page<LedgerRow>>(token, id ? `/api/admin/icchhamati/wallets/${id}/ledger?${query}` : null);
    const walletName = list.find((w) => w.id === id)?.name ?? 'Wallet';

    // Lines grouped under their day, newest first as Icchhamati sends them.
    const groups: { day: string; rows: LedgerRow[] }[] = [];
    for (const r of ledger.data?.rows ?? []) {
        const day = dayHeading(r.date);
        if (groups.at(-1)?.day === day) groups.at(-1)!.rows.push(r);
        else groups.push({ day, rows: [r] });
    }

    return (
        <Panel
            title="Wallet ledger"
            description={`Every credit and debit on Icchhamati's side. Click an entry for its details${ledger.data ? ` · ${ledger.data.total} entries` : ''}.`}
            action={list.length > 1 && id ? (
                <Segmented label="Wallet" value={id} onChange={(w) => { setWalletId(w); setPage(1); }} options={list.map((w) => [w.id, w.name] as const)} />
            ) : undefined}
            flush
        >
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(range); }} className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
                <input type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="From date" />
                <span className="text-sm text-muted-foreground">to</span>
                <input type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className={`${FIELD} sm:w-40 dark:[color-scheme:dark]`} aria-label="To date" />
                <button className={BUTTON_QUIET}>Apply</button>
                {(applied.date_from || applied.date_to) && (
                    <button type="button" onClick={() => { const none = { date_from: '', date_to: '' }; setRange(none); setApplied(none); setPage(1); }} className="text-[13px] text-muted-foreground hover:text-foreground">Clear</button>
                )}
            </form>

            {ledger.error && <p className="px-5 pt-4 text-sm text-[var(--lp-danger)]">{ledger.error}</p>}
            {!id || (ledger.loading && !ledger.data) ? (
                <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : !ledger.data?.rows.length ? (
                <Empty>No entries in this range.</Empty>
            ) : (
                <div className={ledger.loading ? 'opacity-60 transition-opacity' : ''}>
                    {groups.map((g) => (
                        <section key={g.day}>
                            <h3 className="sticky top-0 z-[1] border-b bg-muted/60 px-5 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur">{g.day}</h3>
                            <div className="divide-y">{g.rows.map((r) => <Entry key={r.id} row={r} onOpen={() => setOpen(r)} />)}</div>
                        </section>
                    ))}
                </div>
            )}
            {ledger.data && <Pager page={ledger.data.page} lastPage={ledger.data.lastPage} onPage={setPage} />}
            {open && <EntrySlip row={open} wallet={walletName} token={token} onClose={() => setOpen(null)} onOpenTransactions={onOpenTransactions} />}
        </Panel>
    );
};

export default Ledger;
