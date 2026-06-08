import { Bell, Search, User, Wallet, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const Header = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center gap-6 w-full justify-end">
            {/* Wallet Balances */}
            <div className="hidden lg:flex items-center gap-6 mr-auto pl-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                        <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">AEPS Wallet</p>
                        <p className="text-sm font-bold text-foreground">₹ 79.77</p>
                    </div>
                </div>
                <div className="w-px h-8 bg-black/10 dark:bg-white/10"></div>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Main Wallet</p>
                        <p className="text-sm font-bold text-foreground">₹ 1,036.03</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative hidden md:flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-64 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground backdrop-blur-md"
                />
            </div>

            {/* Theme Toggle */}
            <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="relative p-2 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
                <Sun className="h-5 w-5 text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <Moon className="h-5 w-5 text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <Bell className="w-5 h-5 text-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-400 p-[2px] shadow-[0_0_10px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_15px_rgba(139,92,246,0.6)] transition-shadow">
                    <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-foreground" />
                    </div>
                </div>
                <div className="hidden md:block">
                    <p className="text-sm font-medium text-foreground leading-none">Admin User</p>
                    <p className="text-xs text-muted-foreground mt-1">Superadmin</p>
                </div>
            </div>
        </div>
    );
};

export default Header;