import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ALERT_ERROR } from '../landing/ui';
import { TABLE, TD, TH, THEAD, TR, ago, delta, inr, inrShort, serviceLabel, useApiGet, type TrendPoint } from '../distributor/shared';
import { Avatar, Empty, PageHeader, Panel, RangeSwitch, Segmented, ShareBar, Skeleton, StatStrip, StatusDot, TextLink, TrendChart } from '../distributor/ui';

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
        { label: 'Success rate', value: data.successRate === null ? '—' : `${data.successRate}%`, hint: `${failed.toLocaleString('en-IN')} failed`, onClick: failed ? () => onOpenTransactions({ status: 'FAILED' }) : undefined },
        { label: 'Active retailers', value: `${data.totals.activeRetailers}/${data.users.retailers}`, hint: 'Transacted in range', onClick: () => onNavigate('users?role=retailer') },
    ] : [];

    // Only what is actually waiting; an empty queue is not news.
    const queues = data ? [
        { title: 'Retailer fund requests', count: data.queues.pendingRetailerFunds, action: () => onNavigate('fund-requests') },
        { title: 'Distributor fund requests', count: data.queues.pendingDistributorFunds, action: () => onNavigate('fund-requests') },
        { title: 'Open tickets', count: data.queues.openTickets, action: () => onNavigate('support') },
        { title: 'KYC pending', count: data.users.kycPending, action: () => onNavigate('users?role=retailer&kyc=pending') },
        { title: 'Failed transactions', count: failed, action: () => onOpenTransactions({ status: 'FAILED' }) },
        { title: 'Inactive accounts', count: data.users.inactive, action: () => onNavigate('users?status=inactive') },
    ].filter((q) => q.count > 0) : [];

    const money = data ? [
        { label: 'Retailers', value: data.users.retailers.toLocaleString('en-IN'), hint: `+${data.users.newRetailers} new`, onClick: () => onNavigate('users?role=retailer') },
        { label: 'Distributors', value: data.users.distributors.toLocaleString('en-IN'), hint: `+${data.users.newDistributors} new`, onClick: () => onNavigate('users?role=distributor') },
        { label: 'Admin wallet', value: inrShort(data.wallets.adminBalance), hint: 'Your balance' },
        { label: 'Utility float', value: inrShort(data.wallets.mainFloat), hint: 'All users' },
        { label: 'Trade float', value: inrShort(data.wallets.aepsFloat), hint: 'All users' },
        { label: 'Paid to network', value: inrShort(data.totals.distributorEarned + data.totals.retailerEarned), hint: `Last ${days} days` },
    ] : [];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader eyebrow="Admin" title="Overview" description="Everything happening across Shahparpay." actions={<RangeSwitch value={days} onChange={setDays} />} />

            {error && <div className={ALERT_ERROR}>{error}</div>}

            <StatStrip items={kpis} loading={loading} />

            <div className="grid gap-6 xl:grid-cols-3">
                <Panel
                    className="xl:col-span-2"
                    title="Daily trend"
                    description={`Last ${days} days. Hover for a day.`}
                    action={<Segmented label="Chart metric" size="sm" value={metric} onChange={setMetric} options={[['volume', 'Volume'], ['count', 'Txns'], ['adminEarned', 'Earnings']] as const} />}
                >
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : points.length ? <TrendChart points={points} metric={chartMetric} id="admin-trend" /> : <Empty>No transactions in this range.</Empty>}
                </Panel>

                {/* What is waiting on the admin, said once; nothing when nothing is. */}
                <Panel title="Needs attention" flush>
                    {!data ? (
                        <Empty>{loading ? 'Loading…' : 'Could not load the queues.'}</Empty>
                    ) : queues.length === 0 ? (
                        <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-[var(--lp-positive)]" /> Nothing waiting on you.</p>
                    ) : (
                        <ul>
                            {queues.map((q) => (
                                <li key={q.title} className="border-b last:border-0">
                                    <button type="button" onClick={q.action} className="flex h-12 w-full items-center justify-between gap-3 px-5 text-left text-sm transition-colors hover:bg-muted/50">
                                        <span className="text-foreground">{q.title}</span>
                                        <span className="lp-figure flex items-center gap-2 text-foreground">{q.count.toLocaleString('en-IN')} <ArrowRight size={13} className="text-muted-foreground" /></span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <StatStrip items={money} loading={loading} cols={6} />

            <div className="grid gap-6 lg:grid-cols-3">
                <Panel title="Service mix" action={<TextLink onClick={() => onOpenTransactions({})}>Explorer</TextLink>}>
                    {services.length === 0 ? (
                        <Empty>{loading ? 'Loading…' : 'No transactions in this range.'}</Empty>
                    ) : (
                        <ul className="space-y-4">
                            {services.slice(0, 8).map((s) => (
                                <li key={s.type}>
                                    <button type="button" onClick={() => onOpenTransactions({ type: s.type })} className="w-full text-left">
                                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                            <span className="truncate text-foreground">{serviceLabel(s.type)}</span>
                                            <span className="lp-figure text-foreground">{inrShort(s.volume)}</span>
                                        </div>
                                        <ShareBar value={s.volume} max={serviceMax} />
                                        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">{s.count} txns · {inr.format(s.adminEarned)} earned</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                {[
                    { title: 'Top distributors', rows: data?.topDistributors || [], role: 'distributor' as const, sub: (d: Overview['topDistributors'][number]) => `${d.distributorId} · ${d.activeRetailers} active` },
                    { title: 'Top retailers', rows: data?.topRetailers || [], role: 'retailer' as const, sub: (r: Overview['topRetailers'][number]) => `${r.retailerId} · ${r.count} txns` },
                ].map(({ title, rows, role, sub }) => (
                    <Panel key={title} title={title} action={<TextLink onClick={() => onNavigate(`users?role=${role}`)}>All</TextLink>} flush>
                        {rows.length === 0 ? (
                            <Empty>{loading ? 'Loading…' : 'No activity in this range.'}</Empty>
                        ) : (
                            <ol>
                                {rows.map((r) => (
                                    <li key={r._id} className="border-b last:border-0">
                                        <button type="button" onClick={() => onOpenUser(role, r._id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50">
                                            <Avatar name={r.name} size="w-8 h-8" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm text-foreground">{r.name}</p>
                                                <p className="truncate text-[12px] text-muted-foreground">{sub(r as never)}</p>
                                            </div>
                                            <p className="lp-figure flex-none text-sm text-foreground">{inrShort(r.volume)}</p>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                ))}
            </div>

            {/* Live feed from the existing SSE stream */}
            <Panel
                title={<span className="inline-flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lp-positive)] opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-[var(--lp-positive)]" /></span>Live transactions</span>}
                action={<TextLink onClick={() => onOpenTransactions({})}>Open explorer</TextLink>}
                flush
            >
                {live.length === 0 ? (
                    <Empty>Transactions appear here as they happen.</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <table className={TABLE}>
                            <thead>
                                <tr className={THEAD}>
                                    <th className={TH}>User</th>
                                    <th className={TH}>Type</th>
                                    <th className={`${TH} text-right`}>Amount</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} text-right`}>When</th>
                                </tr>
                            </thead>
                                <tbody>
                                    {live.slice(0, 10).map((t: LiveTxn) => (
                                        <motion.tr
                                            key={t._id || t.transactionId}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.4 }}
                                            className={TR}
                                        >
                                            <td className={TD}>
                                                <button type="button" onClick={() => t.userId?._id && onOpenUser('retailer', t.userId._id)} className="text-left text-foreground hover:underline">{t.userId?.name || '—'}</button>
                                            </td>
                                            <td className={TD}>{serviceLabel(t.type)}</td>
                                            <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(t.amount || 0)}</td>
                                            <td className={TD}><StatusDot status={t.status} /></td>
                                            <td className={`${TD} whitespace-nowrap text-right text-muted-foreground`}>{ago(t.createdAt)}</td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
};

export default AdminOverview;
