import { Banknote, Smartphone, Fingerprint, Building2, Receipt, Wallet, IndianRupee, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const Dashboard = () => {
    const topStats = [
        { title: "Total Success DMT", value: "₹ 1300.00", icon: Banknote },
        { title: "Total Success Recharge", value: "₹ 1230.00", icon: Smartphone },
        { title: "Total Success AEPS", value: "₹ 1360.00", icon: Fingerprint },
        { title: "Total Success Payout", value: "₹ 11000.00", icon: Building2 },
    ];

    const bottomStats = [
        { title: "Total Success BBPS", value: "₹ 1500.00", icon: Receipt },
        { title: "Total Success UPI", value: "₹ 1700.00", icon: Wallet },
        { title: "Total Earnings", value: "₹ 100.00", icon: IndianRupee },
    ];

    const bottomStats2 = [
        { title: "Total Customer", value: "1500 Customer", icon: Users },
        { title: "Total Transactions", value: "₹ 1700", icon: Wallet },
        { title: "Total Commission", value: "₹ 1000", icon: IndianRupee },
    ];

    const renderCard = (stat: any, index: number) => {
        const Icon = stat.icon;
        return (
            <div key={index} className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <div className="flex items-center justify-between relative z-10">
                    <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
                        {stat.title}
                    </h3>
                    <div className="p-2 bg-primary/10 rounded-full text-primary shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2 relative z-10">
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Date Picker Bar */}
            <div className="flex items-center justify-end bg-white dark:bg-white/5 p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/10 gap-3">
                <span className="text-sm font-semibold text-foreground">Choose Date</span>
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="border border-black/10 dark:border-white/20 rounded-md px-4 py-1.5 text-sm bg-background text-foreground font-medium w-60 text-center focus:outline-none shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex justify-center items-center">
                            08-06-2026 - 08-06-2026
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 rounded-xl bg-background border-border shadow-lg" align="end">
                        <div className="flex flex-col space-y-1">
                            <button className="px-3 py-2 text-sm text-left bg-[#0ea5e9] text-white rounded-md font-medium">Today</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">Yesterday</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">Last 7 Days</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">Last 30 Days</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">This Month</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">Last Month</button>
                            <button className="px-3 py-2 text-sm text-left text-[#0ea5e9] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors">Custom Range</button>
                            
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                                <button className="px-4 py-1.5 text-sm bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-md font-medium transition-colors">Apply</button>
                                <button className="px-4 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">Cancel</button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Top Row Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {topStats.map(renderCard)}
            </div>

            {/* Bottom Row Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bottomStats.map(renderCard)}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bottomStats2.map(renderCard)}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-8">
                <div className="lg:col-span-4 glass-card rounded-2xl p-6 min-h-[400px] relative overflow-hidden flex flex-col">
                    <h3 className="text-xl font-semibold mb-4 text-glow">Overview</h3>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[300px] h-[300px] bg-primary/20 blur-[100px] rounded-full"></div>
                    </div>
                    {/* Placeholder for Chart */}
                    <div className="flex-1 w-full flex items-end gap-3 px-2 mt-8 relative z-10">
                        {[40, 70, 45, 90, 65, 85, 120, 80, 50, 95, 110, 140].map((height, i) => (
                            <div key={i} className="flex-1 bg-gradient-to-t from-primary to-purple-400 rounded-t-md opacity-70 hover:opacity-100 transition-all hover:scale-105 shadow-[0_0_10px_rgba(139,92,246,0.3)]" style={{ height: `${(height / 140) * 100}%` }}></div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 glass-card rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-6">Recent Sales</h3>
                    <div className="space-y-6">
                        {[
                            { name: "Olivia Martin", email: "olivia.martin@email.com", amount: "+₹1,999.00" },
                            { name: "Jackson Lee", email: "jackson.lee@email.com", amount: "+₹39.00" },
                            { name: "Isabella Nguyen", email: "isabella.nguyen@email.com", amount: "+₹299.00" },
                            { name: "William Kim", email: "will@email.com", amount: "+₹99.00" },
                            { name: "Sofia Davis", email: "sofia.davis@email.com", amount: "+₹39.00" },
                        ].map((sale, i) => (
                            <div key={i} className="flex items-center p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold border border-primary/30 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                                    {sale.name.charAt(0)}
                                </div>
                                <div className="ml-4 space-y-1">
                                    <p className="text-sm font-medium leading-none text-foreground">{sale.name}</p>
                                    <p className="text-xs text-muted-foreground">{sale.email}</p>
                                </div>
                                <div className="ml-auto font-medium text-emerald-400">{sale.amount}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;