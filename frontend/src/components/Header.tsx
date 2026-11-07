import axios from "axios";
import { User, Wallet, Zap, Sun, Moon, ChevronDown, UserCircle, LogOut, Eye, EyeOff, Plus, Search, Headset } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import NotificationCenter from './NotificationCenter';
import LanguageSelector, { TranslateHost } from './LanguageSelector';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { navLinksFor } from './app-sidebar';
import { isServiceEnabled, AEPS_STEP_LABELS } from '../lib/services';
import TransactionDetailModal from './TransactionDetailModal';

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
    trade: { tile: 'bg-violet-500/10', icon: 'bg-background text-violet-600 dark:text-violet-400', cap: 'text-violet-700 dark:text-violet-400', link: 'text-violet-700 dark:text-violet-300' },
    utility: { tile: 'bg-emerald-500/10', icon: 'bg-background text-emerald-600 dark:text-emerald-400', cap: 'text-emerald-700 dark:text-emerald-400', link: 'text-emerald-700 dark:text-emerald-300' },
};

/** The purple line on top: AEPS login and last settlement for a retailer, support for everyone. */
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-gradient-to-r from-violet-900 to-indigo-700 px-4 py-1.5 text-xs text-violet-200 md:px-5">
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
    const [selected, setSelected] = useState<any>(null);
    const navigate = useNavigate();
    const input = useRef<HTMLInputElement>(null);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const links = useMemo(() => navLinksFor(user), [user]);
    const term = q.trim();
    const matches = term ? links.filter((l) => l.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6) : links.slice(0, 8);

    // Transactions are asked for once the user stops typing; 4 characters keeps a
    // single letter from scanning the whole history.
    useEffect(() => {
        if (term.length < 4 || !token) { setTxns([]); setFinding(false); return; }
        setFinding(true);
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ page: '1', limit: '5', search: term });
            axios.get(`${API}/api/dashboard/recent-transactions?${params}`, { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => setTxns(res.data?.success ? res.data.data || [] : []))
                .catch(() => setTxns([]))
                .finally(() => setFinding(false));
        }, 350);
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
        <div className="relative w-full md:w-auto md:min-w-[220px] md:flex-1">
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
            {open && (matches.length > 0 || term.length >= 4) && (
                <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">
                    {term.length >= 4 && (
                        <>
                            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transactions</p>
                            {finding ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                            ) : txns.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">No transaction matches “{term}”.</p>
                            ) : txns.map((tx) => (
                                <button key={tx._id || tx.transactionId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openTxn(tx)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-mono text-xs text-foreground">{tx.transactionId}</p>
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
    const { theme, setTheme } = useTheme();
    const { user, token, logout } = useAuth();
    const [askLogout, setAskLogout] = useState(false);
    const [balances, setBalances] = useState({ aepsBalance: 0, mainBalance: 0, adminBalance: 0 });
    // Kept across reloads: a retailer hides the money once for the counter.
    const [hidden, setHidden] = useState(() => localStorage.getItem('hideBalances') === '1');
    const toggleHidden = () => setHidden((h) => { localStorage.setItem('hideBalances', h ? '0' : '1'); return !h; });

    useEffect(() => {
        const fetchBalances = async () => {
            try {
                if (user && token) {
                    const res = await axios.get(`${API}/api/wallet/balance?_t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) setBalances(res.data.data);
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
        ? [{ label: 'Admin Wallet', value: balances.adminBalance, tone: TONES.trade, Icon: Wallet, link: null }]
        : [
            { label: 'Trade Wallet', value: balances.aepsBalance, tone: TONES.trade, Icon: Wallet, link: isRetailer ? { to: '/aeps-settlement', text: 'Settle' } : null },
            { label: 'Utility Wallet', value: balances.mainBalance, tone: TONES.utility, Icon: Zap, link: isRetailer ? { to: '/reports/wallet-ledger', text: 'History' } : null },
        ];
    const firstName = String(user?.name || '').split(' ')[0];

    const avatar = (size: string) => (
        <div className={`${size} shrink-0 rounded-full bg-gradient-to-br from-[#F47920] to-[#12A65A] p-[2px] shadow-sm`}>
            <div className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden">
                {user?.profilePicture ? <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-foreground" />}
            </div>
        </div>
    );

    return (
        <div className="w-full">
            <TranslateHost />
            <StatusStrip />

            {/* Row 1: greeting, notifications, theme, profile */}
            <div className="flex items-center gap-3 px-5 pt-3 pb-2.5">
                {trigger}
                {user && (
                    <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground leading-tight">{greeting()}{firstName ? `, ${firstName}` : ''}</p>
                        <p className="truncate text-xs text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                )}
                <div className="flex-1" />

                {user && <NotificationCenter />}

                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card/70 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <Sun className="h-5 w-5 text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute" />
                    <Moon className="h-5 w-5 text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </button>

                <Popover onOpenChange={(open) => { if (!open) setAskLogout(false); }}>
                    <PopoverTrigger asChild>
                        <button className="flex shrink-0 items-center gap-3 rounded-full border bg-card/70 py-1 pl-1 pr-3 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            {avatar('w-9 h-9')}
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-semibold text-foreground leading-none">{user?.name || "Admin User"}</p>
                                <p className="text-xs text-muted-foreground mt-1 capitalize">{user?.role || "Superadmin"} Portal</p>
                            </div>
                            <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-2 rounded-2xl bg-popover border-border shadow-xl">
                        <div className="flex items-center gap-3 rounded-xl icon-chip p-3">
                            {avatar('w-11 h-11')}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{user?.name || "Admin User"}</p>
                                {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
                                <p className="text-[11px] text-muted-foreground capitalize">{user?.role || "Superadmin"} Portal</p>
                            </div>
                        </div>
                        <div className="mt-2 space-y-0.5">
                            <Link to={profileUrl} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5">
                                <UserCircle className="w-4 h-4 text-muted-foreground" /> My profile
                            </Link>
                            {user && <LanguageSelector />}
                            {user && !askLogout && (
                                <button onClick={() => setAskLogout(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10">
                                    <LogOut className="w-4 h-4" /> Logout
                                </button>
                            )}
                            {user && askLogout && (
                                <div className="rounded-xl border border-red-500/20 p-2">
                                    <p className="px-1 pb-2 text-xs text-muted-foreground">Log out from</p>
                                    <button onClick={() => logout(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10">
                                        <LogOut className="w-4 h-4" /> This device
                                    </button>
                                    <button onClick={() => logout(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10">
                                        <LogOut className="w-4 h-4" /> All devices
                                    </button>
                                    <button onClick={() => setAskLogout(false)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5">
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Row 2: every wallet balance at once, the eye, Add money, search */}
            {user && (
                // Wraps on a narrow screen: wallets two to a line, then the buttons, then a full-width search.
                <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:gap-3 md:px-5">
                    {wallets.map(({ label, value, tone, Icon, link }) => (
                        <div key={label} className={`flex min-w-[150px] flex-1 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-2.5 md:flex-none md:gap-3 md:pr-3 ${tone.tile}`}>
                            <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone.icon}`}><Icon className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1 md:flex-none">
                                <p className={`truncate text-[11px] font-semibold uppercase tracking-wider ${tone.cap}`}>{label}</p>
                                <p className={`text-[15px] md:text-[17px] font-bold text-foreground tabular-nums leading-tight transition ${hidden ? 'blur-[7px] select-none' : ''}`}>₹ {formatBalance(value)}</p>
                            </div>
                            {link && <Link to={link.to} className={`ml-1 rounded-lg bg-background px-2.5 py-1 text-xs font-semibold shadow-sm ${tone.link}`}>{link.text}</Link>}
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
                    {isRetailer && (
                        <Link to="/fund-request" className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 hover:opacity-95">
                            <Plus className="h-4 w-4" /> Add money
                        </Link>
                    )}
                    <HeaderSearch />
                </div>
            )}
        </div>
    );
};

export default Header;
