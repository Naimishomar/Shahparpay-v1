import {
    Banknote, Smartphone, Fingerprint, Building2, Receipt, Wallet, IndianRupee, Users, CreditCard, FileText,
    CalendarDays, ChevronDown, ArrowUpRight, ShieldAlert, Inbox,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { isServiceEnabled } from '../lib/services';
import { useNavigate } from 'react-router-dom';
import MerchantKycModal from '../components/MerchantKycModal';
import { toast } from "sonner";

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

// toISOString() is UTC, so before 05:30 IST it names yesterday. Format locally.
const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Full class strings: Tailwind only ships classes it can find literally.
const ACCENTS = {
    silver: { tile: 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30', bar: 'bg-gradient-to-r from-zinc-300 via-zinc-500 to-zinc-300 dark:from-zinc-500 dark:via-zinc-200 dark:to-zinc-500', glow: 'bg-zinc-400/25' },
    sky: { tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20', bar: 'bg-sky-500', glow: 'bg-sky-500/20' },
    emerald: { tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20', bar: 'bg-emerald-500', glow: 'bg-emerald-500/20' },
    amber: { tile: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20', bar: 'bg-amber-500', glow: 'bg-amber-500/20' },
    rose: { tile: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20', bar: 'bg-rose-500', glow: 'bg-rose-500/20' },
    cyan: { tile: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20', bar: 'bg-cyan-500', glow: 'bg-cyan-500/20' },
} as const;

const QUICK_ACTIONS = [
    { title: 'AEPS Services', hint: 'Cash withdrawal & inquiry', url: '/aeps', service: 'aeps' as const, icon: Fingerprint, accent: 'emerald' },
    { title: 'Lead Generation', hint: 'Credit cards & loans', url: '/lead-generation', service: 'lead' as const, icon: Users, accent: 'sky' },
    { title: 'PAN Card', hint: 'Apply NSDL PAN', url: '/pan', service: 'pan' as const, icon: CreditCard, accent: 'rose' },
    { title: 'ITR Filing', hint: 'Income tax return', url: '/itr', service: 'itr' as const, icon: FileText, accent: 'silver' },
] as const;

const STATUS_PILL: Record<string, string> = {
    SUCCESS: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    FAILED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20',
};
const PENDING_PILL = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';

const SALE_ICON: Record<string, typeof Banknote> = {
    'DMT': Banknote,
    'AEPS': Fingerprint,
    'AEPS Settlement': Building2,
    'Direct Payout': Building2,
    'Wallet Topup': Wallet,
    'Recharge / BBPS': Smartphone,
};

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Bucket i of `n` evenly splitting [start, end] — mirrors the backend's binning. */
const bucketLabel = (start: Date, end: Date, i: number, n: number) => {
    // `end` is 23:59:59.999; +1ms makes buckets land on whole hours (20:00, not 19:59).
    const span = end.getTime() + 1 - start.getTime();
    const at = (k: number) => new Date(start.getTime() + (span * k) / n);
    const short = span <= 2 * 86400000;
    const fmt = (d: Date) => short
        ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
    return { from: fmt(at(i)), to: fmt(at(i + 1)), edge: fmt(at(i)) };
};

/**
 * Volume trend over the selected range, one point per backend bucket. Paths
 * animate between datasets, and hovering shows each bucket's amount.
 */
const VolumeChart = ({ points, start, end }: { points: number[]; start: Date; end: Date }) => {
    const [hover, setHover] = useState<number | null>(null);
    const W = 600, H = 120, n = points.length;
    const max = Math.max(...points, 0);
    const px = (i: number) => (i / Math.max(n - 1, 1)) * W;
    const py = (v: number) => H - 8 - (max > 0 ? v / max : 0) * (H - 24);
    // Straight segments: each bucket rises to a sharp, conical peak.
    const line = points.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const morph = { transition: 'd 700ms cubic-bezier(.2,.8,.2,1)' };

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setHover(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
    };
    const tip = hover === null ? null : bucketLabel(start, end, hover, n);
    const pct = (i: number) => `${(px(i) / W) * 100}%`;

    return (
        <div className="relative">
            <div className="relative h-32 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                        {/* Silver: bright centre, darker edges, like brushed metal. */}
                        <linearGradient id="dash-silver-stroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" className="[stop-color:#a1a1aa] dark:[stop-color:#71717a]" />
                            <stop offset="50%" className="[stop-color:#52525b] dark:[stop-color:#f4f4f5]" />
                            <stop offset="100%" className="[stop-color:#a1a1aa] dark:[stop-color:#71717a]" />
                        </linearGradient>
                        <linearGradient id="dash-silver-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" className="[stop-color:#a1a1aa] dark:[stop-color:#d4d4d8]" stopOpacity="0.45" />
                            <stop offset="100%" className="[stop-color:#e4e4e7] dark:[stop-color:#27272a]" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#dash-silver-fill)" style={morph} />
                    <path d={line} fill="none" stroke="url(#dash-silver-stroke)" strokeWidth="2.5" strokeLinejoin="miter" strokeMiterlimit="20" vectorEffect="non-scaling-stroke" style={morph} />
                </svg>
                {hover !== null && tip && (
                    <>
                        <div className="pointer-events-none absolute inset-y-0 w-px bg-zinc-400/50" style={{ left: pct(hover) }} />
                        <div
                            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-zinc-900 bg-gradient-to-br from-zinc-300 to-zinc-600 shadow"
                            style={{ left: pct(hover), top: `${(py(points[hover]) / H) * 100}%` }}
                        />
                        <div
                            className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border bg-popover/95 backdrop-blur px-3 py-1.5 text-xs shadow-lg ${hover > n / 2 ? '-translate-x-full -ml-3' : 'ml-3'}`}
                            style={{ left: pct(hover) }}
                        >
                            <p className="text-muted-foreground">{tip.from} – {tip.to}</p>
                            <p className="font-semibold tabular-nums">{inr.format(points[hover])}</p>
                        </div>
                    </>
                )}
            </div>
            <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground tabular-nums">
                {[0, Math.floor(n / 2), n].map((k) => (
                    <span key={k}>{bucketLabel(start, end, k, n).edge}</span>
                ))}
            </div>
        </div>
    );
};

const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [recentSales, setRecentSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRangeText, setDateRangeText] = useState('Today');
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [tempDateType, setTempDateType] = useState('Today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [kycLoading, setKycLoading] = useState(false);
    const [showMerchantKycModal, setShowMerchantKycModal] = useState(false);

    const [range, setRange] = useState(() => ({ start: ymd(new Date()), end: ymd(new Date()) }));

    // `silent` refreshes swap numbers in place so the chart animates instead of blinking to skeletons.
    const fetchStats = async (start?: string, end?: string, silent = false) => {
        if (!token) return;
        try {
            if (!silent) setLoading(true);
            let url = `${import.meta.env.VITE_BACKEND_URL}/api/dashboard/retailer`;
            if (start && end) {
                url += `?startDate=${start}&endDate=${end}`;
            }
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setStats(res.data.data.stats);
                setRecentSales(res.data.data.recentSales);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Keep the dashboard live: poll, and refresh as soon as any page reports a wallet change.
    const refreshRef = useRef(() => {});
    useEffect(() => {
        refreshRef.current = () => fetchStats(range.start, range.end, true);
        fetchStats(range.start, range.end);
    }, [token, range]);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible') refreshRef.current(); };
        const timer = window.setInterval(refresh, 60000);
        window.addEventListener('wallet-updated', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('wallet-updated', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);

    const applyDateFilter = () => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (tempDateType === 'Custom Range') {
            if (!customStart || !customEnd) return; // Prevent apply if missing dates
            setDateRangeText(tempDateType);
            setRange({ start: customStart, end: customEnd });
            setPopoverOpen(false);
            return;
        }
        switch (tempDateType) {
            case 'Today':
                break;
            case 'Yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'Last 7 Days':
                start.setDate(today.getDate() - 7);
                break;
            case 'Last 30 Days':
                start.setDate(today.getDate() - 30);
                break;
            case 'This Month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'Last Month':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
        }

        setDateRangeText(tempDateType);
        setRange({ start: ymd(start), end: ymd(end) });
        setPopoverOpen(false);
    };

    const handleCompleteKyc = async () => {
        if (!token || !user) return;
        try {
            setKycLoading(true);
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                merchantId: user.id || user._id,
                isNew: "1",
                callbackUrl: window.location.origin + "/dashboard"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                if (res.data.alreadyOnboarded) {
                    setShowMerchantKycModal(true);
                } else if (res.data.url) {
                    window.open(res.data.url, '_blank');
                } else {
                    toast.error("Invalid KYC URL returned.");
                }
            } else {
                toast.error(res.data.message || "Failed to fetch KYC URL");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to fetch KYC URL");
        } finally {
            setKycLoading(false);
        }
    };

    const volume = Number(stats?.TotalTransactionsAmount) || 0;
    const rangeLabel = dateRangeText === 'Custom Range' && customStart && customEnd
        ? `${customStart} → ${customEnd}`
        : dateRangeText;
    const firstName = String(user?.name || '').trim().split(/\s+/)[0];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {user && user.isMerchantKycComplete === false && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold">KYC pending</p>
                            <p className="text-sm opacity-80">Complete your KYC via PaySprint to activate all services.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCompleteKyc}
                        disabled={kycLoading}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-600 disabled:opacity-50"
                    >
                        {kycLoading ? 'Loading...' : 'Complete KYC'}
                    </button>
                </div>
            )}

            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
                        </p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Transaction volume · {rangeLabel}
                        </p>
                        {loading ? (
                            <Skeleton className="mt-2 h-11 w-56" />
                        ) : (
                            <h1 className="mt-1 text-4xl md:text-5xl font-bold tracking-tight tabular-nums bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                                {inr.format(volume)}
                            </h1>
                        )}
                        {loading ? <Skeleton className="mt-2 h-4 w-28" /> : (
                            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span className="font-semibold tabular-nums text-foreground">{stats?.TotalCustomers || 0}</span> customers served
                            </p>
                        )}
                    </div>

                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button className="self-start flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-4 py-2 text-sm font-medium shadow-sm hover:bg-background">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                {rangeLabel}
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2 rounded-2xl bg-popover border-border shadow-xl" align="end">
                            <div className="flex flex-col space-y-1">
                                {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Custom Range'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTempDateType(type)}
                                        className={`px-3 py-2 text-sm text-left rounded-lg transition-colors ${tempDateType === type ? 'bg-gradient-to-b from-zinc-200 to-zinc-400 text-zinc-900 font-medium shadow-sm dark:from-zinc-300 dark:to-zinc-500' : 'text-foreground hover:bg-black/5 dark:hover:bg-white/10'}`}
                                    >
                                        {type}
                                    </button>
                                ))}

                                {tempDateType === 'Custom Range' && (
                                    <div className="flex flex-col gap-2 mt-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg">
                                        <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                                            Start date
                                            <input type="date" className="text-sm p-1.5 rounded-md border bg-background text-foreground" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                                        </label>
                                        <label className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
                                            End date
                                            <input type="date" className="text-sm p-1.5 rounded-md border bg-background text-foreground" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                                        </label>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                                    <button onClick={applyDateFilter} className="flex-1 px-4 py-1.5 text-sm bg-gradient-to-b from-zinc-700 to-zinc-900 hover:from-zinc-600 hover:to-zinc-800 text-white rounded-lg font-medium shadow-sm dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-900 dark:hover:from-zinc-100 dark:hover:to-zinc-300">Apply</button>
                                    <button onClick={() => setPopoverOpen(false)} className="flex-1 px-4 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">Cancel</button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="relative mt-6">
                    {loading && !stats ? <Skeleton className="h-32 w-full" /> : (
                        <VolumeChart
                            points={stats?.graphData?.length ? stats.graphData : new Array(12).fill(0)}
                            start={new Date(stats?.graphRange?.start || `${range.start}T00:00:00+05:30`)}
                            end={new Date(stats?.graphRange?.end || `${range.end}T23:59:59.999+05:30`)}
                        />
                    )}
                </div>
            </section>

            {/* Stat cards: rows of 4 / 4 (volume and customers live in the hero) */}
            {(() => {
                const service = (title: string, key: string, icon: typeof Banknote, accent: keyof typeof ACCENTS) => {
                    const value = Number(stats?.[key]) || 0;
                    return { title, icon, accent, value: inr.format(value), share: volume > 0 ? Math.round((value / volume) * 100) : 0 };
                };
                const plain = (title: string, value: string, hint: string, icon: typeof Banknote, accent: keyof typeof ACCENTS) =>
                    ({ title, icon, accent, value, hint });
                const rows = [
                    [
                        service('Total Success DMT', 'DMT', Banknote, 'silver'),
                        service('Total Success Recharge', 'RECHARGE', Smartphone, 'sky'),
                        service('Total Success AEPS', 'AEPS_WITHDRAWAL', Fingerprint, 'emerald'),
                        service('Total Success Payout', 'AEPS_SETTLEMENT', Building2, 'amber'),
                    ],
                    [
                        service('Total Success BBPS', 'BILL_PAYMENT', Receipt, 'rose'),
                        service('Total Success UPI', 'WALLET_TOPUP', Wallet, 'cyan'),
                        plain('Total Earnings', inr.format(Number(stats?.TotalCommission) || 0), 'Credited to wallet, after TDS', IndianRupee, 'emerald'),
                        plain('Total Commission', inr.format(Number(stats?.TotalGrossCommission) || 0), 'Gross, before TDS', IndianRupee, 'amber'),
                    ],
                ];
                return rows.map((row, r) => (
                    <section key={r} className={`grid gap-4 sm:grid-cols-2 ${row.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                        {row.map((card) => {
                            const a = ACCENTS[card.accent];
                            const Icon = card.icon;
                            return (
                                <div key={card.title} className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                                    <div aria-hidden className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-100 ${a.glow}`} />
                                    <div className="relative flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                                        <div className={`rounded-xl p-2.5 ring-1 ${a.tile}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                    {loading ? <Skeleton className="relative mt-3 h-8 w-36" /> : (
                                        <p className="relative mt-3 text-2xl font-bold tracking-tight tabular-nums">{card.value}</p>
                                    )}
                                    {'share' in card ? (
                                        <div className="relative mt-4">
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                                <div className={`h-full rounded-full transition-[width] duration-700 ${a.bar}`} style={{ width: `${loading ? 0 : card.share}%` }} />
                                            </div>
                                            <p className="mt-1.5 text-xs text-muted-foreground">{loading ? '\u00a0' : `${card.share}% of total volume`}</p>
                                        </div>
                                    ) : (
                                        <p className="relative mt-4 text-xs text-muted-foreground">{card.hint}</p>
                                    )}
                                </div>
                            );
                        })}
                    </section>
                ));
            })()}

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Quick actions */}
                <section className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Quick actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {QUICK_ACTIONS.filter((a) => isServiceEnabled(user, a.service)).map(({ title, hint, url, icon: Icon, accent }) => (
                            <button
                                key={url}
                                onClick={() => navigate(url)}
                                className="group relative flex flex-col items-start gap-3 rounded-xl border bg-background/50 p-4 text-left hover:border-foreground/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] active:scale-[0.98]"
                            >
                                <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                <div className={`rounded-xl p-2.5 ring-1 ${ACCENTS[accent].tile}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{title}</p>
                                    <p className="text-xs text-muted-foreground">{hint}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Recent activity */}
                <section className="lg:col-span-3 rounded-2xl border bg-card p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Recent activity</h3>
                    {loading ? (
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                        </div>
                    ) : recentSales.length > 0 ? (
                        <ul className="divide-y divide-border">
                            {recentSales.map((sale, i) => {
                                const Icon = SALE_ICON[sale.service] || Receipt;
                                return (
                                    <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-foreground/80">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold">{sale.service || sale.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{sale.name} · {sale.details || sale.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold tabular-nums">{sale.amount}</p>
                                            <div className="mt-1 flex items-center justify-end gap-2">
                                                {sale.date && (
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {new Date(sale.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                    </span>
                                                )}
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_PILL[sale.status] || PENDING_PILL}`}>
                                                    {sale.status}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                            <Inbox className="h-8 w-8 mb-2 opacity-60" />
                            <p className="text-sm">No activity in this period</p>
                        </div>
                    )}
                </section>
            </div>

            {/* Bank 3 Aeps / Biometric KYC Modal */}
            {showMerchantKycModal && (
                <MerchantKycModal onClose={() => setShowMerchantKycModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;
