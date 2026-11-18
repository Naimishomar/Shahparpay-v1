import { useState } from 'react';
import { ArrowRight, CheckCircle2, Radio } from 'lucide-react';
import {
    CARD, LABEL, PENDING_PILL, STATUS_PILL, ago, delta, inr, inrShort, serviceLabel, useApiGet,
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
        { label: 'Transaction volume', value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume), hint: `${data.totals.count.toLocaleString('en-IN')} successful` },
        { label: 'Platform earnings', value: inr.format(data.totals.adminEarned), change: delta(data.totals.adminEarned, data.previous.adminEarned), hint: 'Admin commission' },
        { label: 'Success rate', value: data.successRate === null ? '—' : `${data.successRate}%`, change: null as number | null, hint: `${failed.toLocaleString('en-IN')} failed` },
        { label: 'Active retailers', value: `${data.totals.activeRetailers}/${data.users.retailers}`, change: null as number | null, hint: 'Transacted in range' },
    ] : [];

    // Only what is actually waiting; an empty queue is not news.
    const queues = data ? [
        { title: 'retailer fund requests', count: data.queues.pendingRetailerFunds, action: () => onNavigate('fund-requests') },
        { title: 'distributor fund requests', count: data.queues.pendingDistributorFunds, action: () => onNavigate('fund-requests') },
        { title: 'open tickets', count: data.queues.openTickets, action: () => onNavigate('support') },
        { title: 'KYC pending', count: data.users.kycPending, action: () => onNavigate('users?role=retailer&kyc=pending') },
        { title: 'failed transactions', count: failed, action: () => onOpenTransactions({ status: 'FAILED' }) },
        { title: 'inactive accounts', count: data.users.inactive, action: () => onNavigate('users?status=inactive') },
    ].filter((q) => q.count > 0) : [];

    const money = data ? [
        { label: 'Retailers', value: data.users.retailers.toLocaleString('en-IN'), hint: `+${data.users.newRetailers} new`, action: () => onNavigate('users?role=retailer') },
        { label: 'Distributors', value: data.users.distributors.toLocaleString('en-IN'), hint: `+${data.users.newDistributors} new`, action: () => onNavigate('users?role=distributor') },
        { label: 'Admin wallet', value: inrShort(data.wallets.adminBalance), hint: 'Your balance' },
        { label: 'Utility float', value: inrShort(data.wallets.mainFloat), hint: 'All users' },
        { label: 'Trade float', value: inrShort(data.wallets.aepsFloat), hint: 'All users' },
        { label: 'Paid to network', value: inrShort(data.totals.distributorEarned + data.totals.retailerEarned), hint: `Last ${days} days` },
    ] : [];

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                    <p className="text-sm text-muted-foreground">Everything happening across Shahparpay.</p>
                </div>
                <RangeSwitch value={days} onChange={setDays} />
            </header>

            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

            {data && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    {queues.length === 0 ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground"><CheckCircle2 size={16} className="text-emerald-500" /> Nothing waiting on you.</span>
                    ) : (
                        <>
                            <span className="mr-1 font-medium">Needs attention</span>
                            {queues.map((q) => (
                                <button key={q.title} onClick={q.action} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 transition hover:opacity-80 ${PENDING_PILL}`}>
                                    <span className="font-semibold tabular-nums">{q.count.toLocaleString('en-IN')}</span>{q.title}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}

            <section className={`${CARD} overflow-hidden p-0`}>
                <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
                    {loading && !data
                        ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-16" /></div>)
                        : kpis.map(({ label, value, change, hint }) => (
                            <div key={label} className="bg-card p-5">
                                <p className={LABEL}>{label}</p>
                                <p className="mt-2 truncate text-2xl font-semibold tabular-nums">{value}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    {change !== null && <DeltaBadge value={change} />}
                                    <span className="text-xs text-muted-foreground">{hint}</span>
                                </div>
                            </div>
                        ))}
                </div>
                <div className="border-t p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-semibold">Daily trend</h2>
                        <div className="inline-flex rounded-xl border bg-background p-1">
                            {([['volume', 'Volume'], ['count', 'Txns'], ['adminEarned', 'Earnings']] as const).map(([key, label]) => (
                                <button key={key} onClick={() => setMetric(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${metric === key ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : <TrendChart points={points} metric={chartMetric} id="admin-trend" />}
                </div>
            </section>

            <section className={`${CARD} overflow-hidden p-0`}>
                <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 xl:grid-cols-6">
                    {money.map(({ label, value, hint, action }) => {
                        const body = (
                            <>
                                <p className={LABEL}>{label}</p>
                                <p className="mt-1.5 truncate text-lg font-semibold tabular-nums">{value}</p>
                                <p className="text-xs text-muted-foreground">{hint}</p>
                            </>
                        );
                        return action
                            ? <button key={label} onClick={action} className="bg-card p-4 text-left transition-colors hover:bg-muted">{body}</button>
                            : <div key={label} className="bg-card p-4">{body}</div>;
                    })}
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className={CARD}>
                    <h2 className="mb-4 font-semibold">Service mix</h2>
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
                    { title: 'Top distributors', rows: data?.topDistributors || [], role: 'distributor' as const, sub: (d: Overview['topDistributors'][number]) => `${d.distributorId} · ${d.activeRetailers} active retailers` },
                    { title: 'Top retailers', rows: data?.topRetailers || [], role: 'retailer' as const, sub: (r: Overview['topRetailers'][number]) => `${r.retailerId} · ${r.count} txns` },
                ].map(({ title, rows, role, sub }) => {
                    const max = Math.max(...rows.map((r) => r.volume), 0);
                    return (
                        <section key={title} className={CARD}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="font-semibold">{title}</h2>
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
                        <h2 className="font-semibold">Live transactions</h2>
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

        </div>
    );
};

export default AdminOverview;
