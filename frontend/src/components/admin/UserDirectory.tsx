import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Search, ShieldCheck, Users } from 'lucide-react';
import { CARD, INPUT, LABEL, PENDING_PILL, SECONDARY_BUTTON, SILVER_TILE, ago, inrShort, useApiGet } from '../distributor/shared';
import { Avatar, Skeleton } from '../distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type UserQuery = { role?: 'retailer' | 'distributor'; q?: string; status?: string; kyc?: string; distributor?: string; sort?: string };

const UserDirectory = ({
    token, initial, onOpenUser,
}: {
    token: string | null;
    initial: UserQuery;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
}) => {
    const [role, setRole] = useState<'retailer' | 'distributor'>(initial.role || 'retailer');
    const [q, setQ] = useState(initial.q || '');
    const [search, setSearch] = useState(initial.q || '');
    const [status, setStatus] = useState(initial.status || '');
    const [kyc, setKyc] = useState(initial.kyc || '');
    const [sort, setSort] = useState(initial.sort || 'newest');
    const [pageNo, setPageNo] = useState(1);
    const limit = 25;

    const params = new URLSearchParams({
        role, page: String(pageNo), limit: String(limit), sort,
        ...(search && { q: search }), ...(status && { status }), ...(kyc && role === 'retailer' && { kyc }),
        ...(initial.distributor && role === 'retailer' && { distributor: initial.distributor }),
    });
    const { data, loading, error } = useApiGet<{ rows: any[]; total: number }>(token, `/api/admin/console/users?${params}`);
    const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
    const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPageNo(1); };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Users className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Users</h1>
                            <p className="text-sm text-muted-foreground">Every retailer and distributor. Open one to see and manage everything about them.</p>
                        </div>
                    </div>
                    <div className="inline-flex rounded-xl border bg-background/70 backdrop-blur p-1 shadow-sm">
                        {(['retailer', 'distributor'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => { setRole(r); setPageNo(1); }}
                                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${role === r ? 'bg-zinc-900 text-white shadow-md dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {r}s
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className={`${CARD} overflow-hidden p-0`}>
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
                    <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPageNo(1); }} className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID, email, mobile or business — press Enter" className={`${INPUT} pl-9`} />
                    </form>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={`${INPUT} lg:w-36`} aria-label="Status">
                            <option value="">Any status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        {role === 'retailer' && (
                            <select value={kyc} onChange={(e) => reset(setKyc)(e.target.value)} className={`${INPUT} lg:w-36`} aria-label="KYC">
                                <option value="">Any KYC</option>
                                <option value="pending">KYC pending</option>
                                <option value="done">KYC verified</option>
                            </select>
                        )}
                        <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={`${INPUT} lg:w-36`} aria-label="Sort">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="name">Name A–Z</option>
                        </select>
                    </div>
                </div>

                {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-3 font-medium">{role === 'retailer' ? 'Retailer' : 'Distributor'}</th>
                                {role === 'retailer' ? <th className="px-4 py-3 font-medium">Distributor</th> : <th className="px-4 py-3 font-medium text-right">Retailers</th>}
                                <th className="px-4 py-3 font-medium text-right">Main</th>
                                <th className="px-4 py-3 font-medium text-right">AEPS</th>
                                {role === 'retailer' && <th className="px-4 py-3 font-medium text-right">Lifetime volume</th>}
                                <th className="px-4 py-3 font-medium">Last sign-in</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${loading && data ? 'opacity-50' : ''}`}>
                            {loading && !data ? (
                                Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-2"><Skeleton className="h-10" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">No {role}s match.</td></tr>
                            ) : data.rows.map((u) => (
                                <tr key={u._id} onClick={() => onOpenUser(role, u._id)} className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={u.name} src={u.profilePicture} />
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">{u.name}</p>
                                                <p className="truncate text-[11px] text-muted-foreground"><span className="font-mono">{u.retailerId || u.distributorId}</span> · {u.contactNumber}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {role === 'retailer' ? (
                                        <td className="px-4 py-3">{u.distributorId?.name || <span className="text-muted-foreground">—</span>}</td>
                                    ) : (
                                        <td className="px-4 py-3 text-right tabular-nums">{u.retailerCount}</td>
                                    )}
                                    <td className="px-4 py-3 text-right tabular-nums">{inrShort(u.mainBalance)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{inrShort(u.aepsBalance)}</td>
                                    {role === 'retailer' && <td className="px-4 py-3 text-right tabular-nums">{inrShort(u.lifetimeVolume)}</td>}
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? ago(u.lastLoginAt) : 'Not recorded'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {u.isActive === false ? (
                                                <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20">Inactive</span>
                                            ) : (
                                                <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20">Active</span>
                                            )}
                                            {role === 'retailer' && (u.isMerchantKycComplete
                                                ? <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"><ShieldCheck size={11} /> KYC</span>
                                                : <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${PENDING_PILL}`}><Clock size={11} /> KYC</span>)}
                                            {!!u.disabledServices?.length && <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{u.disabledServices.length} off</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className={LABEL}>{data ? `${data.total.toLocaleString('en-IN')} ${role}s · page ${pageNo} of ${pages}` : ''}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default UserDirectory;
