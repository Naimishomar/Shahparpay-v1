import { useState } from 'react';
import { ACTIVE_BUTTON, RANGES, inr, type TrendPoint } from './shared';

export const RangeSwitch = ({ value, onChange }: { value: number; onChange: (d: number) => void }) => (
    <div className="inline-flex rounded-xl border bg-background/70 backdrop-blur p-1 shadow-sm" role="tablist" aria-label="Date range">
        {RANGES.map((d) => (
            <button
                key={d}
                role="tab"
                aria-selected={value === d}
                onClick={() => onChange(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === d ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground'}`}
            >
                {d}D
            </button>
        ))}
    </div>
);

export const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />
);

export const Avatar = ({ name, src, size = 'w-9 h-9' }: { name?: string; src?: string; size?: string }) => (
    <div className={`${size} shrink-0 rounded-full bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600 p-[2px]`}>
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background text-xs font-bold text-foreground">
            {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name?.charAt(0) || 'R').toUpperCase()}
        </div>
    </div>
);

export const DeltaBadge = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-[11px] text-muted-foreground">No prior data</span>;
    const up = value >= 0;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 tabular-nums ${up
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
            : 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20'}`}>
            {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
        </span>
    );
};

const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/**
 * Daily trend with a hover readout. Same silver treatment as the retailer
 * dashboard's volume chart so the two portals read as one product.
 */
export const TrendChart = ({ points, metric, id }: { points: TrendPoint[]; metric: 'earned' | 'volume' | 'count'; id: string }) => {
    const [hover, setHover] = useState<number | null>(null);
    const W = 600, H = 160, n = points.length;
    const values = points.map((p) => p[metric]);
    const max = Math.max(...values, 0);
    const px = (i: number) => (i / Math.max(n - 1, 1)) * W;
    const py = (v: number) => H - 8 - (max > 0 ? v / max : 0) * (H - 24);
    const line = values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const morph = { transition: 'd 700ms cubic-bezier(.2,.8,.2,1)' };
    const pct = (i: number) => `${(px(i) / W) * 100}%`;
    const fmt = (v: number) => (metric === 'count' ? v.toLocaleString('en-IN') : inr.format(v));

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
    };

    if (!n) return null;
    return (
        <div>
            <div className="relative h-44 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" className="[stop-color:#a1a1aa] dark:[stop-color:#71717a]" />
                            <stop offset="50%" className="[stop-color:#3f3f46] dark:[stop-color:#f4f4f5]" />
                            <stop offset="100%" className="[stop-color:#a1a1aa] dark:[stop-color:#71717a]" />
                        </linearGradient>
                        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" className="[stop-color:#a1a1aa] dark:[stop-color:#d4d4d8]" stopOpacity="0.45" />
                            <stop offset="100%" className="[stop-color:#e4e4e7] dark:[stop-color:#27272a]" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((f) => (
                        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="stroke-black/5 dark:stroke-white/5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}
                    <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id}-fill)`} style={morph} />
                    <path d={line} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={morph} />
                </svg>
                {hover !== null && (
                    <>
                        <div className="pointer-events-none absolute inset-y-0 w-px bg-zinc-400/50" style={{ left: pct(hover) }} />
                        <div
                            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-zinc-900 bg-gradient-to-br from-zinc-300 to-zinc-600 shadow"
                            style={{ left: pct(hover), top: `${(py(values[hover]) / H) * 100}%` }}
                        />
                        <div
                            className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border bg-popover/95 backdrop-blur px-3 py-1.5 text-xs shadow-lg ${hover > n / 2 ? '-translate-x-full -ml-3' : 'ml-3'}`}
                            style={{ left: pct(hover) }}
                        >
                            <p className="text-muted-foreground">{dayLabel(points[hover].date)}</p>
                            <p className="font-semibold tabular-nums">{fmt(values[hover])}</p>
                            <p className="text-muted-foreground tabular-nums">{points[hover].count} txns</p>
                        </div>
                    </>
                )}
            </div>
            <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground tabular-nums">
                {[0, Math.floor((n - 1) / 2), n - 1].map((k) => (
                    <span key={k}>{dayLabel(points[k].date)}</span>
                ))}
            </div>
        </div>
    );
};

/** Horizontal share bars: service mix, top retailers. */
export const ShareBar = ({ value, max }: { value: number; max: number }) => (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
            className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-700 dark:from-zinc-500 dark:to-zinc-200 transition-[width] duration-700"
            style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
        />
    </div>
);
