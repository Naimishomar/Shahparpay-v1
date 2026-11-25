import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { FIELD, ICON_BUTTON, TABLE, TD, TH, THEAD, TR, ago, inrShort, useApiGet } from '../distributor/shared';
import { Avatar, Empty, PageHeader, Panel, Segmented, Skeleton, StatusDot } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';
import { aepsKycDone, aepsStepLabel } from '../../lib/services';

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
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="People"
                title="Users"
                description="Every retailer and distributor. Open one to see and manage everything about them."
                actions={<Segmented label="Role" value={role} onChange={(r) => { setRole(r); setPageNo(1); }} options={[['retailer', 'Retailers'], ['distributor', 'Distributors']] as const} />}
            />

            <Panel flush>
                <div className="flex flex-col gap-2 border-b p-4 lg:flex-row">
                    <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPageNo(1); }} className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID, email, mobile or business — press Enter" className={`${FIELD} pl-9`} />
                    </form>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={`${FIELD} lg:w-36`} aria-label="Status">
                            <option value="">Any status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        {role === 'retailer' && (
                            <select value={kyc} onChange={(e) => reset(setKyc)(e.target.value)} className={`${FIELD} lg:w-36`} aria-label="KYC">
                                <option value="">Any KYC</option>
                                <option value="pending">KYC pending</option>
                                <option value="done">KYC verified</option>
                            </select>
                        )}
                        <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={`${FIELD} lg:w-36`} aria-label="Sort">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="name">Name A–Z</option>
                        </select>
                    </div>
                </div>

                {error && <div className={`${ALERT_ERROR} m-4`}>{error}</div>}
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                <th className={TH}>{role === 'retailer' ? 'Retailer' : 'Distributor'}</th>
                                {role === 'retailer' ? <th className={TH}>Distributor</th> : <th className={`${TH} text-right`}>Retailers</th>}
                                <th className={`${TH} text-right`}>Utility</th>
                                <th className={`${TH} text-right`}>Trade</th>
                                {role === 'retailer' && <th className={`${TH} text-right`}>Lifetime volume</th>}
                                <th className={TH}>Last sign-in</th>
                                <th className={TH}>Status</th>
                            </tr>
                        </thead>
                        <tbody className={loading && data ? 'opacity-50' : ''}>
                            {loading && !data ? (
                                Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-2"><Skeleton className="h-10" /></td></tr>)
                            ) : !data?.rows.length ? (
                                <tr><td colSpan={7}><Empty>No {role}s match.</Empty></td></tr>
                            ) : data.rows.map((u) => (
                                <tr key={u._id} onClick={() => onOpenUser(role, u._id)} className={`${TR} cursor-pointer`}>
                                    <td className={TD}>
                                        <div className="flex items-center gap-3">
                                            <Avatar name={u.name} src={u.profilePicture} size="w-8 h-8" />
                                            <div className="min-w-0">
                                                <p className="truncate text-foreground">{u.name}{u.verificationStatus === 'pending' && <span className="ml-2 text-[12px] text-amber-600 dark:text-amber-400">Awaiting approval</span>}</p>
                                                <p className="truncate text-[12px] text-muted-foreground"><span className="lp-figure">{u.retailerId || u.distributorId}</span> · {u.contactNumber}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {role === 'retailer' ? (
                                        <td className={TD}>{u.distributorId?.name || <span className="text-muted-foreground">—</span>}</td>
                                    ) : (
                                        <td className={`${TD} lp-figure text-right`}>{u.retailerCount}</td>
                                    )}
                                    <td className={`${TD} lp-figure text-right`}>{inrShort(u.mainBalance)}</td>
                                    <td className={`${TD} lp-figure text-right`}>{inrShort(u.aepsBalance)}</td>
                                    {role === 'retailer' && <td className={`${TD} lp-figure text-right`}>{inrShort(u.lifetimeVolume)}</td>}
                                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{u.lastLoginAt ? ago(u.lastLoginAt) : 'Not recorded'}</td>
                                    <td className={TD}>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <StatusDot status={u.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                                            {role === 'retailer' && (aepsKycDone(u)
                                                ? <span className="text-[13px] text-muted-foreground">KYC verified</span>
                                                : <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground" title={aepsStepLabel(u)}><span aria-hidden className="size-1.5 rounded-full bg-amber-500" />{aepsStepLabel(u)}</span>)}
                                            {!!u.disabledServices?.length && <span className="text-[13px] text-muted-foreground">{u.disabledServices.length} off</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t px-5 py-3">
                    <p className="text-[13px] text-muted-foreground">{data ? `${data.total.toLocaleString('en-IN')} ${role}s · page ${pageNo} of ${pages}` : ''}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={ICON_BUTTON} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={ICON_BUTTON} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </Panel>
        </div>
    );
};

export default UserDirectory;
