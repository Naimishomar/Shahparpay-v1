import { useMemo, useState } from 'react';
import { ArrowDownUp, Download, Search, UserPlus } from 'lucide-react';
import { ALERT_ERROR } from '../landing/ui';
import { BUTTON, BUTTON_QUIET, FIELD, TABLE, TD, TH, THEAD, TR, type NetworkAnalytics, type NetworkRetailer, ago, daysSince, inr, inrShort, useDistributorData } from './shared';
import { Avatar, Empty, PageHeader, Panel, RangeSwitch, Segmented, ShareBar, Skeleton } from './ui';
import type { DirectoryPreset } from './NetworkDashboard';
import { aepsKycDone, aepsStepLabel } from '../../lib/services';

type Filter = NonNullable<DirectoryPreset['filter']>;
type Sort = NonNullable<DirectoryPreset['sort']>;

const FILTERS: { key: Filter; label: string; test: (r: NetworkRetailer) => boolean }[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'kyc', label: 'KYC pending', test: (r) => !aepsKycDone(r) },
    { key: 'inactive', label: 'Quiet 7+ days', test: (r) => !!r.lastActiveAt && daysSince(r.lastActiveAt) >= 7 },
    { key: 'dormant', label: 'Never transacted', test: (r) => !r.lastActiveAt },
];

const SORTS: { key: Sort; label: string; compare: (a: NetworkRetailer, b: NetworkRetailer) => number }[] = [
    { key: 'earned', label: 'Commission (range)', compare: (a, b) => b.earned - a.earned || b.volume - a.volume },
    { key: 'volume', label: 'Volume (range)', compare: (a, b) => b.volume - a.volume },
    { key: 'lastActive', label: 'Least recently active', compare: (a, b) => daysSince(b.lastActiveAt) - daysSince(a.lastActiveAt) },
    { key: 'newest', label: 'Newest first', compare: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) },
];

const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = (rows: NetworkRetailer[], days: number) => {
    const header = ['Retailer ID', 'Name', 'Business', 'KYC', `Commission (${days}d)`, `Volume (${days}d)`, `Transactions (${days}d)`, 'Lifetime commission', 'Last active', 'Joined'];
    const lines = rows.map((r) => [
        r.retailerId, r.name, r.businessName, aepsStepLabel(r),
        r.earned.toFixed(2), r.volume.toFixed(2), r.count, r.lifetimeEarned.toFixed(2),
        r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : '', new Date(r.createdAt).toISOString().slice(0, 10),
    ].map(csvCell).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `retailers-${days}d-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
};

const RetailerDirectory = ({
    token,
    days,
    onDaysChange,
    preset,
    onOpenRetailer,
    onCreate,
}: {
    token: string | null;
    days: number;
    onDaysChange: (d: number) => void;
    preset: DirectoryPreset;
    onOpenRetailer: (id: string) => void;
    onCreate: () => void;
}) => {
    const { data, loading, error } = useDistributorData<NetworkAnalytics>(token, '/api/distributor/analytics', days);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>(preset.filter || 'all');
    const [sort, setSort] = useState<Sort>(preset.sort || 'earned');

    const all = useMemo(() => data?.retailers || [], [data]);
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const test = FILTERS.find((f) => f.key === filter)!.test;
        return all
            .filter(test)
            .filter((r) => !q || [r.name, r.retailerId, r.businessName].some((v) => v?.toLowerCase().includes(q)))
            .sort(SORTS.find((s) => s.key === sort)!.compare);
    }, [all, query, filter, sort]);
    const maxEarned = Math.max(...rows.map((r) => r.earned), 0);

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Network"
                title="My retailers"
                description="Track each retailer's business and what they earn you."
                actions={<>
                    <RangeSwitch value={days} onChange={onDaysChange} />
                    <button type="button" onClick={() => exportCsv(rows, days)} disabled={!rows.length} className={BUTTON_QUIET}>
                        <Download size={16} strokeWidth={1.75} /> Export CSV
                    </button>
                    <button type="button" onClick={onCreate} className={BUTTON}>
                        <UserPlus size={16} strokeWidth={1.75} /> New
                    </button>
                </>}
            />

            {error && <div className={ALERT_ERROR}>{error}</div>}

            <Panel
                flush
                title={
                    <Segmented
                        label="Filter retailers"
                        size="sm"
                        value={filter}
                        onChange={setFilter}
                        options={FILTERS.map((f) => [f.key, `${f.label} ${loading && !data ? '–' : all.filter(f.test).length}`] as const)}
                    />
                }
                action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, business" className={`${FIELD} pl-9 sm:w-64`} />
                        </div>
                        <label className="relative">
                            <span className="sr-only">Sort by</span>
                            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${FIELD} appearance-none pl-9 pr-8 sm:w-56`}>
                                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </label>
                    </div>
                }
            >
                <div className="overflow-x-auto">
                    <table className={TABLE}>
                        <thead>
                            <tr className={THEAD}>
                                <th className={TH}>Retailer</th>
                                <th className={`${TH} min-w-[180px]`}>Commission · {days}d</th>
                                <th className={`${TH} text-right`}>Volume</th>
                                <th className={`${TH} text-right`}>Txns</th>
                                <th className={`${TH} text-right`}>Lifetime</th>
                                <th className={TH}>Last active</th>
                                <th className={TH}>KYC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !data ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className={TR}><td colSpan={7} className={TD}><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <Empty>{all.length ? 'No retailers match this view.' : 'No retailers yet. Click "New" to add one.'}</Empty>
                                    </td>
                                </tr>
                            ) : rows.map((r) => {
                                const quiet = daysSince(r.lastActiveAt);
                                return (
                                    <tr key={r._id} onClick={() => onOpenRetailer(r._id)} className={`${TR} cursor-pointer`}>
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <Avatar name={r.name} src={r.profilePicture} size="w-8 h-8" />
                                                <div className="min-w-0">
                                                    <p className="truncate text-foreground">{r.name}</p>
                                                    <p className="truncate text-[12px] text-muted-foreground"><span className="lp-figure">{r.retailerId}</span>{r.businessName ? ` · ${r.businessName}` : ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={TD}>
                                            <p className="lp-figure mb-1.5 text-foreground">{inr.format(r.earned)}</p>
                                            <ShareBar value={r.earned} max={maxEarned} />
                                        </td>
                                        <td className={`${TD} lp-figure text-right`}>{inrShort(r.volume)}</td>
                                        <td className={`${TD} lp-figure text-right`}>{r.count}</td>
                                        <td className={`${TD} lp-figure text-right text-muted-foreground`}>{inrShort(r.lifetimeEarned)}</td>
                                        <td className={`${TD} whitespace-nowrap`}>
                                            <span className={`inline-flex items-center gap-1.5 text-[13px] ${quiet >= 7 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                <span aria-hidden className={`size-1.5 rounded-full ${quiet < 1 ? 'bg-[var(--lp-positive)]' : quiet < 7 ? 'bg-muted-foreground' : 'bg-amber-500'}`} />
                                                {ago(r.lastActiveAt)}
                                            </span>
                                        </td>
                                        <td className={TD}>
                                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground">
                                                <span aria-hidden className={`size-1.5 flex-none rounded-full ${aepsKycDone(r) ? 'bg-[var(--lp-positive)]' : 'bg-amber-500'}`} />
                                                {aepsKycDone(r) ? 'Verified' : aepsStepLabel(r)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {!!rows.length && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[13px] text-muted-foreground">
                        <p>{rows.length} of {all.length} retailers</p>
                        <p className="tabular-nums">
                            Shown: <span className="lp-figure text-foreground">{inr.format(rows.reduce((s, r) => s + r.earned, 0))}</span> commission · <span className="lp-figure text-foreground">{inrShort(rows.reduce((s, r) => s + r.volume, 0))}</span> volume
                        </p>
                    </div>
                )}
            </Panel>
        </div>
    );
};

export default RetailerDirectory;
