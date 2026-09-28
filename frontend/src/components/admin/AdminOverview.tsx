import { useState } from 'react';
import {
    Activity, AlertTriangle, ArrowRight, Banknote, CheckCircle2, Headset, IndianRupee, LayoutDashboard, Radio,
    Receipt, Shield, Store, UserPlus, Users, Wallet,
} from 'lucide-react';
import {
    CARD, LABEL, PENDING_PILL, SILVER_TILE, STATUS_PILL, ago, delta, inr, inrShort, serviceLabel, useApiGet,
    type TrendPoint,
} from '../distributor/shared';
import { DeltaBadge, RangeSwitch, ShareBar, Skeleton, TrendChart } from '../distributor/ui';

type Money = { volume: number; count: number; adminEarned: number; distributorEarned: number; retailerEarned: number };
type Overview = {
    days: number;
    totals: Money & { activeRetailers: number };
    previous: Money;
    statuses: Record<string, { count: number; volume: number }>;
    successRate: number | null;
    trend: (Money & { date: string })[];
    byService: (Money & { type: string })[];
    topRetailers: { _id: string; name: string; retailerId: string; volume: number; count: number; adminEarned: number }[];
    topDistributors: { _id: string; name: string; distributorId: string; volume: number; count: number; distributorEarned: number; activeRetailers: number }[];
    users: { retailers: number; distributors: number; newRetailers: number; newDistributors: number; kycPending: number; inactive: number };
    queues: { pendingRetailerFunds: number; pendingDistributorFunds: number; openTickets: number };
    wallets: { mainFloat: number; aepsFloat: number; adminBalance: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LiveTxn = any;

const AdminOverview = ({
    token, live, onNavigate, onOpenUser, onOpenTransactions,
}: {
    token: string | null;
    live: LiveTxn[];
    onNavigate: (tab: string) => void;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
    onOpenTransactions: (query: Record<string, string>) => void;
}) => {
    const [days, setDays] = useState(30);
    const [metric, setMetric] = useState<'volume' | 'count' | 'adminEarned'>('volume');
    const { data, loading, error } = useApiGet<Overview>(token, `/api/admin/console/overview?days=${days}`);

    // TrendChart plots `earned | volume | count`; map admin earnings onto `earned`.
    const points: TrendPoint[] = (data?.trend || []).map((p) => ({ date: p.date, volume: p.volume, count: p.count, earned: p.adminEarned }));
    const chartMetric = metric === 'adminEarned' ? 'earned' : metric;
    const services = data?.byService || [];
    const serviceMax = Math.max(...services.map((s) => s.volume), 0);
    const failed = data?.statuses.FAILED?.count || 0;

    const kpis = data ? [
        { label: 'Transaction volume', value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume), icon: Wallet, hint: `${data.totals.count.toLocaleString('en-IN')} successful` },
        { label: 'Platform earnings', value: inr.format(data.totals.adminEarned), change: delta(data.totals.adminEarned, data.previous.adminEarned), icon: IndianRupee, hint: 'Admin commission' },
        { label: 'Success rate', value: data.successRate === null ? '—' : `${data.successRate}%`, change: null as number | null, icon: CheckCircle2, hint: `${failed.toLocaleString('en-IN')} failed` },
        { label: 'Active retailers', value: `${data.totals.activeRetailers}/${data.users.retailers}`, change: null as number | null, icon: Activity, hint: 'Transacted in range' },
    ] : [];

    const queues = data ? [
        { title: 'Retailer fund requests', count: data.queues.pendingRetailerFunds, icon: Banknote, action: () => onNavigate('fund-requests') },
        { title: 'Distributor fund requests', count: data.queues.pendingDistributorFunds, icon: Banknote, action: () => onNavigate('fund-requests') },
        { title: 'Open support tickets', count: data.queues.openTickets, icon: Headset, action: () => onNavigate('support') },
        { title: 'Retailers with KYC pending', count: data.users.kycPending, icon: Shield, action: () => onNavigate('users?role=retailer&kyc=pending') },
        { title: 'Failed transactions', count: failed, icon: AlertTriangle, action: () => onOpenTransactions({ status: 'FAILED' }) },
        { title: 'Inactive accounts', count: data.users.inactive, icon: Users, action: () => onNavigate('users?status=inactive') },
    ] : [];

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><LayoutDashboard className="h-7 w-7" /></div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Platform overview</h1>
                                <p className="text-sm text-muted-foreground">Everything happening across Shahparpay, in one place.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <RangeSwitch value={days} onChange={setDays} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {loading && !data
                            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                            : kpis.map(({ label, value, change, icon: Icon, hint }) => (
                                <div key={label} className="rounded-2xl border bg-background/70 backdrop-blur p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={LABEL}>{label}</p>
                                        <div className={`rounded-lg p-1.5 ${SILVER_TILE}`}><Icon className="h-3.5 w-3.5" /></div>
                                    </div>
                                    <p className="mt-2 truncate text-xl md:text-2xl font-bold tabular-nums">{value}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        {change !== null && <DeltaBadge value={change} />}
                                        <span className="text-[11px] text-muted-foreground">{hint}</span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </section>

            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

            {/* Network & money at a glance */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {data && [
                    ['Retailers', data.users.retailers.toLocaleString('en-IN'), `+${data.users.newRetailers} new`, () => onNavigate('users?role=retailer')],
                    ['Distributors', data.users.distributors.toLocaleString('en-IN'), `+${data.users.newDistributors} new`, () => onNavigate('users?role=distributor')],
                    ['Main wallet float', inrShort(data.wallets.mainFloat), 'All users', null],
                    ['AEPS wallet float', inrShort(data.wallets.aepsFloat), 'All users', null],
                    ['Admin wallet', inrShort(data.wallets.adminBalance), 'Your balance', null],
                    ['Paid to network', inrShort(data.totals.distributorEarned + data.totals.retailerEarned), `Last ${days} days`, null],
                ].map(([label, value, hint, action]) => {
                    const body = (
                        <>
                            <p className={LABEL}>{label as string}</p>
                            <p className="mt-1.5 text-lg font-bold tabular-nums truncate">{value as string}</p>
                            <p className="text-[11px] text-muted-foreground">{hint as string}</p>
                        </>
                    );
                    return action ? (
                        <button key={label as string} onClick={action as () => void} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">{body}</button>
                    ) : (
                        <div key={label as string} className="rounded-2xl border bg-card p-4 shadow-sm">{body}</div>
                    );
                })}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Platform trend</h2>
                            <p className="text-sm text-muted-foreground">Successful transactions, daily.</p>
                        </div>
                        <div className="inline-flex rounded-xl border bg-background p-1">
                            {([['volume', 'Volume'], ['count', 'Txns'], ['adminEarned', 'Earnings']] as const).map(([key, label]) => (
                                <button key={key} onClick={() => setMetric(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${metric === key ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : <TrendChart points={points} metric={chartMetric} id="admin-trend" />}
                </section>

                <section className={CARD}>
                    <h2 className="mb-4 text-lg font-semibold">Needs attention</h2>
                    {loading && !data ? (
                        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
                    ) : (
                        <ul className="space-y-2">
                            {queues.map(({ title, count, icon: Icon, action }) => (
                                <li key={title}>
                                    <button onClick={action} className="flex w-full items-center gap-3 rounded-xl border bg-background p-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                        <div className={`rounded-lg p-1.5 ${count ? `ring-1 ${PENDING_PILL}` : SILVER_TILE}`}><Icon className="h-3.5 w-3.5" /></div>
                                        <span className="flex-1 text-sm font-medium">{title}</span>
                                        <span className="font-bold tabular-nums">{count.toLocaleString('en-IN')}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className={CARD}>
                    <h2 className="mb-4 text-lg font-semibold">Service mix</h2>
                    {services.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No transactions in this range.'}</p>
                    ) : (
                        <ul className="space-y-3.5">
                            {services.slice(0, 8).map((s) => (
                                <li key={s.type}>
                                    <button onClick={() => onOpenTransactions({ type: s.type })} className="w-full text-left">
                                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                            <span className="truncate font-medium">{serviceLabel(s.type)}</span>
                                            <span className="font-semibold tabular-nums">{inrShort(s.volume)}</span>
                                        </div>
                                        <ShareBar value={s.volume} max={serviceMax} />
                                        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{s.count} txns · {inr.format(s.adminEarned)} earned</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {[
                    { title: 'Top distributors', icon: Store, rows: data?.topDistributors || [], role: 'distributor' as const, sub: (d: Overview['topDistributors'][number]) => `${d.distributorId} · ${d.activeRetailers} active retailers` },
                    { title: 'Top retailers', icon: Users, rows: data?.topRetailers || [], role: 'retailer' as const, sub: (r: Overview['topRetailers'][number]) => `${r.retailerId} · ${r.count} txns` },
                ].map(({ title, icon: Icon, rows, role, sub }) => {
                    const max = Math.max(...rows.map((r) => r.volume), 0);
                    return (
                        <section key={title} className={CARD}>
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Icon className="h-4 w-4" /></div>
                                    <h2 className="text-lg font-semibold">{title}</h2>
                                </div>
                                <button onClick={() => onNavigate(`users?role=${role}`)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">All <ArrowRight size={12} /></button>
                            </div>
                            {rows.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No activity in this range.'}</p>
                            ) : (
                                <ol className="space-y-1">
                                    {rows.map((r, i) => (
                                        <li key={r._id}>
                                            <button onClick={() => onOpenUser(role, r._id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
                                                <span className="w-4 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <p className="truncate text-sm font-semibold">{r.name}</p>
                                                        <p className="text-sm font-bold tabular-nums">{inrShort(r.volume)}</p>
                                                    </div>
                                                    <p className="mb-1 truncate text-[11px] text-muted-foreground">{sub(r as never)}</p>
                                                    <ShareBar value={r.volume} max={max} />
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>
                    );
                })}
            </div>

            {/* Live feed from the existing SSE stream */}
            <section className={CARD}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                        <h2 className="text-lg font-semibold">Live transactions</h2>
                    </div>
                    <button onClick={() => onOpenTransactions({})} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">Open explorer <ArrowRight size={14} /></button>
                </div>
                {live.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-muted-foreground">
                        <Radio className="mb-3 opacity-50" size={32} />
                        <p className="text-sm">Waiting for transactions…</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <th className="pb-3 font-medium">User</th>
                                    <th className="pb-3 font-medium">Type</th>
                                    <th className="pb-3 font-medium text-right">Amount</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium text-right">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {live.slice(0, 10).map((t: LiveTxn) => (
                                    <tr key={t._id || t.transactionId} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                        <td className="py-2.5 pr-3">
                                            <button onClick={() => t.userId?._id && onOpenUser('retailer', t.userId._id)} className="text-left font-medium hover:underline">{t.userId?.name || '—'}</button>
                                        </td>
                                        <td className="py-2.5 pr-3">{serviceLabel(t.type)}</td>
                                        <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr.format(t.amount || 0)}</td>
                                        <td className="py-2.5 pr-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[t.status] || PENDING_PILL}`}>{t.status}</span></td>
                                        <td className="py-2.5 text-right text-muted-foreground whitespace-nowrap">{ago(t.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className="flex flex-wrap gap-2">
                <button onClick={() => onNavigate('create')} className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-black/5 dark:hover:bg-white/10"><UserPlus size={16} /> Add distributor</button>
                <button onClick={() => onNavigate('activity')} className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-black/5 dark:hover:bg-white/10"><Receipt size={16} /> Activity log</button>
            </div>
        </div>
    );
};

export default AdminOverview;
