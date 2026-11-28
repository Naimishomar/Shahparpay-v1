import axios from "axios";
import { User, Wallet, Zap, Sun, Moon, ChevronDown, UserCircle, LogOut, Eye, EyeOff, Plus, Search, Headset, BanknoteArrowUp } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import NotificationCenter from './NotificationCenter';
import LanguageSelector, { TranslateHost } from './LanguageSelector';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/animate-ui/components/radix/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/animate-ui/components/radix/hover-card';
import { ThemeToggler } from '@/components/animate-ui/primitives/effects/theme-toggler';
import { navLinksFor } from './app-sidebar';
import { isServiceEnabled, AEPS_STEP_LABELS } from '../lib/services';
import TransactionDetailModal from './TransactionDetailModal';
import Counter from './Counter';
import { ARRIVE } from './landing/beats';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { txnRef } from "@/lib/txnRef";

const API = import.meta.env.VITE_BACKEND_URL;
const SUPPORT_PHONE = '+91 8240039776';

const formatBalance = (value: unknown) => {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
};

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Full class strings: Tailwind only ships classes it can find literally.
const TONES = {
    trade: { tile: 'tint-lavender', icon: 'bg-white/70 text-[#16142E] dark:bg-white/10 dark:text-white', cap: 'text-[#16142E]/70 dark:text-white/70', link: 'text-[#16142E] dark:text-white' },
    utility: { tile: 'tint-lime', icon: 'bg-white/70 text-[#16142E] dark:bg-white/10 dark:text-white', cap: 'text-[#16142E]/70 dark:text-white/70', link: 'text-[#16142E] dark:text-white' },
};

/** The navy line on top: AEPS login and last settlement for a retailer, support for everyone. */
const StatusStrip = () => {
    const { user, token } = useAuth();
    const isRetailer = user?.role === 'retailer';
    const [aepsStep, setAepsStep] = useState<string | null>(null);
    const [lastSettlement, setLastSettlement] = useState<{ amount: number; at: string } | null>(null);

    useEffect(() => {
        if (!isRetailer || !token) return;
        const headers = { headers: { Authorization: `Bearer ${token}` } };
        if (isServiceEnabled(user, 'aeps')) {
            axios.get(`${API}/api/aeps/icchhamati/status`, headers)
                .then((res) => res.data?.success && setAepsStep(res.data.data?.step || null))
                .catch(() => { /* the strip just leaves AEPS out */ });
        }
        axios.get(`${API}/api/settlement/history`, headers)
            .then((res) => {
                const done = (res.data?.data || []).find((t: any) => t.status === 'SUCCESS');
                if (done) setLastSettlement({ amount: Number(done.amount) || 0, at: done.createdAt });
            })
            .catch(() => { /* no settlement shown */ });
    }, [isRetailer, token, user]);

    const aeps = aepsStep === 'ready'
        ? { dot: 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.25)]', text: <>AEPS daily login <b className="font-semibold text-white">done</b></> }
        : aepsStep === 'twofa'
            ? { dot: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,.25)]', text: <>AEPS daily login <b className="font-semibold text-white">pending</b> · <Link to="/aeps" className="text-white underline underline-offset-2">Login now</Link></> }
            : aepsStep
                ? { dot: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,.25)]', text: <>AEPS: <b className="font-semibold text-white">{AEPS_STEP_LABELS[aepsStep] || 'onboarding pending'}</b> · <Link to="/aeps" className="text-white underline underline-offset-2">Continue</Link></> }
                : null;

    return (
        <div className="support-strip flex flex-wrap items-center gap-x-5 gap-y-1 bg-gradient-to-r from-[#16142E] to-[#2A2556] dark:from-[#141415] dark:to-[#1C1C1E] px-4 py-1.5 text-xs text-white/70 md:px-5">
            {aeps && <span className="flex shrink-0 items-center gap-2 whitespace-nowrap"><i className={`h-1.5 w-1.5 rounded-full ${aeps.dot}`} />{aeps.text}</span>}
            {lastSettlement && (
                <span className="shrink-0 whitespace-nowrap">
                    Last settlement <b className="font-semibold text-white">₹{formatBalance(lastSettlement.amount)}</b> at {new Date(lastSettlement.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </span>
            )}
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap hover:text-white">
                <Headset className="h-3.5 w-3.5" /> Contact support: <b className="font-semibold text-white">{SUPPORT_PHONE}</b>
            </a>
        </div>
    );
};

/**
 * The change a wallet just took, said once over its balance: "+₹2,008.00" rises
 * in, holds, and leaves. Never on the first load, and never while balances are hidden.
 */
const WalletDelta = ({ value, ready, hidden }: { value: number; ready: boolean; hidden: boolean }) => {
    const prev = useRef<number | null>(null);
    const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
    useEffect(() => {
        if (!ready) return;
        const before = prev.current;
        prev.current = value;
        if (before === null || hidden) return;
        const amount = Math.round((value - before) * 100) / 100;
        if (!amount) return;
        setDelta({ id: Date.now(), amount });
    }, [value, ready, hidden]);
    // Its own timer, so hiding balances mid-way cannot leave it stuck on screen.
    useEffect(() => {
        if (!delta) return;
        const t = setTimeout(() => setDelta(null), 2600);
        return () => clearTimeout(t);
    }, [delta]);
    return (
        <AnimatePresence>
            {delta && !hidden && (
                <motion.span
                    key={delta.id}
                    role="status"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.45, ease: ARRIVE }}
                    className={`pointer-events-none absolute -top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm ring-1 ${delta.amount > 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-background text-foreground ring-border'}`}
                >
                    {delta.amount > 0 ? '+' : '−'}₹{formatBalance(Math.abs(delta.amount))}
                </motion.span>
            )}
        </AnimatePresence>
    );
};

const TXN_STATUS: Record<string, string> = {
    SUCCESS: 'text-emerald-600 dark:text-emerald-400',
    FAILED: 'text-rose-600 dark:text-rose-400',
    REFUNDED: 'text-sky-600 dark:text-sky-400',
};

/**
 * Jumps to any page in the sidebar, and finds a transaction by its ID, UTR,
 * RRN, mobile or customer name across the whole history; ⌘K / Ctrl+K focuses it.
 */
const HeaderSearch = () => {
    const { user, token } = useAuth();
    const [txns, setTxns] = useState<any[]>([]);
    const [finding, setFinding] = useState(false);
    // The term the last finished search was for; while typing it differs, so nothing stale shows.
    const [searched, setSearched] = useState('');
    const [selected, setSelected] = useState<any>(null);
    const navigate = useNavigate();
    const input = useRef<HTMLInputElement>(null);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const links = useMemo(() => navLinksFor(user), [user]);
    const term = q.trim();
    const matches = term ? links.filter((l) => l.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6) : links.slice(0, 8);

    // Transactions are asked for after 1 s without typing; 4 characters keeps a
    // single letter from scanning the whole history.
    useEffect(() => {
        setTxns([]);
        if (term.length < 4 || !token) { setFinding(false); return; }
        const timer = setTimeout(() => {
            setFinding(true);
            const params = new URLSearchParams({ page: '1', limit: '5', search: term });
            axios.get(`${API}/api/dashboard/recent-transactions?${params}`, { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setTxns(res.data?.success ? res.data.data || [] : []))
                .catch(() => setTxns([]))
                .finally(() => { setFinding(false); setSearched(term); });
        }, 1000);
        return () => clearTimeout(timer);
    }, [term, token]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const go = (url: string) => { navigate(url); setQ(''); setOpen(false); input.current?.blur(); };
    const openTxn = (tx: any) => { setSelected(tx); setOpen(false); input.current?.blur(); };
    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

    return (
        <div className="relative w-full min-w-[200px]">
            <div className="flex h-10 items-center gap-2.5 rounded-xl border border-transparent bg-black/[0.04] px-3 text-sm text-muted-foreground transition focus-within:border-border focus-within:bg-background hover:border-border dark:bg-white/[0.06]">
                <Search className="h-4 w-4 shrink-0" />
                <input
                    ref={input}
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { if (txns[0]) openTxn(txns[0]); else if (matches[0]) go(matches[0].url); }
                        if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
                    }}
                    placeholder="Search pages, or a transaction ID, UTR, mobile…"
                    className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                    aria-label="Search pages and transactions"
                />
                <kbd className="hidden lg:inline rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </div>
            {open && (matches.length > 0 || (term.length >= 4 && (finding || searched === term))) && (
                <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">
                    {term.length >= 4 && (finding || searched === term) && (
                        <>
                            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transactions</p>
                            {finding ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                            ) : txns.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">No transaction matches “{term}”.</p>
                            ) : txns.map((tx) => (
                                <button key={tx._id || tx.transactionId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openTxn(tx)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-mono text-xs text-foreground">{txnRef(tx)}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {String(tx.type || '').replace(/_/g, ' ')} · {new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold tabular-nums text-foreground">₹{formatBalance(tx.amount)}</p>
                                        <p className={`text-[11px] font-semibold ${TXN_STATUS[tx.status] || 'text-amber-600 dark:text-amber-400'}`}>{tx.status}</p>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                    {matches.length > 0 && (
                        <>
                            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pages</p>
                            {matches.map((l) => (
                                <button key={l.url} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(l.url)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5">
                                    {l.name}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
            {/* The header's backdrop-blur would trap a fixed modal inside it, so it renders on <body>. */}
            {createPortal(<TransactionDetailModal tx={selected} onClose={() => setSelected(null)} />, document.body)}
        </div>
    );
};

const Header = ({ trigger }: { trigger?: React.ReactNode }) => {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const reduceMotion = useReducedMotion();
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [balances, setBalances] = useState({ aepsBalance: 0, mainBalance: 0, adminBalance: 0 });
    const [balancesReady, setBalancesReady] = useState(false);
    // Kept across reloads: a retailer hides the money once for the counter.
    const [hidden, setHidden] = useState(() => localStorage.getItem('hideBalances') === '1');
    const toggleHidden = () => setHidden((h) => { localStorage.setItem('hideBalances', h ? '0' : '1'); return !h; });

    useEffect(() => {
        const fetchBalances = async () => {
            try {
                if (user && token) {
                    const res = await axios.get(`${API}/api/wallet/balance?_t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) { setBalances(res.data.data); setBalancesReady(true); }
                }
            } catch (error) {
                console.error("Error fetching balances:", error);
            }
        };
        fetchBalances();
        const handleBalanceUpdate = () => fetchBalances();
        window.addEventListener('wallet-updated', handleBalanceUpdate);
        return () => window.removeEventListener('wallet-updated', handleBalanceUpdate);
    }, [user, token]);

    const isRetailer = user?.role === 'retailer';
    const profileUrl = user?.role === 'admin' ? "/admin/profile" : user?.role === 'distributor' ? "/distributor/profile" : "/profile";
    const wallets = user?.role === 'admin'
        ? [{ label: 'Admin Wallet', value: balances.adminBalance, tone: TONES.trade, Icon: Wallet, link: null, note: '' }]
        : [
            { label: 'Trade Wallet', value: balances.aepsBalance, tone: TONES.trade, Icon: Wallet, link: isRetailer ? { to: '/aeps-settlement', text: 'Withdraw to bank', icon: BanknoteArrowUp } : null, note: 'Money from AEPS, mATM and UPI cash withdrawals, with their commission. Withdraw it to your bank account.' },
            { label: 'Utility Wallet', value: balances.mainBalance, tone: TONES.utility, Icon: Zap, link: isRetailer ? { to: '/fund-request', text: 'Add money', icon: Plus } : null, note: 'Pays for DMT, recharges, bill payments and PAN. Top it up with a fund request.' },
        ];
    const firstName = String(user?.name || '').split(' ')[0];
    // A retailer's distributorId is their parent (an object once populated), so only a distributor's own counts.
    const userCode = user?.role === 'retailer' ? user.retailerId
        : user?.role === 'distributor' ? (typeof user.distributorId === 'string' ? user.distributorId : '')
        : user?.adminId;

    const avatar = (size: string) => (
        <div className={`avatar-ring ${size} shrink-0 rounded-full bg-gradient-to-br from-[#F47920] to-[#12A65A] p-[2px] shadow-sm`}>
            <div className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden">
                {user?.profilePicture ? <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-foreground" />}
            </div>
        </div>
    );

    return (
        <div className="w-full">
            <TranslateHost />
            {user?.role !== 'admin' && <StatusStrip />}

            {/*
              One line on a laptop (xl+): wallets, eye, search, then the
              icons and profile. Narrower screens wrap with `order`: greeting and
              icons first, then the wallets, then a full-width search.
            */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 md:gap-3 md:px-5 xl:flex-nowrap">
                <div className="order-1 shrink-0">{trigger}</div>
                {user && (
                    <div className="order-2 min-w-0 flex-1 xl:hidden">
                        <p className="truncate text-base font-semibold text-foreground leading-tight">{greeting()}{firstName ? `, ${firstName}` : ''}</p>
                        <p className="truncate text-xs text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                )}

                {user && (
                    <div className="order-4 flex w-full flex-wrap items-center gap-2 md:gap-3 xl:order-2 xl:w-auto xl:flex-nowrap">
                        {wallets.map(({ label, value, tone, Icon, link, note }) => (
                            <div key={label} className={`relative flex min-w-[150px] flex-1 items-center gap-2.5 rounded-2xl py-1.5 pl-3 pr-1.5 md:flex-none 2xl:gap-3 2xl:py-2 2xl:pl-2 2xl:pr-2.5 ${tone.tile}`}>
                                <WalletDelta value={Number(value) || 0} ready={balancesReady} hidden={hidden} />
                                <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-xl 2xl:grid ${tone.icon}`}><Icon className="h-4 w-4" /></span>
                                {/* animate-ui HoverCard: what the wallet is for, on hover or focus. No amounts in it. */}
                                <HoverCard openDelay={350} closeDelay={120}>
                                <HoverCardTrigger asChild>
                                <div tabIndex={note ? 0 : undefined} className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 md:flex-none">
                                    <p className={`truncate text-[10.5px] font-semibold uppercase tracking-wider ${tone.cap}`}>{label}</p>
                                    <p className={`whitespace-nowrap text-[15px] font-bold text-foreground tabular-nums leading-tight transition 2xl:text-[17px] ${hidden ? 'blur-[7px] select-none' : ''}`}>₹ <Counter value={Number(value) || 0} locale="en-IN" decimals={2} fontSize="1em" /></p>
                                </div>
                                </HoverCardTrigger>
                                {note && (
                                    <HoverCardContent align="start" sideOffset={10} className="w-72 rounded-2xl">
                                        <p className="text-sm font-semibold text-foreground">{label}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
                                        {link && (
                                            <Link to={link.to} className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${tone.link}`}>
                                                <link.icon className="h-3.5 w-3.5" strokeWidth={2.5} /> {link.text}
                                            </Link>
                                        )}
                                    </HoverCardContent>
                                )}
                                </HoverCard>
                                {link && (
                                    <Link to={link.to} title={link.text} aria-label={link.text} className={`ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background shadow-sm hover:opacity-90 ${tone.link}`}>
                                        <link.icon className="h-4 w-4" strokeWidth={2.5} />
                                    </Link>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={toggleHidden}
                            title={hidden ? 'Show balances' : 'Hide balances'}
                            aria-label={hidden ? 'Show balances' : 'Hide balances'}
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-card/70 text-muted-foreground hover:text-foreground"
                        >
                            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                )}

                {user && <div className="order-5 w-full xl:order-3 xl:w-72 xl:shrink 2xl:w-96"><HeaderSearch /></div>}

                <div className="order-3 flex shrink-0 items-center gap-2 md:gap-3 xl:order-4 xl:ml-auto">
                {user && <NotificationCenter />}

                {/* animate-ui ThemeToggler: the new theme wipes across the page (view transition).
                    Reduced motion switches instantly; without view transitions it falls back to an instant switch itself. */}
                <ThemeToggler
                    theme={(theme as 'light' | 'dark' | 'system') || 'system'}
                    resolvedTheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                    setTheme={setTheme}
                    direction="ltr"
                >
                    {({ toggleTheme }) => {
                        const next = resolvedTheme === 'dark' ? 'light' : 'dark';
                        return (
                            <button
                                type="button"
                                onClick={() => (reduceMotion ? setTheme(next) : toggleTheme(next))}
                                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card/70 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            >
                                <Sun className="h-5 w-5 text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute" />
                                <Moon className="h-5 w-5 text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">Toggle theme</span>
                            </button>
                        );
                    }}
                </ThemeToggler>

                {/* animate-ui DropdownMenu: arrow keys, typeahead, and a highlight that slides between items. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex shrink-0 items-center gap-3 rounded-full border bg-card/70 py-1 pl-1 pr-3 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            {avatar('w-9 h-9')}
                            <div className="hidden md:block max-w-[170px] text-left">
                                <p className="truncate text-sm font-semibold text-foreground leading-none">{user?.name || "Admin User"}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {userCode ? <>ID <span className="font-mono font-semibold text-foreground/80">{userCode}</span></> : <span className="capitalize">{user?.role || "Superadmin"} Portal</span>}
                                </p>
                            </div>
                            <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2 rounded-2xl bg-popover border-border shadow-xl">
                        <DropdownMenuLabel className="flex items-center gap-3 rounded-xl icon-chip p-3 font-normal">
                            {avatar('w-11 h-11')}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{user?.name || "Admin User"}</p>
                                {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                                <p className="text-[11px] text-muted-foreground"><span className="capitalize">{user?.role || "Superadmin"} Portal</span>{userCode ? ` · ${userCode}` : ''}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem onSelect={() => navigate(profileUrl)} className="gap-3 rounded-xl px-3 py-2.5 font-medium">
                            <UserCircle className="w-4 h-4 text-muted-foreground" /> My profile
                        </DropdownMenuItem>
                        {user && <LanguageSelector />}
                        {user && (
                            // Logout asks where from in a submenu, instead of an inline confirm.
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="gap-3 rounded-xl px-3 py-2.5 font-medium text-red-500 data-[state=open]:text-red-500 focus:text-red-500">
                                    <LogOut className="w-4 h-4 text-red-500" /> Logout
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="rounded-xl">
                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Log out from</DropdownMenuLabel>
                                    <DropdownMenuItem variant="destructive" onSelect={() => logout(false)}><LogOut /> This device</DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onSelect={() => logout(true)}><LogOut /> All devices</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </div>
        </div>
    );
};

export default Header;
