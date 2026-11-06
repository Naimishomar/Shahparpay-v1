import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { CARD, LABEL, PENDING_PILL, SILVER_TILE, ago, useApiGet } from '../distributor/shared';
import { Avatar, Skeleton } from '../distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Retailers who signed up from the app and wait for (or were refused) admin verification. */
const RetailerSignups = ({ token, onOpenUser }: { token: string | null; onOpenUser: (role: 'retailer', id: string) => void }) => {
    const [status, setStatus] = useState<'pending' | 'rejected'>('pending');
    // ponytail: first 100 only; add paging like UserDirectory if the queue ever grows past that.
    const { data, loading, error } = useApiGet<{ rows: any[]; total: number }>(token, `/api/admin/console/users?role=retailer&verification=${status}&sort=oldest&limit=100`);

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><UserCheck className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Retailer signups</h1>
                            <p className="text-sm text-muted-foreground">Retailers who signed up from the app. Open one to check their documents, then approve or reject.</p>
                        </div>
                    </div>
                    <div className="inline-flex rounded-xl border bg-background/70 backdrop-blur p-1 shadow-sm">
                        {(['pending', 'rejected'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${status === s ? 'btn-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {s}
                                {status === s && data && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{data.total}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className={`${CARD} overflow-hidden p-0`}>
                {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-3 font-medium">Retailer</th>
                                <th className="px-4 py-3 font-medium">Shop</th>
                                <th className="px-4 py-3 font-medium">Signed up</th>
                                <th className="px-4 py-3 font-medium">{status === 'rejected' ? 'Reason' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${loading && data ? 'opacity-50' : ''}`}>
                            {loading && !data ? (
                                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-4 py-2"><Skeleton className="h-10" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={4} className="px-4 py-14 text-center text-muted-foreground">No {status} signups.</td></tr>
                            ) : data.rows.map((u) => (
                                <tr key={u._id} onClick={() => onOpenUser('retailer', u._id)} className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={u.name} src={u.profilePicture} />
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">{u.name}</p>
                                                <p className="truncate text-[11px] text-muted-foreground"><span className="font-mono">{u.retailerId}</span> · {u.contactNumber} · {u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium">{u.businessName || '—'}</p>
                                        <p className="text-[11px] text-muted-foreground">{[u.address?.city, u.address?.state].filter(Boolean).join(', ')}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{ago(u.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        {status === 'rejected'
                                            ? <span className="line-clamp-2 max-w-xs text-muted-foreground">{u.verificationNote || '—'}</span>
                                            : <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${PENDING_PILL}`}>Awaiting review</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data && data.total > data.rows.length && <p className={`${LABEL} border-t px-4 py-3`}>Showing the oldest {data.rows.length} of {data.total}</p>}
            </section>
        </div>
    );
};

export default RetailerSignups;
