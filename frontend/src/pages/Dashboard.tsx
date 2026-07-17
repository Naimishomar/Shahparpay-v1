import { Banknote, Smartphone, Fingerprint, Building2, Receipt, Wallet, IndianRupee, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MerchantKycModal from '../components/MerchantKycModal';

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
            if (res.data.success) {
                if (res.data.alreadyOnboarded) {
                    setShowMerchantKycModal(true);
                } else if (res.data.url) {
                    window.location.href = res.data.url;
                } else {
                    alert("Invalid KYC URL returned.");
                }
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
                <div className="lg:col-span-4 glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4 h-full">
                        <div onClick={() => navigate('/aeps')} className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-500/20 transition-all hover:scale-105 group">
                            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Fingerprint className="text-blue-500" size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1">AEPS Services</h4>
                            <p className="text-xs text-muted-foreground">Cash Withdrawal & Inquiry</p>
                        </div>
                        <div onClick={() => navigate('/direct-payout')} className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-500/20 transition-all hover:scale-105 group">
                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Banknote className="text-purple-500" size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1">Direct Payout</h4>
                            <p className="text-xs text-muted-foreground">Instant Bank Settlement</p>
                        </div>
                        <div onClick={() => navigate('/recharge')} className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-green-500/20 transition-all hover:scale-105 group">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Smartphone className="text-green-500" size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1">Recharge & BBPS</h4>
                            <p className="text-xs text-muted-foreground">Mobile, DTH & Utility Bills</p>
                        </div>
                        <div onClick={() => navigate('/dmt')} className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-orange-500/20 transition-all hover:scale-105 group">
                            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Building2 className="text-orange-500" size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1">Domestic Money</h4>
                            <p className="text-xs text-muted-foreground">Money Transfer (DMT)</p>
                        </div>
                        <div onClick={() => navigate('/lead-generation')} className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-teal-600/10 border border-teal-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-teal-500/20 transition-all hover:scale-105 group">
                            <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Users className="text-teal-500" size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1">Lead Generation</h4>
                            <p className="text-xs text-muted-foreground">Credit Cards & Loans</p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 glass-card rounded-2xl p-6">
                    <h3 className="text-xl font-semibold mb-6">Recent Sales</h3>
                    <div className="space-y-6">
                        {loading ? (
                            <p className="text-center text-muted-foreground text-sm">Loading...</p>
                        ) : recentSales.length > 0 ? (
                            recentSales.map((sale, i) => (
                            <div key={i} className="flex items-center p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-border">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                    {sale.service ? sale.service.charAt(0) : sale.name.charAt(0)}
                                </div>
                                <div className="ml-4 space-y-1">
                                    <p className="text-sm font-bold leading-none text-foreground">{sale.service || sale.name}</p>
                                    <p className="text-xs font-medium text-foreground">{sale.name}</p>
                                    <p className="text-xs text-muted-foreground">{sale.details || sale.email}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <div className={`font-semibold ${sale.status === 'FAILED' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {sale.amount}
                                    </div>
                                    {sale.date && (
                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                            {new Date(sale.date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                        ) : (
                            <p className="text-center text-muted-foreground text-sm">No recent sales found</p>
                        )}
                    </div>
                </div>
            </div>
            {/* Bank 3 Aeps / Biometric KYC Modal */}
            {showMerchantKycModal && (
                <MerchantKycModal onClose={() => setShowMerchantKycModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;