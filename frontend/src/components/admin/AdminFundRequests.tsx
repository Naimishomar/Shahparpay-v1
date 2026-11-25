import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, Search, XCircle } from 'lucide-react';
import { BUTTON, BUTTON_DANGER, BUTTON_QUIET, FIELD, TABLE, TD, TH, THEAD, TR, inr, inrShort } from '../distributor/shared';
import { Empty, PageHeader, Panel, Segmented, StatStrip, StatusDot } from '../distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Decision = { request: any; status: 'APPROVED' | 'REJECTED' };

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

    const count = (f: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL') => (f === 'ALL' ? requests.length : requests.filter((r) => r.status === f).length);
    const stats = [
        { label: 'Waiting on you', value: pending.length.toLocaleString('en-IN') },
        { label: 'Pending amount', value: inrShort(pending.reduce((s, r) => s + Number(r.amount || 0), 0)) },
        { label: 'Approved to date', value: inrShort(approvedTotal) },
    ];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader eyebrow="Money" title="Fund requests" description="Distributors asking you to credit their wallet after a deposit." />

            <StatStrip items={stats} cols={3} />

            {decision && (
                <Panel
                    title={`${decision.status === 'APPROVED' ? 'Approve and credit' : 'Reject'} ${inr.format(decision.request.amount)} for ${decision.request.distributorId?.firstName ?? ''} ${decision.request.distributorId?.lastName ?? ''}?`}
                    description={decision.status === 'APPROVED'
                        ? `Their wallet is credited immediately. Check UTR ${decision.request.bankUtr || '—'} against your bank statement first.`
                        : 'No money moves. The distributor sees your remarks.'}
                    className={decision.status === 'APPROVED' ? '' : 'border-[var(--lp-danger-line)]'}
                >
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remarks (optional)" className={`${FIELD} h-auto resize-y py-2.5`} />
                    <div className="mt-3 flex gap-2">
                        <button onClick={confirm} disabled={busy} className={decision.status === 'APPROVED' ? BUTTON : BUTTON_DANGER}>
                            {busy && <Loader2 size={16} className="animate-spin" />}
                            {decision.status === 'APPROVED' ? 'Approve & credit' : 'Reject request'}
                        </button>
                        <button onClick={() => { setDecision(null); setRemarks(''); }} disabled={busy} className={BUTTON_QUIET}>Cancel</button>
                    </div>
                </Panel>
            )}

            <Panel flush>
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                    <Segmented
                        label="Status"
                        size="sm"
                        value={filter}
                        onChange={setFilter}
                        options={(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => [f, `${f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} ${count(f)}`] as const)}
                    />
                    <div className="relative md:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Distributor or UTR" className={`${FIELD} pl-9`} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                <th className={TH}>Deposited</th>
                                <th className={TH}>Distributor</th>
                                <th className={`${TH} text-right`}>Amount</th>
                                <th className={TH}>Mode & UTR</th>
                                <th className={TH}>Slip</th>
                                <th className={TH}>Status</th>
                                <th className={`${TH} text-right`}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={7}><Empty>{filter === 'PENDING' ? 'Nothing waiting on you.' : 'No fund requests match.'}</Empty></td></tr>
                            ) : rows.map((r) => (
                                <tr key={r._id} className={`${TR} ${decision?.request._id === r._id ? 'bg-muted/60' : ''}`}>
                                    <td className={`${TD} whitespace-nowrap`}>
                                        <p className="text-foreground">{new Date(r.depositDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        <p className="text-[12px] text-muted-foreground">Requested {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                    </td>
                                    <td className={TD}>
                                        <button onClick={() => r.distributorId?._id && onOpenDistributor(r.distributorId._id)} className="text-left hover:underline">
                                            <p className="text-foreground">{r.distributorId?.firstName} {r.distributorId?.lastName}</p>
                                            <p className="text-[12px] text-muted-foreground">{r.distributorId?.businessName} · <span className="lp-figure">{r.distributorId?.distributorId}</span></p>
                                        </button>
                                    </td>
                                    <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(r.amount)}</td>
                                    <td className={TD}>
                                        <p className="text-foreground">{r.transactionMode}</p>
                                        <p className="lp-figure text-[12px] text-muted-foreground">{r.bankUtr || '—'}</p>
                                    </td>
                                    <td className={TD}>
                                        {r.depositSlipUrl
                                            ? <a href={r.depositSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground hover:underline"><FileText size={14} strokeWidth={1.75} /> View</a>
                                            : <span className="text-muted-foreground">None</span>}
                                    </td>
                                    <td className={TD}>
                                        <StatusDot status={r.status} />
                                        {r.adminRemarks && <p className="mt-1 max-w-[180px] truncate text-[12px] text-muted-foreground" title={r.adminRemarks}>{r.adminRemarks}</p>}
                                    </td>
                                    <td className={TD}>
                                        {r.status === 'PENDING' && (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setDecision({ request: r, status: 'APPROVED' })} disabled={busy} className={`${BUTTON} h-8 px-3 text-[13px]`}>
                                                    <CheckCircle2 size={14} /> Approve
                                                </button>
                                                <button onClick={() => setDecision({ request: r, status: 'REJECTED' })} disabled={busy} className={`${BUTTON_DANGER} h-8 px-3 text-[13px]`}>
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
            </Panel>
        </div>
    );
};

export default AdminFundRequests;
