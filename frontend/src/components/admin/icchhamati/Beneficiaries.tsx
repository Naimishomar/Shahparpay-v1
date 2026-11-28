import { useState } from 'react';
import { TABLE, TD, TH, THEAD, TR, useApiGet } from '../../distributor/shared';
import { Empty, Panel, Skeleton, StatusDot } from '../../distributor/ui';
import { type Page, type ViewProps } from './shared';
import { Pager } from './ui';

type Beneficiary = {
    id: number; name: string | null; mobile: string | null; account: string | null; ifsc: string | null; bank: string | null; branch: string | null;
    verified: boolean; active: boolean; payments: number; lastPaidAt: string | null; createdAt: string | null;
};

const day = (v?: string | null) => (v ? new Date(v.replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Bank accounts registered on the Icchhamati account for money transfer, across every retailer's customers. */
const Beneficiaries = ({ token, nonce }: Pick<ViewProps, 'token'> & { nonce: number }) => {
    const [page, setPage] = useState(1);
    const list = useApiGet<Page<Beneficiary>>(token, `/api/admin/icchhamati/beneficiaries?page=${page}&r=${nonce}`);

    return (
        <Panel title="Beneficiaries" description={`Bank accounts saved at Icchhamati for money transfer${list.data ? ` · ${list.data.total} total` : ''}. The sender is the customer’s mobile.`} flush>
            {list.error && <p className="px-5 pt-4 text-sm text-[var(--lp-danger)]">{list.error}</p>}
            {list.loading && !list.data ? (
                <div className="p-5"><Skeleton className="h-48 rounded-xl" /></div>
            ) : !list.data?.rows.length ? (
                <Empty>No beneficiaries yet.</Empty>
            ) : (
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>{['Beneficiary', 'Sender mobile', 'Bank', 'Verified', 'Payments', 'Last paid', 'Added'].map((h) => <th key={h} className={`${TH} ${h === 'Payments' ? 'text-right' : ''}`}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {list.data.rows.map((b) => (
                                <tr key={b.id} className={TR}>
                                    <td className={TD}><p className="text-foreground">{b.name || '—'}</p>{!b.active && <p className="text-[12px] text-muted-foreground">Inactive</p>}</td>
                                    <td className={`${TD} lp-figure`}>{b.mobile || '—'}</td>
                                    <td className={TD}><p className="text-foreground">{b.bank || '—'}</p><p className="lp-figure text-[12px] text-muted-foreground">{b.account} · {b.ifsc}</p></td>
                                    <td className={TD}><StatusDot status={b.verified ? 'ACTIVE' : 'PENDING'} /></td>
                                    <td className={`${TD} lp-figure text-right`}>{b.payments}</td>
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{day(b.lastPaidAt)}</td>
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{day(b.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {list.data && <Pager page={list.data.page} lastPage={list.data.lastPage} onPage={setPage} />}
        </Panel>
    );
};

export default Beneficiaries;
