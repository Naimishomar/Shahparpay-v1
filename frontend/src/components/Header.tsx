import axios from "axios";
import { User, Wallet, Sun, Moon, ChevronDown, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NotificationCenter from './NotificationCenter';
import LanguageSelector, { TranslateHost } from './LanguageSelector';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const formatBalance = (value: unknown) => {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
};

// Full class strings: Tailwind only ships classes it can find literally.
const WALLET_TILES = {
    silver: 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
};

const Header = () => {
    const { theme, setTheme } = useTheme();
    const { user, token } = useAuth();
    const [balances, setBalances] = useState({ aepsBalance: 0, mainBalance: 0, qrBalance: 0, adminBalance: 0 });

    useEffect(() => {
        const fetchBalances = async () => {
            try {
                if (user && token) {
                    const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/balance?_t=${Date.now()}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.data.success) {
                        setBalances(res.data.data);
                    }
                }
            } catch (error) {
                console.error("Error fetching balances:", error);
            }
        };
        fetchBalances();
        
        // Listen to custom event for balance updates
        const handleBalanceUpdate = () => fetchBalances();
        window.addEventListener('wallet-updated', handleBalanceUpdate);
        
        return () => {
            window.removeEventListener('wallet-updated', handleBalanceUpdate);
        };
    }, [user, token]);

    const profileUrl = user?.role === 'admin' ? "/admin/profile" : user?.role === 'distributor' ? "/distributor/profile" : "/profile";
    const wallets = user?.role === 'admin'
        ? [{ label: 'Admin Wallet', value: balances.adminBalance, tile: WALLET_TILES.silver }]
        : [
            { label: 'AEPS Wallet', value: balances.aepsBalance, tile: WALLET_TILES.silver },
            { label: 'QR Wallet', value: balances.qrBalance, tile: WALLET_TILES.cyan },
            { label: 'Main Wallet', value: balances.mainBalance, tile: WALLET_TILES.emerald },
        ];

    const avatar = (size: string) => (
        <div className={`${size} shrink-0 rounded-full bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-600 p-[2px] shadow-sm`}>
            <div className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden">
                {user?.profilePicture ? (
                    <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <User className="w-5 h-5 text-foreground" />
                )}
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-3 w-full justify-end">
            <TranslateHost />

            {/* Wallet Balances */}
            {user && (
                <div className="hidden lg:flex items-center mr-auto ml-2 rounded-2xl border bg-card/70 backdrop-blur p-1.5 shadow-sm">
                    {wallets.map((w, i) => (
                        <div key={w.label} className="flex items-center">
                            {i > 0 && <div className="mx-1 h-8 w-px bg-border" />}
                            <div className="flex items-center gap-3 rounded-xl px-3 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                <div className={`rounded-xl p-2 ring-1 ${w.tile}`}>
                                    <Wallet className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{w.label}</p>
                                    <p className="text-sm font-bold text-foreground tabular-nums">₹ {formatBalance(w.value)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {user && <NotificationCenter />}

            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border bg-card/70 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
                <Sun className="h-5 w-5 text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute" />
                <Moon className="h-5 w-5 text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </button>

            {/* User Profile */}
            <Popover>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-3 rounded-full border bg-card/70 py-1 pl-1 pr-3 shadow-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        {avatar('w-9 h-9')}
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-semibold text-foreground leading-none">{user?.name || "Admin User"}</p>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">{user?.role || "Superadmin"} Portal</p>
                        </div>
                        <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2 rounded-2xl bg-popover border-border shadow-xl">
                    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 p-3">
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
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default Header;
