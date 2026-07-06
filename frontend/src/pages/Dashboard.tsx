import { Banknote, Smartphone, Fingerprint, Building2, Receipt, Wallet, IndianRupee, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
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

    const fetchStats = async (start?: string, end?: string) => {
        if (!token) return;
        try {
            setLoading(true);
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

    useEffect(() => {
        fetchStats();
    }, [token]);

    const applyDateFilter = () => {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        
        if (tempDateType === 'Custom Range') {
            if (!customStart || !customEnd) return; // Prevent apply if missing dates
            start = new Date(customStart);
            end = new Date(customEnd);
        } else {
            switch(tempDateType) {
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
        }
        
        setDateRangeText(tempDateType);
        fetchStats(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
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
            if (res.data.success && res.data.url) {
                window.location.href = res.data.url;
            } else {
                alert(res.data.message || "Failed to fetch KYC URL");
            }
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to fetch KYC URL");
        } finally {
            setKycLoading(false);
        }
    };
    const topStats = [
        { title: "Total Success DMT", value: `₹ ${stats?.DMT?.toFixed(2) || '0.00'}`, icon: Banknote },
        { title: "Total Success Recharge", value: `₹ ${stats?.RECHARGE?.toFixed(2) || '0.00'}`, icon: Smartphone },
        { title: "Total Success AEPS", value: `₹ ${stats?.AEPS_WITHDRAWAL?.toFixed(2) || '0.00'}`, icon: Fingerprint },
        { title: "Total Success Payout", value: `₹ ${stats?.AEPS_SETTLEMENT?.toFixed(2) || '0.00'}`, icon: Building2 },
    ];

    const bottomStats = [
        { title: "Total Success BBPS", value: `₹ ${stats?.BILL_PAYMENT?.toFixed(2) || '0.00'}`, icon: Receipt },
        { title: "Total Success UPI", value: `₹ ${stats?.WALLET_TOPUP?.toFixed(2) || '0.00'}`, icon: Wallet },
        { title: "Total Earnings", value: `₹ ${stats?.TotalCommission?.toFixed(2) || '0.00'}`, icon: IndianRupee },
    ];

    const bottomStats2 = [
        { title: "Total Customer", value: `${stats?.TotalCustomers || 0}`, icon: Users },
        { title: "Total Transactions", value: `₹ ${stats?.TotalTransactionsAmount?.toFixed(2) || '0.00'}`, icon: Wallet },
        { title: "Total Commission", value: `₹ ${stats?.TotalCommission?.toFixed(2) || '0.00'}`, icon: IndianRupee },
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
            {user && user.isMerchantKycComplete === false && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-sm flex justify-between items-center">
                    <div>
                        <p className="font-bold">KYC Pending</p>
                        <p className="text-sm">Please complete your KYC via PaySprint to activate all services.</p>
                    </div>
                    <button 
                        onClick={handleCompleteKyc} 
                        disabled={kycLoading}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                    >
                        {kycLoading ? 'Loading...' : 'Complete KYC'}
                    </button>
                </div>
            )}
            
            {/* Date Picker Bar */}
            <div className="flex items-center justify-end bg-white dark:bg-white/5 p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/10 gap-3">
                <span className="text-sm font-semibold text-foreground">Choose Date</span>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <button className="border border-black/10 dark:border-white/20 rounded-md px-4 py-1.5 text-sm bg-background text-foreground font-medium w-60 text-center focus:outline-none shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex justify-center items-center">
                            {dateRangeText} {tempDateType === 'Custom Range' && dateRangeText === 'Custom Range' ? `(${customStart} - ${customEnd})` : ''}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 rounded-xl bg-background border-border shadow-lg" align="end">
                        <div className="flex flex-col space-y-1">
                            {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Custom Range'].map((type) => (
                                <button 
                                    key={type}
                                    onClick={() => setTempDateType(type)} 
                                    className={`px-3 py-2 text-sm text-left rounded-md transition-colors ${tempDateType === type ? 'bg-primary text-primary-foreground font-medium' : 'text-primary bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}`}
                                >
                                    {type}
                                </button>
                            ))}
                            
                            {tempDateType === 'Custom Range' && (
                                <div className="flex flex-col gap-2 mt-2 p-2 bg-black/5 dark:bg-white/5 rounded-md">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-muted-foreground font-medium">Start Date</label>
                                        <input 
                                            type="date" 
                                            className="text-sm p-1.5 rounded border bg-background text-foreground" 
                                            value={customStart} 
                                            onChange={(e) => setCustomStart(e.target.value)} 
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-muted-foreground font-medium">End Date</label>
                                        <input 
                                            type="date" 
                                            className="text-sm p-1.5 rounded border bg-background text-foreground" 
                                            value={customEnd} 
                                            onChange={(e) => setCustomEnd(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                                <button onClick={applyDateFilter} className="flex-1 px-4 py-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-colors">Apply</button>
                                <button onClick={() => setPopoverOpen(false)} className="flex-1 px-4 py-1.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">Cancel</button>
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
                        {loading ? (
                            <p className="text-center text-muted-foreground text-sm">Loading...</p>
                        ) : recentSales.length > 0 ? (
                            recentSales.map((sale, i) => (
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
                        ))
                        ) : (
                            <p className="text-center text-muted-foreground text-sm">No recent sales found</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;