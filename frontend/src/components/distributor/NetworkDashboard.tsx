import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { ALERT_ERROR } from '../landing/ui';
import { BUTTON, BUTTON_QUIET, TABLE, TD, TH, THEAD, TR, type NetworkAnalytics, ago, daysSince, delta, inr, inrShort, serviceLabel, useDistributorData } from './shared';
import { Avatar, Empty, PageHeader, Panel, RangeSwitch, Segmented, ShareBar, Skeleton, StatStrip, StatusDot, TextLink, TrendChart } from './ui';
import { aepsKycDone } from '../../lib/services';

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
    const kycPending = retailers.filter((r) => !aepsKycDone(r));
    const inactive = retailers.filter((r) => r.lastActiveAt && daysSince(r.lastActiveAt) >= INACTIVE_DAYS);
    const dormant = retailers.filter((r) => !r.lastActiveAt);
    const services = [...(data?.byService || [])].sort((a, b) => b[mixBy] - a[mixBy]);
    const mixMax = Math.max(...services.map((s) => s[mixBy]), 0);

    const kpis = data ? [
        { label: 'Commission earned', value: inr.format(data.totals.earned), change: delta(data.totals.earned, data.previous.earned), hint: `${inrShort(data.lifetimeEarned)} lifetime` },
        { label: 'Network volume', value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume), hint: 'All services' },
        { label: 'Transactions', value: data.totals.count.toLocaleString('en-IN'), change: delta(data.totals.count, data.previous.count), hint: `Avg ${inrShort(data.totals.count ? data.totals.volume / data.totals.count : 0)}` },
        { label: 'Active retailers', value: `${data.totals.activeRetailers}/${data.totals.totalRetailers}`, hint: 'Transacted in range', onClick: () => onViewRetailers({}) },
    ] : [];

    const attention = [
        { key: 'kyc', count: kycPending.length, title: 'KYC pending', hint: 'Cannot run AEPS until verified', action: () => onViewRetailers({ filter: 'kyc' }) },
        { key: 'inactive', count: inactive.length, title: `Quiet for ${INACTIVE_DAYS}+ days`, hint: 'Had business before, gone silent', action: () => onViewRetailers({ filter: 'inactive', sort: 'lastActive' }) },
        { key: 'dormant', count: dormant.length, title: 'Never transacted', hint: 'Onboarded but not started', action: () => onViewRetailers({ filter: 'dormant' }) },
        { key: 'fund', count: pendingFundRequests, title: 'Fund requests', hint: 'Waiting on your approval', action: () => onNavigate('fund-requests') },
    ];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow={`${greeting()}${name ? `, ${name.split(' ')[0]}` : ''}`}
                title="Network overview"
                description="How your retailers are doing, and what needs you."
                actions={<>
                    <RangeSwitch value={days} onChange={onDaysChange} />
                    <button type="button" onClick={() => onNavigate('create')} className={BUTTON}>
                        <UserPlus size={16} strokeWidth={1.75} /> Add retailer
                    </button>
                </>}
            />

            {error && <div className={ALERT_ERROR}>{error}</div>}

            <StatStrip items={kpis} loading={loading} />

            <div className="grid gap-6 xl:grid-cols-3">
                <Panel
                    className="xl:col-span-2"
                    title="Performance trend"
                    description={`Daily totals for the last ${days} days. Hover for a day.`}
                    action={<Segmented label="Chart metric" size="sm" value={metric} onChange={setMetric} options={[['earned', 'Commission'], ['volume', 'Volume'], ['count', 'Txns']] as const} />}
                >
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : data?.trend.length ? <TrendChart points={data.trend} metric={metric} id="network-trend" /> : <Empty>No transactions in this range.</Empty>}
                </Panel>

                <Panel title="Needs attention" flush>
                    <ul>
                        {attention.map(({ key, count, title, hint, action }) => (
                            <li key={key} className="border-b last:border-0">
                                <button
                                    type="button"
                                    onClick={action}
                                    disabled={!count}
                                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm ${count ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</p>
                                        <p className="text-[12px] text-muted-foreground">{hint}</p>
                                    </div>
                                    <span className={`lp-figure flex-none text-base ${count ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        {loading && !data && key !== 'fund' ? '–' : count}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Panel
                    className="xl:col-span-2"
                    title="Top retailers by commission"
                    description={`Who earned you the most in the last ${days} days.`}
                    action={<TextLink onClick={() => onViewRetailers({ sort: 'earned' })}>View all</TextLink>}
                    flush
                >
                    {loading && !data ? (
                        <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                    ) : top.length === 0 ? (
                        <Empty>No retailer has transacted in this range yet.</Empty>
                    ) : (
                        <ol>
                            {top.map((r) => (
                                <li key={r._id} className="border-b last:border-0">
                                    <button type="button" onClick={() => onOpenRetailer(r._id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50">
                                        <Avatar name={r.name} src={r.profilePicture} size="w-8 h-8" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="truncate text-sm text-foreground">{r.name}</p>
                                                <p className="lp-figure flex-none text-sm text-foreground">{inr.format(r.earned)}</p>
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-3">
                                                <ShareBar value={r.earned} max={topMax} />
                                                <span className="flex-none text-[12px] text-muted-foreground tabular-nums">
                                                    {inrShort(r.volume)} · {r.count} txns
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>

                <Panel title="Service mix" action={<Segmented label="Mix by" size="sm" value={mixBy} onChange={setMixBy} options={[['volume', 'Volume'], ['earned', 'Commission']] as const} />}>
                    {loading && !data ? (
                        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : services.length === 0 ? (
                        <Empty>No transactions in this range.</Empty>
                    ) : (
                        <ul className="space-y-4">
                            {services.slice(0, 7).map((s) => (
                                <li key={s.type}>
                                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                        <span className="truncate text-foreground">{serviceLabel(s.type)}</span>
                                        <span className="lp-figure text-foreground">{mixBy === 'volume' ? inrShort(s.volume) : inr.format(s.earned)}</span>
                                    </div>
                                    <ShareBar value={s[mixBy]} max={mixMax} />
                                    <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">{s.count} txns</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <Panel title="Recent network activity" description="The latest 12 transactions from your retailers." flush>
                {loading && !data ? (
                    <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : !data?.recent.length ? (
                    <Empty>Transactions from your retailers will appear here.</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <table className={TABLE}>
                            <thead>
                                <tr className={THEAD}>
                                    <th className={TH}>Retailer</th>
                                    <th className={TH}>Service</th>
                                    <th className={`${TH} text-right`}>Amount</th>
                                    <th className={`${TH} text-right`}>Your commission</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} text-right`}>When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recent.map((t) => (
                                    <tr key={t._id} onClick={() => t.retailer && onOpenRetailer(t.retailer._id)} className={`${TR} cursor-pointer`}>
                                        <td className={TD}>
                                            <p className="text-foreground">{t.retailer?.name || '—'}</p>
                                            <p className="lp-figure text-[12px] text-muted-foreground">{t.retailer?.retailerId}</p>
                                        </td>
                                        <td className={TD}>{serviceLabel(t.type)}</td>
                                        <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(t.amount)}</td>
                                        <td className={`${TD} lp-figure text-right`}>{t.commissions?.distributorEarned ? inr.format(t.commissions.distributorEarned) : '—'}</td>
                                        <td className={TD}><StatusDot status={t.status} /></td>
                                        <td className={`${TD} whitespace-nowrap text-right text-muted-foreground`}>{ago(t.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {!loading && data && data.totals.totalRetailers === 0 && (
                <Panel>
                    <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">You have no retailers yet. Add your first one to start earning.</p>
                        <button type="button" onClick={() => onNavigate('create')} className={`${BUTTON_QUIET} mt-5`}><UserPlus size={16} strokeWidth={1.75} /> Add retailer</button>
                    </div>
                </Panel>
            )}
        </div>
    );
};

export default NetworkDashboard;
