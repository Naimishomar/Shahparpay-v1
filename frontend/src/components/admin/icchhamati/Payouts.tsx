import { useState } from 'react';
import { Search } from 'lucide-react';
import { BUTTON_QUIET, FIELD, TABLE, TD, TH, THEAD, TR, inr, useApiGet } from '../../distributor/shared';
import { Empty, Panel, Skeleton, StatusDot } from '../../distributor/ui';
import { type Page, type ViewProps } from './shared';
import { Pager } from './ui';

type Payout = {
    id: number; transactionId: string; name: string | null; mobile: string | null; bankName: string | null; ifsc: string | null;
    account: string | null; amount: number; charge: number; type: string | null; status: string; utr: string | null; message: string | null; createdAt: string | null;
};

const Payouts = ({ token, nonce }: Pick<ViewProps, 'token'> & { nonce: number }) => {
    const [filters, setFilters] = useState({ search: '', status: '', date_from: '', date_to: '' });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const query = new URLSearchParams({ page: String(page), per_page: '25', r: String(nonce), ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) });
    const payouts = useApiGet<Page<Payout>>(token, `/api/admin/icchhamati/payouts?${query}`);

    return (
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
    );
};

export default Payouts;
