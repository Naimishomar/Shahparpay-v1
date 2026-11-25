import { useState } from 'react';
import { TABLE, TD, TH, THEAD, TR, ago, useApiGet } from '../distributor/shared';
import { Avatar, Empty, PageHeader, Panel, Segmented, Skeleton } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Self signups that have not paid the ₹99 onboarding charge yet, or were refused. Paid ones move to the Users list for approval. */
const RetailerSignups = ({ token, onOpenUser }: { token: string | null; onOpenUser: (role: 'retailer', id: string) => void }) => {
    const [status, setStatus] = useState<'unpaid' | 'rejected'>('unpaid');
    // ponytail: first 100 only; add paging like UserDirectory if the queue ever grows past that.
    const { data, loading, error } = useApiGet<{ rows: any[]; total: number }>(token, `/api/admin/console/users?role=retailer&verification=${status}&sort=oldest&limit=100`);

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="People"
                title="Retailer signups"
                description="Retailers who signed up but have not paid the ₹99 onboarding charge yet. Once they pay, they move to Users for approval."
                actions={<Segmented label="Signup status" value={status} onChange={setStatus} options={[['unpaid', 'Unpaid'], ['rejected', 'Rejected']] as const} />}
            />

            <Panel
                title={status === 'rejected' ? 'Rejected signups' : 'Waiting for the fee'}
                action={data ? <span className="lp-figure text-[13px] text-muted-foreground">{data.total.toLocaleString('en-IN')}</span> : undefined}
                flush
            >
                {error && <div className={`${ALERT_ERROR} m-4`}>{error}</div>}
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                <th className={TH}>Retailer</th>
                                <th className={TH}>Shop</th>
                                <th className={TH}>Signed up</th>
                                <th className={TH}>{status === 'rejected' ? 'Reason' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className={loading && data ? 'opacity-50' : ''}>
                            {loading && !data ? (
                                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-5 py-2"><Skeleton className="h-10" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={4}><Empty>No {status} signups.</Empty></td></tr>
                            ) : data.rows.map((u) => (
                                <tr key={u._id} onClick={() => onOpenUser('retailer', u._id)} className={`${TR} cursor-pointer`}>
                                    <td className={TD}>
                                        <div className="flex items-center gap-3">
                                            <Avatar name={u.name} src={u.profilePicture} size="w-8 h-8" />
                                            <div className="min-w-0">
                                                <p className="truncate text-foreground">{u.name}</p>
                                                <p className="truncate text-[12px] text-muted-foreground"><span className="lp-figure">{u.retailerId}</span> · {u.contactNumber} · {u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={TD}>
                                        <p className="text-foreground">{u.businessName || '—'}</p>
                                        <p className="text-[12px] text-muted-foreground">{[u.address?.city, u.address?.state].filter(Boolean).join(', ')}</p>
                                    </td>
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{ago(u.createdAt)}</td>
                                    <td className={TD}>
                                        {status === 'rejected'
                                            ? <span className="line-clamp-2 max-w-xs text-muted-foreground">{u.verificationNote || '—'}</span>
                                            : <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground"><span aria-hidden className="size-1.5 rounded-full bg-amber-500" />Onboarding charge unpaid</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data && data.total > data.rows.length && <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">Showing the oldest {data.rows.length} of {data.total}</p>}
            </Panel>
        </div>
    );
};

export default RetailerSignups;
