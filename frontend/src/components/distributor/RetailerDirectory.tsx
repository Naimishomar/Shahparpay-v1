import { useMemo, useState } from 'react';
import { ArrowDownUp, Download, Search, ShieldCheck, Clock, UserPlus, Users } from 'lucide-react';
import { CARD, INPUT, LABEL, type NetworkAnalytics, type NetworkRetailer, PENDING_PILL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, ago, daysSince, inr, inrShort, useDistributorData } from './shared';
import { Avatar, RangeSwitch, ShareBar, Skeleton } from './ui';
import type { DirectoryPreset } from './NetworkDashboard';

type Filter = NonNullable<DirectoryPreset['filter']>;
type Sort = NonNullable<DirectoryPreset['sort']>;

const FILTERS: { key: Filter; label: string; test: (r: NetworkRetailer) => boolean }[] = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'kyc', label: 'KYC pending', test: (r) => !r.isMerchantKycComplete },
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
        r.retailerId, r.name, r.businessName, r.isMerchantKycComplete ? 'Verified' : 'Pending',
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
    onKycLink,
    onCreate,
}: {
    token: string | null;
    days: number;
    onDaysChange: (d: number) => void;
    preset: DirectoryPreset;
    onOpenRetailer: (id: string) => void;
    onKycLink: (id: string) => void;
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
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Users className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My retailers</h1>
                            <p className="text-sm text-muted-foreground">Track each retailer's business and what they earn you.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <RangeSwitch value={days} onChange={onDaysChange} />
                        <button onClick={() => exportCsv(rows, days)} disabled={!rows.length} className={`${SECONDARY_BUTTON} py-2`}>
                            <Download size={16} /> Export CSV
                        </button>
                        <button onClick={onCreate} className={`${PRIMARY_BUTTON} py-2`}>
                            <UserPlus size={16} /> New
                        </button>
                    </div>
                </div>
            </section>

            <section className={`${CARD} p-0 overflow-hidden`}>
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map((f) => {
                            const count = all.filter(f.test).length;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === f.key ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                                >
                                    {f.label}
                                    <span className="tabular-nums opacity-70">{loading && !data ? '–' : count}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, business" className={`${INPUT} pl-9 sm:w-64`} />
                        </div>
                        <label className="relative">
                            <span className="sr-only">Sort by</span>
                            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${INPUT} pl-9 pr-8 appearance-none sm:w-56`}>
                                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </label>
                    </div>
                </div>

                {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-3 font-medium">Retailer</th>
                                <th className="px-4 py-3 font-medium min-w-[180px]">Commission · {days}d</th>
                                <th className="px-4 py-3 font-medium text-right">Volume</th>
                                <th className="px-4 py-3 font-medium text-right">Txns</th>
                                <th className="px-4 py-3 font-medium text-right">Lifetime</th>
                                <th className="px-4 py-3 font-medium">Last active</th>
                                <th className="px-4 py-3 font-medium">KYC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading && !data ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        {all.length ? 'No retailers match this view.' : 'No retailers yet. Click "New" to add one.'}
                                    </td>
                                </tr>
                            ) : rows.map((r) => {
                                const quiet = daysSince(r.lastActiveAt);
                                return (
                                    <tr key={r._id} onClick={() => onOpenRetailer(r._id)} className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={r.name} src={r.profilePicture} />
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold">{r.name}</p>
                                                    <p className="truncate text-[11px] text-muted-foreground"><span className="font-mono">{r.retailerId}</span>{r.businessName ? ` · ${r.businessName}` : ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="mb-1.5 font-semibold tabular-nums">{inr.format(r.earned)}</p>
                                            <ShareBar value={r.earned} max={maxEarned} />
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{inrShort(r.volume)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{inrShort(r.lifetimeEarned)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 text-xs ${quiet >= 7 ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${quiet < 1 ? 'bg-emerald-500' : quiet < 7 ? 'bg-zinc-400' : 'bg-amber-500'}`} />
                                                {ago(r.lastActiveAt)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.isMerchantKycComplete ? (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20">
                                                    <ShieldCheck size={12} /> Verified
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${PENDING_PILL}`}>
                                                        <Clock size={12} /> Pending
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onKycLink(r._id); }}
                                                        className="rounded-lg border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                                    >
                                                        KYC link
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {!!rows.length && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                        <p className={LABEL}>{rows.length} of {all.length} retailers</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                            Shown: {inr.format(rows.reduce((s, r) => s + r.earned, 0))} commission · {inrShort(rows.reduce((s, r) => s + r.volume, 0))} volume
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default RetailerDirectory;
