import { useId, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { RANGES, inr, type TrendPoint } from './shared';
import { Roll } from '../landing/motion';

/*
 * The admin and distributor portals' parts, built to the public site's rules
 * (Stageshow craft): hierarchy from type and space rather than boxes, one
 * accent, figures that roll when they change, choices whose highlight slides.
 */

/** A page's title sits on the page: serif title, one line of description, actions on the right. */
export const PageHeader = ({ eyebrow, title, description, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) => (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
            {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
            <h1 className="lp-serif mt-1 text-[34px] leading-[1.05] text-foreground sm:text-[40px]">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
);

/** A titled surface. `flush` lets a table or list run edge to edge under the header. */
export const Panel = ({ title, description, action, children, className = '', flush = false }: {
    title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) => (
    <section className={`min-w-0 rounded-2xl border bg-card ${className}`}>
        {(title || action) && (
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3">
                <div className="min-w-0">
                    {title && <h2 className="text-[15px] font-medium text-foreground">{title}</h2>}
                    {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
                </div>
                {action}
            </div>
        )}
        <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
);

/** One line, centred, quiet: what an empty list or range says. */
export const Empty = ({ children }: { children: React.ReactNode }) => (
    <p className="px-5 py-12 text-center text-sm text-muted-foreground">{children}</p>
);

/** A quiet text action with an arrow: "View all", "Open explorer". */
export const TextLink = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        {children} <ArrowRight size={13} strokeWidth={1.75} />
    </button>
);

export type Stat = { label: string; value: string; hint?: React.ReactNode; change?: number | null; onClick?: () => void };

/** Key figures in one row, parted by hairlines; values roll when the range changes. */
export const StatStrip = ({ items, loading, cols = 4 }: { items: Stat[]; loading?: boolean; cols?: 3 | 4 | 6 }) => {
    // Nothing to show and nothing coming (an error): no empty strip.
    if (!loading && !items.length) return null;
    const grid = cols === 6 ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
    return (
        <section className="overflow-hidden rounded-2xl border bg-card">
            <div className={`grid gap-px bg-border ${grid}`}>
                {loading && !items.length
                    ? Array.from({ length: cols }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-14" /></div>)
                    : items.map(({ label, value, hint, change, onClick }) => {
                        const body = (
                            <>
                                <p className="text-[13px] text-muted-foreground">{label}</p>
                                <p className="lp-figure mt-2 truncate text-[24px] leading-none tracking-[-0.02em] text-foreground"><Roll value={value} /></p>
                                <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                                    {change !== undefined && change !== null && <DeltaBadge value={change} />}
                                    {hint && <span>{hint}</span>}
                                </div>
                            </>
                        );
                        return onClick
                            ? <button key={label} type="button" onClick={onClick} className="bg-card p-5 text-left transition-colors hover:bg-muted/60">{body}</button>
                            : <div key={label} className="bg-card p-5">{body}</div>;
                    })}
            </div>
        </section>
    );
};

/** A set of options where one is chosen; the highlight slides to the choice. */
export function Segmented<T extends string | number>({ options, value, onChange, label, size = 'md' }: {
    options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md';
}) {
    const id = useId();
    return (
        <div role="tablist" aria-label={label} className="inline-flex rounded-[10px] border bg-background p-0.5">
            {options.map(([key, text]) => {
                const on = key === value;
                return (
                    <button
                        key={String(key)}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(key)}
                        className={`relative rounded-lg ${size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'} transition-colors ${on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-muted" transition={{ duration: 0.35, ease: [0.45, 0, 0.1, 1] }} />}
                        <span className="relative">{text}</span>
                    </button>
                );
            })}
        </div>
    );
}

export const RangeSwitch = ({ value, onChange }: { value: number; onChange: (d: number) => void }) => (
    <Segmented label="Date range" value={value} onChange={onChange} options={RANGES.map((d) => [d, `${d} days`] as const)} />
);

/** A status said as a dot and a word, in the status's colour. */
export const StatusDot = ({ status }: { status?: string }) => {
    const s = String(status || 'PENDING').toUpperCase();
    const tone = s === 'SUCCESS' || s === 'APPROVED' || s === 'ACTIVE' ? 'bg-[var(--lp-positive)]'
        : s === 'FAILED' || s === 'REJECTED' ? 'bg-[var(--lp-danger)]'
        : s === 'REFUNDED' || s === 'INACTIVE' ? 'bg-muted-foreground'
        : 'bg-amber-500';
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground">
            <span aria-hidden className={`size-1.5 flex-none rounded-full ${tone}`} />
            {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
        </span>
    );
};

export const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />
);

/** Named avatars take their own colour, from the name, so the same person is always the same tint. */
const AVATAR_TINTS = ['#7c6ad6', '#3d8bd9', '#2f9e74', '#d0673f', '#c25b8f', '#b08a1e'];
export const Avatar = ({ name, src, size = 'w-9 h-9' }: { name?: string; src?: string; size?: string }) => {
    const tint = AVATAR_TINTS[[...(name || 'R')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TINTS.length];
    return (
        <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium`} style={{ background: `${tint}26`, color: tint }}>
            {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name?.charAt(0) || 'R').toUpperCase()}
        </div>
    );
};

/** Change against the previous period, as coloured text rather than a pill. */
export const DeltaBadge = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-muted-foreground">No prior data</span>;
    const up = value >= 0;
    return (
        <span className={`lp-figure tabular-nums ${up ? 'text-[var(--lp-positive)]' : 'text-[var(--lp-danger)]'}`}>
            {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
        </span>
    );
};

const dayLabel = (date: string) =>
    new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/**
 * Daily trend with a hover readout. One accent line on a soft fill; a hairline and dot follow the pointer.
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
                        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((f) => (
                        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}
                    <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id}-fill)`} style={morph} />
                    <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={morph} />
                </svg>
                {hover !== null && (
                    <>
                        <div className="pointer-events-none absolute inset-y-0 w-px bg-border" style={{ left: pct(hover) }} />
                        <div
                            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--chart-1)]"
                            style={{ left: pct(hover), top: `${(py(values[hover]) / H) * 100}%` }}
                        />
                        <div
                            className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border bg-popover px-3 py-1.5 text-xs shadow-md ${hover > n / 2 ? '-translate-x-full -ml-3' : 'ml-3'}`}
                            style={{ left: pct(hover) }}
                        >
                            <p className="text-muted-foreground">{dayLabel(points[hover].date)}</p>
                            <p className="lp-figure text-foreground">{fmt(values[hover])}</p>
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
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
            className="h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
        />
    </div>
);
