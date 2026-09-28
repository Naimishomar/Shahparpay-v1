import { useState } from 'react';
import { Banknote, CheckCircle2, FileText, Loader2, Search, XCircle } from 'lucide-react';
import { CARD, INPUT, LABEL, PENDING_PILL, SECONDARY_BUTTON, SILVER_TILE, STATUS_PILL, inr, inrShort } from '../distributor/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Decision = { request: any; status: 'APPROVED' | 'REJECTED' };

const STATUS_CLS: Record<string, string> = { APPROVED: STATUS_PILL.SUCCESS, REJECTED: STATUS_PILL.FAILED, PENDING: PENDING_PILL };

/**
 * Distributor → admin fund requests. Approving credits the distributor's wallet
 * on the server, so every decision goes through a confirm step with remarks.
 */
const AdminFundRequests = ({
    requests, busy, onDecide, onOpenDistributor,
}: {
    requests: any[];
    busy: boolean;
    onDecide: (id: string, status: 'APPROVED' | 'REJECTED', remarks: string) => Promise<void>;
    onOpenDistributor: (id: string) => void;
}) => {
    const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
    const [query, setQuery] = useState('');
    const [decision, setDecision] = useState<Decision | null>(null);
    const [remarks, setRemarks] = useState('');

    const term = query.trim().toLowerCase();
    const rows = requests
        .filter((r) => filter === 'ALL' || r.status === filter)
        .filter((r) => !term || [r.distributorId?.firstName, r.distributorId?.lastName, r.distributorId?.businessName, r.distributorId?.distributorId, r.bankUtr]
            .some((v) => String(v || '').toLowerCase().includes(term)));
    const pending = requests.filter((r) => r.status === 'PENDING');
    const approvedTotal = requests.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + Number(r.amount || 0), 0);

    const confirm = async () => {
        if (!decision) return;
        await onDecide(decision.request._id, decision.status, remarks.trim());
        setDecision(null);
        setRemarks('');
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Banknote className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fund requests</h1>
                            <p className="text-sm text-muted-foreground">Distributors asking you to credit their wallet after a deposit.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            ['Waiting on you', pending.length.toLocaleString('en-IN')],
                            ['Pending amount', inrShort(pending.reduce((s, r) => s + Number(r.amount || 0), 0))],
                            ['Approved to date', inrShort(approvedTotal)],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border bg-background/70 backdrop-blur p-4">
                                <p className={LABEL}>{label}</p>
                                <p className="mt-1.5 truncate text-xl font-bold tabular-nums">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {decision && (
                <section className={`rounded-2xl border p-5 ${decision.status === 'APPROVED' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <p className="font-semibold">
                        {decision.status === 'APPROVED' ? 'Approve and credit' : 'Reject'} {inr.format(decision.request.amount)} for {decision.request.distributorId?.firstName} {decision.request.distributorId?.lastName}?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {decision.status === 'APPROVED'
                            ? `Their wallet is credited immediately. Check UTR ${decision.request.bankUtr || '—'} against your bank statement first.`
                            : 'No money moves. The distributor sees your remarks.'}
                    </p>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remarks (optional)" className={`${INPUT} mt-3 resize-y`} />
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={confirm}
                            disabled={busy}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${decision.status === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {busy && <Loader2 size={16} className="animate-spin" />}
                            {decision.status === 'APPROVED' ? 'Approve & credit' : 'Reject request'}
                        </button>
                        <button onClick={() => { setDecision(null); setRemarks(''); }} disabled={busy} className={SECONDARY_BUTTON}>Cancel</button>
                    </div>
                </section>
            )}

            <section className={`${CARD} overflow-hidden p-0`}>
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
                            <button key={f} onClick={() => setFilter(f)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-background text-muted-foreground hover:text-foreground'}`}>
                                {f.toLowerCase()}
                                <span className="tabular-nums opacity-70">{f === 'ALL' ? requests.length : requests.filter((r) => r.status === f).length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="relative md:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Distributor or UTR" className={`${INPUT} pl-9`} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-3 font-medium">Deposited</th>
                                <th className="px-4 py-3 font-medium">Distributor</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium">Mode & UTR</th>
                                <th className="px-4 py-3 font-medium">Slip</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">{filter === 'PENDING' ? 'Nothing waiting on you.' : 'No fund requests match.'}</td></tr>
                            ) : rows.map((r) => (
                                <tr key={r._id} className={`hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${decision?.request._id === r._id ? 'bg-black/[0.04] dark:bg-white/[0.05]' : ''}`}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p>{new Date(r.depositDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        <p className="text-[11px] text-muted-foreground">Requested {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => r.distributorId?._id && onOpenDistributor(r.distributorId._id)} className="text-left hover:underline">
                                            <p className="font-medium">{r.distributorId?.firstName} {r.distributorId?.lastName}</p>
                                            <p className="text-[11px] text-muted-foreground">{r.distributorId?.businessName} · <span className="font-mono">{r.distributorId?.distributorId}</span></p>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold tabular-nums">{inr.format(r.amount)}</td>
                                    <td className="px-4 py-3">
                                        <p>{r.transactionMode}</p>
                                        <p className="font-mono text-[11px] text-muted-foreground">{r.bankUtr || '—'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.depositSlipUrl
                                            ? <a href={r.depositSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline"><FileText size={14} /> View</a>
                                            : <span className="text-xs text-muted-foreground">None</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_CLS[r.status] || PENDING_PILL}`}>{r.status}</span>
                                        {r.adminRemarks && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted-foreground" title={r.adminRemarks}>{r.adminRemarks}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.status === 'PENDING' && (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setDecision({ request: r, status: 'APPROVED' })} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400">
                                                    <CheckCircle2 size={14} /> Approve
                                                </button>
                                                <button onClick={() => setDecision({ request: r, status: 'REJECTED' })} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-500/20 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400">
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default AdminFundRequests;
