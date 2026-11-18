import { useState } from 'react';
import { CARD, LABEL, delta, useApiGet } from '../distributor/shared';
import { DeltaBadge, RangeSwitch, ShareBar, Skeleton } from '../distributor/ui';

type Row = { key: string; count: number };
type Analytics = {
    days: number;
    totals: { visitors: number; views: number };
    previous: { visitors: number; views: number };
    today: { visitors: number; views: number };
    liveNow: number;
    trend: { date: string; visitors: number; views: number }[];
    pages: Row[];
    referrers: Row[];
    devices: Row[];
    countries: Row[];
};

const num = (n: number) => n.toLocaleString('en-IN');
const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const COUNTRY = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const countryName = (code: string) => {
    try { return COUNTRY?.of(code) || code; } catch { return code; }
};

/** Daily unique visitors as bars; hover a bar for the day's numbers. */
const VisitorBars = ({ trend }: { trend: Analytics['trend'] }) => {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(...trend.map((d) => d.visitors), 1);
    const shown = hover ?? trend.length - 1;
    const day = trend[shown];
    return (
        <div>
            <div className="mb-4 flex items-baseline gap-3 text-sm">
                <span className="text-muted-foreground">{dayLabel(day.date)}</span>
                <span className="font-semibold tabular-nums">{num(day.visitors)} visitors</span>
                <span className="text-muted-foreground tabular-nums">{num(day.views)} views</span>
            </div>
            <div className="flex h-44 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
                {trend.map((d, i) => (
                    <div key={d.date} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                        <div
                            className={`w-full rounded-t-[3px] transition-colors ${i === shown ? 'bg-primary' : 'bg-primary/25'}`}
                            style={{ height: `${Math.max(2, (d.visitors / max) * 100)}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{dayLabel(trend[0].date)}</span>
                <span>{dayLabel(trend[trend.length - 1].date)}</span>
            </div>
        </div>
    );
};

const TopList = ({ title, rows, label = (k: string) => k, empty }: { title: string; rows: Row[]; label?: (k: string) => string; empty: string }) => {
    const max = Math.max(...rows.map((r) => r.count), 0);
    return (
        <section className={CARD}>
            <h2 className="mb-4 font-semibold">{title}</h2>
            {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map((r) => (
                        <li key={r.key}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate">{label(r.key)}</span>
                                <span className="font-semibold tabular-nums">{num(r.count)}</span>
                            </div>
                            <ShareBar value={r.count} max={max} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

const SiteAnalytics = ({ token }: { token: string | null }) => {
    const [days, setDays] = useState(30);
    const { data, loading, error } = useApiGet<Analytics>(token, `/api/admin/system/analytics?days=${days}`);

    const stats = data ? [
        { label: 'Unique visitors', value: num(data.totals.visitors), change: delta(data.totals.visitors, data.previous.visitors) },
        { label: 'Page views', value: num(data.totals.views), change: delta(data.totals.views, data.previous.views) },
        { label: 'Visitors today', value: num(data.today.visitors), change: null },
        { label: 'On the site now', value: num(data.liveNow), change: null, live: true },
    ] : [];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Visitors</h1>
                    <p className="text-sm text-muted-foreground">Who visits shahparpay.in and the portal. Bots and your own admin pages are left out.</p>
                </div>
                <RangeSwitch value={days} onChange={setDays} />
            </header>

            {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

            <section className={`${CARD} overflow-hidden p-0`}>
                <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
                    {loading && !data
                        ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-14" /></div>)
                        : stats.map((s) => (
                            <div key={s.label} className="bg-card p-5">
                                <p className={`${LABEL} flex items-center gap-2`}>
                                    {s.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                    {s.label}
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
                                {s.change !== null && <div className="mt-1.5"><DeltaBadge value={s.change} /></div>}
                            </div>
                        ))}
                </div>
                <div className="border-t p-5">
                    {loading && !data ? <Skeleton className="h-52" /> : data && <VisitorBars trend={data.trend} />}
                </div>
            </section>

            {data && (
                <div className="grid gap-6 md:grid-cols-2">
                    <TopList title="Top pages" rows={data.pages} empty="No page views yet." />
                    <TopList title="Where they come from" rows={data.referrers} empty="Everyone came directly so far." />
                    <TopList title="Devices" rows={data.devices} label={(k) => k[0].toUpperCase() + k.slice(1)} empty="No data yet." />
                    <TopList title="Countries" rows={data.countries} label={countryName} empty="No data yet." />
                </div>
            )}
        </div>
    );
};

export default SiteAnalytics;
