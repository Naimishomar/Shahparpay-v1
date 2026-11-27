/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, FileDown, Loader2, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Roll } from '../landing/motion';
import RubberSegment from '../RubberSegment';
import PortalSpotlight from '../PortalSpotlight';
import Lottie from '../Lottie';
import { TitleText } from '../BlurText';
import { Root as PaginationRoot } from '@animate-ui/react/primitives/pagination';
import { ScrollFade } from '@animate-ui/react/primitives/effects/scroll-fade';

/*
 * The parts every report page is made of: a header with its exports, a row of
 * summary figures, one toolbar, a list of rows grouped by day, and a pager.
 * Colours are the portal's own tokens; motion comes from .stage-page (index.css)
 * and Roll.
 */

const INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v: unknown) => `₹${INR.format(Number(v) || 0)}`;

export const FIELD =
    'h-9 rounded-xl border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

/** Waits until typing stops before a value is used for a server query. */
export const useDebounced = <T,>(value: T, ms = 1000) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
};

/** React Bits' RubberSegment in the portal's own colours: one choice of a few, the thumb stretches to it. */
export function Seg<T extends string>({ label, value, onChange, options }: {
    label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[];
}) {
    // animate-ui ScrollFade: on a narrow screen the edges fade where more choices are off-screen.
    return (
        <ScrollFade orientation="horizontal" size={24} className="max-w-full overflow-x-auto no-scrollbar">
        <RubberSegment
            aria-label={label}
            size="sm"
            value={value}
            onChange={(v) => onChange(v as T)}
            items={options.map(([v, l]) => ({ value: v, label: l }))}
            trackColor="var(--muted)"
            thumbColor="var(--background)"
            textColor="var(--muted-foreground)"
            activeTextColor="var(--foreground)"
            className="shadow-[inset_0_0_0_1px_var(--border)]"
        />
        </ScrollFade>
    );
}

// ---------- Dates ----------

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Period = 'all' | 'today' | '7' | '30' | 'month' | 'custom';
export type Range = { start: string; end: string };

export const rangeOf = (p: Period, custom: Range): Range => {
    const now = new Date();
    const back = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return d; };
    if (p === 'today') return { start: ymd(now), end: ymd(now) };
    if (p === '7') return { start: ymd(back(6)), end: ymd(now) };
    if (p === '30') return { start: ymd(back(29)), end: ymd(now) };
    if (p === 'month') return { start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end: ymd(now) };
    if (p === 'custom' && custom.start && custom.end) return custom;
    return { start: '', end: '' };
};

/** A period picker: presets, and two dates when Custom is chosen. */
export const PeriodPicker = ({ period, onPeriod, custom, onCustom }: {
    period: Period; onPeriod: (p: Period) => void; custom: Range; onCustom: (r: Range) => void;
}) => (
    <div className="flex flex-wrap items-center gap-2">
        <Seg
            label="Period"
            value={period}
            onChange={onPeriod}
            options={[['all', 'All time'], ['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['custom', 'Custom']] as const}
        />
        {period === 'custom' && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input type="date" aria-label="From" value={custom.start} max={custom.end || undefined} onChange={(e) => onCustom({ ...custom, start: e.target.value })} className={FIELD} />
                to
                <input type="date" aria-label="To" value={custom.end} min={custom.start || undefined} onChange={(e) => onCustom({ ...custom, end: e.target.value })} className={FIELD} />
            </span>
        )}
    </div>
);

const dayKey = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : ymd(d);
};

const dayLabel = (key: string) => {
    if (!key) return 'Undated';
    const today = new Date();
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (key === ymd(today)) return 'Today';
    if (key === ymd(y)) return 'Yesterday';
    const [yy, mm, dd] = key.split('-').map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export const timeOf = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

export const dateTimeOf = (iso: string) =>
    iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/** Splits rows (newest first) into day groups, keeping their order. */
export const byDay = <T,>(rows: T[], dateOf: (r: T) => string) => {
    const groups: { key: string; label: string; rows: T[] }[] = [];
    for (const r of rows) {
        const key = dayKey(dateOf(r));
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.rows.push(r);
        else groups.push({ key, label: dayLabel(key), rows: [r] });
    }
    return groups;
};

// ---------- Page parts ----------

export const ReportHeader = ({ icon, title, description, onCsv, onPdf, exporting }: {
    icon: ReactNode; title: string; description: string; onCsv?: () => void; onPdf?: () => void; exporting?: boolean;
}) => (
    <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
            <div className="icon-chip shrink-0 rounded-xl p-2.5">{icon}</div>
            <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl"><TitleText text={title} /></h1>
                <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
        {(onCsv || onPdf) && (
            <div className="flex shrink-0 gap-2">
                {onCsv && (
                    <button type="button" onClick={onCsv} disabled={exporting} className="flex h-9 items-center gap-2 rounded-xl border bg-background px-3 text-sm font-medium shadow-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
                    </button>
                )}
                {onPdf && (
                    <button type="button" onClick={onPdf} disabled={exporting} className="btn-primary flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium disabled:opacity-50">
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
                    </button>
                )}
            </div>
        )}
    </header>
);

export type Figure = { label: string; value: string; hint?: string; tone?: 'in' | 'out' };

/** The period's figures, each a label, a rolling value and one line of meaning. */
export const Figures = ({ items, loading }: { items: Figure[]; loading?: boolean }) => (
    <section className={`grid gap-3 sm:grid-cols-2 ${items.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map((f) => (
            <PortalSpotlight key={f.label} className="rounded-2xl p-4">
                <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                {loading ? (
                    <div className="mt-2 h-7 w-32 animate-pulse rounded-md bg-black/10 dark:bg-white/10" />
                ) : (
                    <p className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${f.tone === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        <Roll value={f.value} />
                    </p>
                )}
                {f.hint && <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>}
            </PortalSpotlight>
        ))}
    </section>
);

export const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <label className="relative block min-w-[220px] flex-1 sm:max-w-xs">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${FIELD} w-full pl-9`} />
    </label>
);

export const Toolbar = ({ children }: { children: ReactNode }) => (
    <PortalSpotlight className="flex flex-col gap-3 rounded-2xl p-3">{children}</PortalSpotlight>
);

const STATUS: Record<string, string> = {
    SUCCESS: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400',
    FAILED: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400',
    REFUNDED: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
};
const STATUS_WORD: Record<string, string> = { SUCCESS: 'Success', FAILED: 'Failed', REFUNDED: 'Refunded', PROCESSING: 'Pending', PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };

export const StatusPill = ({ status, label }: { status?: string; label?: string }) => {
    const s = String(status || 'PENDING').toUpperCase();
    const tone = STATUS[s] || (/FAIL|REJECT/.test(s) ? STATUS.FAILED : 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400');
    return (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>
            {label || STATUS_WORD[s] || s.charAt(0) + s.slice(1).toLowerCase()}
        </span>
    );
};

/** The list body: loading rows at the list's own geometry, an empty state, or day groups. */
export const DayList = <T,>({ rows, loading, empty, dateOf, keyOf, render }: {
    rows: T[]; loading: boolean; empty: string; dateOf: (r: T) => string; keyOf: (r: T, i: number) => string; render: (r: T) => ReactNode;
}) => {
    if (loading) {
        return (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-busy="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 border-t px-4 py-3.5 first:border-t-0">
                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]" />
                        </div>
                        <div className="h-4 w-20 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                    </div>
                ))}
            </div>
        );
    }
    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-4 py-16 text-center text-muted-foreground shadow-sm">
                <Lottie name="empty" />
                <p className="text-sm">{empty}</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            {byDay(rows, dateOf).map((g) => (
                <PortalSpotlight key={g.key} role="region" aria-label={g.label} className="rounded-2xl">
                    <h2 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">{g.label}</h2>
                    <ul className="stage-list divide-y">
                        {g.rows.map((r, i) => <li key={keyOf(r, i)}>{render(r)}</li>)}
                    </ul>
                </PortalSpotlight>
            ))}
        </div>
    );
};

/** Previous / next with where we are; `total` when known, otherwise `hasMore`. */
/** Page numbers to show: first, last and the current one's neighbours, with … over the gaps. */
export const pageWindow = (page: number, last: number): (number | '…')[] => {
    const set = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
    const out: (number | '…')[] = [];
    [...set].sort((a, b) => a - b).forEach((p, i, arr) => {
        if (i && p - arr[i - 1] > 1) out.push('…');
        out.push(p);
    });
    return out;
};

const PAGE_BTN = 'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs tabular-nums transition-colors';

export const Pager = ({ page, onPage, shown, total, hasMore, pageSize }: {
    page: number; onPage: (p: number) => void; shown: number; total?: number; hasMore?: boolean; pageSize: number;
}) => {
    const from = shown ? (page - 1) * pageSize + 1 : 0;
    const to = (page - 1) * pageSize + shown;
    const next = total !== undefined ? to < total : !!hasMore;
    if (page === 1 && !next) return null;
    const last = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : page + (next ? 1 : 0);
    return (
        <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-xs text-muted-foreground tabular-nums">
                {from}–{to}{total !== undefined ? ` of ${total.toLocaleString('en-IN')}` : ''}
            </span>
            {/* animate-ui Pagination: the lavender pill slides to the page picked. */}
            <PaginationRoot aria-label="Pages" className="relative flex items-center gap-1 [&>[data-slot=pagination-indicator]]:rounded-lg">
                <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)} className={`${PAGE_BTN} border bg-background text-muted-foreground hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5`}>
                    <ChevronLeft className="h-4 w-4" />
                </button>
                {pageWindow(page, last).map((p, i) => p === '…' ? (
                    <span key={`gap-${i}`} data-slot="pagination-ellipsis" aria-hidden className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        data-slot="pagination-link"
                        aria-current={p === page ? 'page' : undefined}
                        aria-label={`Page ${p}`}
                        onClick={() => p !== page && onPage(p)}
                        className={`${PAGE_BTN} ${p === page ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'}`}
                    >
                        {p}
                    </button>
                ))}
                <button type="button" aria-label="Next page" disabled={!next} onClick={() => onPage(page + 1)} className={`${PAGE_BTN} border bg-background text-muted-foreground hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5`}>
                    <ChevronRight className="h-4 w-4" />
                </button>
            </PaginationRoot>
        </div>
    );
};

// ---------- Exports ----------

export const downloadCsv = (name: string, headers: string[], rows: (string | number)[][]) => {
    const lines = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const a = document.createElement('a');
    // BOM so Excel reads ₹ and Hindi names correctly.
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + lines.join('\n'))}`;
    a.download = `${name}_${ymd(new Date())}.csv`;
    a.click();
};

export const downloadPdf = (title: string, subtitle: string, headers: string[], rows: (string | number)[][]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(subtitle, 14, 21);
    // jsPDF's built-in fonts have no ₹ glyph; amounts go out as plain numbers.
    autoTable(doc, { head: [headers], body: rows, startY: 26, styles: { fontSize: 7.5 }, headStyles: { fillColor: [22, 20, 46] } });
    doc.save(`${title.replace(/\s+/g, '')}_${ymd(new Date())}.pdf`);
};

export const plain = (v: unknown) => (Number(v) || 0).toFixed(2);
