import { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Clock, IndianRupee, Network, Receipt, ShieldAlert, Trophy, UserPlus, Wallet } from 'lucide-react';
import { CARD, LABEL, type NetworkAnalytics, PENDING_PILL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, STATUS_PILL, ago, daysSince, delta, inr, inrShort, serviceLabel, useDistributorData } from './shared';
import { Avatar, DeltaBadge, RangeSwitch, ShareBar, Skeleton, TrendChart } from './ui';

export type DirectoryPreset = { filter?: 'all' | 'kyc' | 'inactive' | 'dormant'; sort?: 'earned' | 'volume' | 'lastActive' | 'newest' };

const INACTIVE_DAYS = 7;

const greeting = () => {
    const h = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const NetworkDashboard = ({
    token,
    name,
    days,
    onDaysChange,
    pendingFundRequests,
    onOpenRetailer,
    onViewRetailers,
    onNavigate,
}: {
    token: string | null;
    name?: string;
    days: number;
    onDaysChange: (d: number) => void;
    pendingFundRequests: number;
    onOpenRetailer: (id: string) => void;
    onViewRetailers: (preset: DirectoryPreset) => void;
    onNavigate: (tab: string) => void;
}) => {
    const { data, loading, error } = useDistributorData<NetworkAnalytics>(token, '/api/distributor/analytics', days);
    const [metric, setMetric] = useState<'earned' | 'volume' | 'count'>('earned');
    const [mixBy, setMixBy] = useState<'volume' | 'earned'>('volume');

    const retailers = data?.retailers || [];
    const top = [...retailers].filter((r) => r.earned > 0 || r.volume > 0).sort((a, b) => b.earned - a.earned || b.volume - a.volume).slice(0, 5);
    const topMax = Math.max(...top.map((r) => r.earned), 0);
    const kycPending = retailers.filter((r) => !r.isMerchantKycComplete);
    const inactive = retailers.filter((r) => r.lastActiveAt && daysSince(r.lastActiveAt) >= INACTIVE_DAYS);
    const dormant = retailers.filter((r) => !r.lastActiveAt);
    const services = [...(data?.byService || [])].sort((a, b) => b[mixBy] - a[mixBy]);
    const mixMax = Math.max(...services.map((s) => s[mixBy]), 0);

    const kpis = data ? [
        { label: 'Commission earned', value: inr.format(data.totals.earned), change: delta(data.totals.earned, data.previous.earned), icon: IndianRupee, hint: `${inrShort(data.lifetimeEarned)} lifetime` },
        { label: 'Network volume', value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume), icon: Wallet, hint: 'Across all services' },
        { label: 'Transactions', value: data.totals.count.toLocaleString('en-IN'), change: delta(data.totals.count, data.previous.count), icon: Receipt, hint: `Avg ${inrShort(data.totals.count ? data.totals.volume / data.totals.count : 0)} each` },
        { label: 'Active retailers', value: `${data.totals.activeRetailers}/${data.totals.totalRetailers}`, change: null as number | null, icon: Activity, hint: 'Transacted in this range' },
    ] : [];

    const attention = [
        { key: 'kyc', count: kycPending.length, icon: ShieldAlert, title: 'KYC pending', hint: 'Cannot run AEPS until verified', action: () => onViewRetailers({ filter: 'kyc' }) },
        { key: 'inactive', count: inactive.length, icon: Clock, title: `Quiet for ${INACTIVE_DAYS}+ days`, hint: 'Had business before, gone silent', action: () => onViewRetailers({ filter: 'inactive', sort: 'lastActive' }) },
        { key: 'dormant', count: dormant.length, icon: AlertTriangle, title: 'Never transacted', hint: 'Onboarded but not started', action: () => onViewRetailers({ filter: 'dormant' }) },
        { key: 'fund', count: pendingFundRequests, icon: Receipt, title: 'Fund requests waiting', hint: 'Retailers waiting on your approval', action: () => onNavigate('fund-requests') },
    ];

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                                <Network className="h-7 w-7" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</p>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Network overview</h1>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <RangeSwitch value={days} onChange={onDaysChange} />
                            <button onClick={() => onNavigate('create')} className={`${PRIMARY_BUTTON} py-2`}>
                                <UserPlus size={16} /> Add retailer
                            </button>
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
                                    <p className="mt-2 text-xl md:text-2xl font-bold tabular-nums truncate">{value}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        {change !== null && <DeltaBadge value={change} />}
                                        <span className="text-[11px] text-muted-foreground">{hint}</span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Trend */}
                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Performance trend</h2>
                            <p className="text-sm text-muted-foreground">Daily totals for the last {days} days. Hover for detail.</p>
                        </div>
                        <div className="inline-flex rounded-xl border bg-background p-1">
                            {([['earned', 'Commission'], ['volume', 'Volume'], ['count', 'Txns']] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setMetric(key)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${metric === key ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : <TrendChart points={data?.trend || []} metric={metric} id="network-trend" />}
                </section>

                {/* Service mix */}
                <section className={CARD}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Service mix</h2>
                        <div className="inline-flex rounded-xl border bg-background p-1">
                            {([['volume', 'Volume'], ['earned', 'Commission']] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setMixBy(key)}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${mixBy === key ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading && !data ? (
                        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : services.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No transactions in this range.</p>
                    ) : (
                        <ul className="space-y-3.5">
                            {services.slice(0, 7).map((s) => (
                                <li key={s.type}>
                                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                        <span className="font-medium truncate">{serviceLabel(s.type)}</span>
                                        <span className="tabular-nums font-semibold">{mixBy === 'volume' ? inrShort(s.volume) : inr.format(s.earned)}</span>
                                    </div>
                                    <ShareBar value={s[mixBy]} max={mixMax} />
                                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{s.count} txns</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Top earners */}
                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Trophy className="h-4 w-4" /></div>
                            <div>
                                <h2 className="text-lg font-semibold">Top retailers by commission</h2>
                                <p className="text-sm text-muted-foreground">Who earned you the most in the last {days} days.</p>
                            </div>
                        </div>
                        <button onClick={() => onViewRetailers({ sort: 'earned' })} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
                            View all <ArrowRight size={14} />
                        </button>
                    </div>
                    {loading && !data ? (
                        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                    ) : top.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No retailer has transacted in this range yet.</p>
                    ) : (
                        <ol className="divide-y">
                            {top.map((r, i) => (
                                <li key={r._id}>
                                    <button onClick={() => onOpenRetailer(r._id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                                        <Avatar name={r.name} src={r.profilePicture} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="truncate text-sm font-semibold">{r.name}</p>
                                                <p className="text-sm font-bold tabular-nums">{inr.format(r.earned)}</p>
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-3">
                                                <ShareBar value={r.earned} max={topMax} />
                                                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                                                    {data && data.totals.earned > 0 ? `${((r.earned / data.totals.earned) * 100).toFixed(0)}%` : '—'} · {inrShort(r.volume)} · {r.count} txns
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                {/* Needs attention */}
                <section className={CARD}>
                    <h2 className="mb-4 text-lg font-semibold">Needs attention</h2>
                    <ul className="space-y-2">
                        {attention.map(({ key, count, icon: Icon, title, hint, action }) => (
                            <li key={key}>
                                <button
                                    onClick={action}
                                    disabled={!count}
                                    className="group flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:cursor-default disabled:hover:bg-background disabled:opacity-60"
                                >
                                    <div className={`rounded-xl p-2 ${count ? `ring-1 ${PENDING_PILL}` : SILVER_TILE}`}><Icon className="h-4 w-4" /></div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold">{title}</p>
                                        <p className="text-xs text-muted-foreground">{hint}</p>
                                    </div>
                                    <span className="text-lg font-bold tabular-nums">{loading && !data && key !== 'fund' ? '–' : count}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* Recent activity */}
            <section className={CARD}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent network activity</h2>
                    <span className={LABEL}>Latest 12</span>
                </div>
                {loading && !data ? (
                    <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : !data?.recent.length ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Activity className="mb-3 opacity-50" size={36} />
                        <p className="text-sm">Transactions from your retailers will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <th className="pb-3 font-medium">Retailer</th>
                                    <th className="pb-3 font-medium">Service</th>
                                    <th className="pb-3 font-medium text-right">Amount</th>
                                    <th className="pb-3 font-medium text-right">Your commission</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium text-right">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.recent.map((t) => (
                                    <tr
                                        key={t._id}
                                        onClick={() => t.retailer && onOpenRetailer(t.retailer._id)}
                                        className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                    >
                                        <td className="py-3 pr-3">
                                            <p className="font-medium">{t.retailer?.name || '—'}</p>
                                            <p className="text-[11px] font-mono text-muted-foreground">{t.retailer?.retailerId}</p>
                                        </td>
                                        <td className="py-3 pr-3">{serviceLabel(t.type)}</td>
                                        <td className="py-3 pr-3 text-right tabular-nums font-semibold">{inr.format(t.amount)}</td>
                                        <td className="py-3 pr-3 text-right tabular-nums">{t.commissions?.distributorEarned ? inr.format(t.commissions.distributorEarned) : '—'}</td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[t.status] || PENDING_PILL}`}>{t.status}</span>
                                        </td>
                                        <td className="py-3 text-right text-muted-foreground whitespace-nowrap">{ago(t.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {!loading && data && data.totals.totalRetailers === 0 && (
                <section className={`${CARD} text-center`}>
                    <p className="mb-4 text-sm text-muted-foreground">You have no retailers yet. Add your first one to start earning.</p>
                    <button onClick={() => onNavigate('create')} className={SECONDARY_BUTTON}><UserPlus size={16} /> Add retailer</button>
                </section>
            )}
        </div>
    );
};

export default NetworkDashboard;
