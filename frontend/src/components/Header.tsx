import axios from "axios";
import { User, Wallet, Sun, Moon, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NotificationCenter from './NotificationCenter';
import LanguageSelector from './LanguageSelector';

const formatBalance = (value: unknown) => {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
};

const Header = () => {
    const { theme, setTheme } = useTheme();
    const { user, token } = useAuth();
    const [balances, setBalances] = useState({ aepsBalance: 0, mainBalance: 0, adminBalance: 0 });

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

    return (
        <div className="flex items-center gap-2 sm:gap-3 w-full justify-end">
            {/* Wallet Balances */}
            {user && (
                <div className="hidden xl:flex items-center gap-3 mr-auto">
                    {user.role === 'admin' ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                            <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20">
                                <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Admin Wallet</p>
                                <p className="text-sm font-bold text-foreground">₹ {formatBalance(balances.adminBalance)}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">AEPS Wallet</p>
                                    <p className="text-sm font-bold text-foreground">₹ {formatBalance(balances.aepsBalance)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Main Wallet</p>
                                    <p className="text-sm font-bold text-foreground">₹ {formatBalance(balances.mainBalance)}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {user && <NotificationCenter />}
            {user && <LanguageSelector />}

            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Secure portal
            </div>

            {/* Theme Toggle */}
            <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="relative h-10 w-10 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
                <Sun className="h-5 w-5 text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <Moon className="h-5 w-5 text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </button>

            {/* User Profile */}
            <Link to={user?.role === 'admin' ? "/admin/profile" : user?.role === 'distributor' ? "/distributor/profile" : "/profile"} className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-transparent px-1.5 py-1 transition-colors hover:border-slate-200 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/5 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-400 p-[2px] shadow-[0_0_10px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_15px_rgba(139,92,246,0.6)] transition-shadow">
                    <div className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden">
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-5 h-5 text-foreground" />
                        )}
                    </div>
                </div>
                <div className="hidden md:block">
                    <p className="text-sm font-medium text-foreground leading-none">{user?.name || "Admin User"}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{user?.role || "Superadmin"} Portal</p>
                </div>
            </Link>
        </div>
    );
};

export default Header;
