import React, { useState, useEffect } from 'react';
import { CreditCard, ChevronRight, Loader2, Store, MapPin, Phone, CheckCircle2, AlertCircle, ShoppingBag, History, Search, FileText, Wallet, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import locationsData from '../../data/locations.json';

type SubTab = 'SERVICE' | 'COUPON' | 'STATUS';

interface ResultData {
    application_number?: number | string;
    admin_fee?: number;
    gst_amount?: number;
    final_amount?: number;
    commission_amount?: number;
    tds_amount?: number;
    net_commission?: number;
    number_of_coupons?: number;
    psa_id?: string;
    status?: string;
    new_wallet_balance?: number;
    message?: string;
    warning?: string;
}

interface StatusData {
    service_type?: string;
    application_number?: number | string;
    status?: string;
    public_remarks?: string;
    psa_id?: string | null;
    pan_number?: string;
    shop_name?: string;
    pan_agency_name?: string;
    number_of_coupons?: number;
    final_amount?: number;
    created_at?: string;
    updated_at?: string;
}

// Same black (light) / silver (dark) language as the dashboard and AEPS pages.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';

const statusChipClass = (status?: string) => {
    const neutral = 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 ring-1 ring-zinc-500/20';
    if (!status) return neutral;
    const s = status.toUpperCase();
    if (s.includes('COMPLET') || s.includes('SUCCESS') || s.includes('APPROV')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20';
    if (s.includes('REJECT')) return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/20';
    if (s.includes('PROCESS') || s.includes('SUBMIT')) return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20';
    return neutral;
};

const EsevaPanTab: React.FC = () => {
    const { token } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('SERVICE');

    const [serviceForm, setServiceForm] = useState({
        pan_number: '',
        shop_name: '',
        shop_address: '',
        state_name: '',
        district_name: '',
        pincode: ''
    });
    const [serviceLoading, setServiceLoading] = useState(false);

    const [couponForm, setCouponForm] = useState({
        psa_id: '',
        number_of_coupons: '1',
        pan_agency_name: 'UTIITSL'
    });
    const [couponLoading, setCouponLoading] = useState(false);

    // True once a PSA ID exists — the PAN Service form is then disabled because
    // there is no need to apply for the service again.
    const [hasPsaId, setHasPsaId] = useState(false);
    const [myPsaId, setMyPsaId] = useState<string | null>(null);

    const [statusForm, setStatusForm] = useState({ application_number: '' });
    const [statusLoading, setStatusLoading] = useState<'SERVICE' | 'COUPON' | null>(null);

    const [serviceResult, setServiceResult] = useState<ResultData | null>(null);
    const [couponResult, setCouponResult] = useState<ResultData | null>(null);
    const [statusResult, setStatusResult] = useState<StatusData | null>(null);

    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const [states, setStates] = useState<{ id: string; name: string }[]>([]);
    const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        const sortedStates = [...locationsData].map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
        setStates(sortedStates);
    }, []);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/pan/eseva/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setHistory(res.data.transactions);
            }
        } catch (error) {
            console.error("Failed to fetch eSeva PAN history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchMyPsaId = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/pan/eseva/my-psa`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.psa_id) {
                setMyPsaId(res.data.psa_id);
                setHasPsaId(true);
                setCouponForm(prev => ({ ...prev, psa_id: res.data.psa_id }));
            } else {
                setHasPsaId(false);
                setMyPsaId(null);
            }
        } catch (error) {
            console.error("Failed to fetch PSA ID:", error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchHistory();
            fetchMyPsaId();
        }
    }, [token]);

    const handleServiceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'state_name') {
            setServiceForm(prev => ({ ...prev, state_name: value, district_name: '' }));
            const selectedState = locationsData.find(s => s.name === value);
            if (selectedState && selectedState.districts) {
                const sortedDistricts = [...selectedState.districts].sort((a: any, b: any) => a.name.localeCompare(b.name));
                setDistricts(sortedDistricts);
            } else {
                setDistricts([]);
            }
        } else {
            setServiceForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleApplyService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (hasPsaId) return toast.error("Your PSA ID is already generated. No need to apply for PAN Service again.");
        if (serviceForm.pan_number.length !== 10) return toast.error("PAN number must be 10 characters");
        if (serviceForm.pincode.length !== 6) return toast.error("Pincode must be 6 digits");
        setServiceLoading(true);
        setServiceResult(null);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/eseva/apply-service`,
                { ...serviceForm, pan_number: serviceForm.pan_number.toUpperCase() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setServiceResult(res.data);
                toast.success(res.data.message || "PAN Service application submitted successfully!");
                    fetchHistory();
            } else {
                toast.error(res.data.message || "Failed to submit PAN Service application.");
            }
        } catch (error: any) {
            console.error("eSeva PAN Service Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setServiceLoading(false);
        }
    };

    const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCouponForm(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!couponForm.psa_id.trim()) return toast.error("PSA ID is required");
        if (!couponForm.number_of_coupons || Number(couponForm.number_of_coupons) < 1) return toast.error("Minimum 1 coupon is required");
        setCouponLoading(true);
        setCouponResult(null);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/eseva/apply-coupon`,
                {
                    psa_id: couponForm.psa_id.trim(),
                    number_of_coupons: Number(couponForm.number_of_coupons),
                    pan_agency_name: couponForm.pan_agency_name
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setCouponResult(res.data);
                toast.success(res.data.message || "PAN Coupon request submitted successfully!");
                    fetchHistory();
            } else {
                toast.error(res.data.message || "Failed to submit PAN Coupon request.");
            }
        } catch (error: any) {
            console.error("eSeva PAN Coupon Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setCouponLoading(false);
        }
    };

    const handleCheckStatus = async (type: 'SERVICE' | 'COUPON', appNumber?: number | string) => {
        const application_number = appNumber ?? statusForm.application_number;
        if (!application_number) return toast.error("Enter the application number");
        setStatusLoading(type);
        setStatusResult(null);
        try {
            const endpoint = type === 'SERVICE' ? 'service-status' : 'coupon-status';
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/eseva/${endpoint}`,
                { application_number: Number(application_number) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setStatusResult(res.data);
                setStatusForm({ application_number: String(application_number) });
                toast.success("Status fetched successfully!");
                fetchHistory();
            } else {
                toast.error(res.data.message || "Failed to fetch status.");
            }
        } catch (error: any) {
            console.error("eSeva PAN Status Error:", error);
            toast.error(error.response?.data?.message || "An error occurred while checking status.");
        } finally {
            setStatusLoading(null);
        }
    };

    const formatINR = (num?: number) => {
        if (num === undefined || num === null || isNaN(num)) return "₹0.00";
        return `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const renderResult = (result: ResultData, type: 'SERVICE' | 'COUPON') => (
        <div className="mt-6 p-5 bg-green-500/5 border border-green-500/30 rounded-2xl space-y-4">
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400 font-bold">
                <CheckCircle2 className="w-6 h-6" />
                <span>Application Submitted Successfully</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Application No.</p>
                    <p className="font-black text-foreground text-lg">#{result.application_number}</p>
                </div>
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Admin Fee</p>
                    <p className="font-bold text-foreground">{formatINR(result.admin_fee)}</p>
                </div>
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">GST (18%)</p>
                    <p className="font-bold text-foreground">{formatINR(result.gst_amount)}</p>
                </div>
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Debited</p>
                    <p className="font-bold text-foreground">{formatINR(result.final_amount)}</p>
                </div>
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Commission</p>
                    <p className="font-bold text-foreground">{formatINR(result.commission_amount)}</p>
                </div>
                <div className="p-3 bg-card border border-border/40 rounded-xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Net Credit (after 2% TDS)</p>
                    <p className="font-bold text-green-600 dark:text-green-400">{formatINR(result.net_commission)}</p>
                </div>
            </div>

            {result.number_of_coupons !== undefined && (
                <div className="p-3 bg-card border border-border/40 rounded-xl flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Number of Coupons</span>
                    <span className="font-bold text-foreground">{result.number_of_coupons}</span>
                </div>
            )}
            {result.psa_id && (
                <div className="p-3 bg-card border border-border/40 rounded-xl flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">PSA ID</span>
                    <span className="font-bold text-foreground font-mono">{result.psa_id}</span>
                </div>
            )}

            <div className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-xl text-sm">
                <span className="text-muted-foreground">New Wallet Balance</span>
                <span className="font-bold text-foreground">{formatINR(result.new_wallet_balance)}</span>
            </div>

            {result.warning && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{result.warning}</span>
                </div>
            )}

            <button
                onClick={() => handleCheckStatus(type, result.application_number)}
                disabled={statusLoading !== null}
                className={`w-full px-4 py-2.5 ${ACTIVE_BUTTON} rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
            >
                {statusLoading === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Check Live Status
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                                <CreditCard className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">PAN Card Services</h1>
                                <p className="text-sm text-muted-foreground">Get your PSA ID, buy UTI PAN coupons and track applications.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                            {myPsaId && (
                                <div className="flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-3 py-2">
                                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">PSA ID</span>
                                    <span className="font-mono text-sm font-semibold">{myPsaId}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-background/60 backdrop-blur p-1.5 w-full md:w-max">
                        {([
                            ['SERVICE', 'PAN Service', FileText],
                            ['COUPON', 'PAN Coupon', ShoppingBag],
                            ['STATUS', 'Status & History', History],
                        ] as const).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                onClick={() => setActiveSubTab(key)}
                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${activeSubTab === key ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {activeSubTab === 'SERVICE' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-foreground mb-4">PAN Service</h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className={`min-w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${SILVER_TILE}`}>1</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Submit Application</p>
                                        <p className="text-xs text-muted-foreground">Apply for PAN Service for your shop / agent.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className={`min-w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${SILVER_TILE}`}>2</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Auto Wallet Debit</p>
                                        <p className="text-xs text-muted-foreground">Admin Fee + 18% GST debited instantly.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className={`min-w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${SILVER_TILE}`}>3</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">PSA ID on Approval</p>
                                        <p className="text-xs text-muted-foreground">After admin approval, PSA ID is assigned and you can apply for PAN Coupons.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">PAN Service Application Form</h2>
                                <div className="px-3 py-1 rounded-full border bg-background/60 text-xs font-semibold text-muted-foreground">eSevaTech</div>
                            </div>

                            {hasPsaId ? (
                                <div className="p-5 bg-green-500/5 border border-green-500/30 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-3 text-green-600 dark:text-green-400 font-bold">
                                        <CheckCircle2 className="w-6 h-6" />
                                        <span>PSA ID Already Generated</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Your PSA ID <strong className="font-mono text-foreground">#{myPsaId}</strong> has already
                                        been generated and approved. There is no need to apply for the PAN Service again — you
                                        can directly purchase PAN coupons using your PSA ID.
                                    </p>
                                    {myPsaId && (
                                        <div className="p-3 bg-card border border-border/40 rounded-xl flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Your PSA ID</span>
                                            <span className="font-bold text-foreground font-mono">{myPsaId}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setActiveSubTab('COUPON')}
                                        className={`w-full px-4 py-2.5 ${ACTIVE_BUTTON} rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2`}
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                        Go to PAN Coupon
                                    </button>
                                </div>
                            ) : (
                            <>
                            <form onSubmit={handleApplyService} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Shop / Business Name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Store className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="shop_name"
                                                value={serviceForm.shop_name}
                                                onChange={handleServiceChange}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all"
                                                placeholder="Enter shop / business name"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Agent / Shop PAN Number</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            name="pan_number"
                                            value={serviceForm.pan_number}
                                            onChange={(e) => setServiceForm({ ...serviceForm, pan_number: e.target.value.toUpperCase() })}
                                            className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all uppercase"
                                            placeholder="10-character PAN (e.g. ABCDE1234F)"
                                            maxLength={10}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Full Shop Address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <MapPin className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            name="shop_address"
                                            value={serviceForm.shop_address}
                                            onChange={handleServiceChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all"
                                            placeholder="Shop No., Market, Road, Near landmark"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">State</label>
                                        <select
                                            name="state_name"
                                            value={serviceForm.state_name}
                                            onChange={handleServiceChange}
                                            className="w-full px-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all"
                                            required
                                        >
                                            <option value="">Select State</option>
                                            {states.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">District</label>
                                        <select
                                            name="district_name"
                                            value={serviceForm.district_name}
                                            onChange={handleServiceChange}
                                            className="w-full px-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all"
                                            required
                                            disabled={!serviceForm.state_name}
                                        >
                                            <option value="">Select District</option>
                                            {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground mb-1.5 block">Pincode</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                name="pincode"
                                                value={serviceForm.pincode}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    if (val.length <= 6) setServiceForm({ ...serviceForm, pincode: val });
                                                }}
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all"
                                                placeholder="6-digit pincode"
                                                maxLength={6}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border/30">
                                    <button
                                        type="submit"
                                        disabled={serviceLoading}
                                        className={`w-full py-3 ${ACTIVE_BUTTON} rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                                    >
                                        {serviceLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Submitting PAN Service Application...
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight className="w-5 h-5" />
                                                Submit PAN Service Application
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            {serviceResult && renderResult(serviceResult, 'SERVICE')}
                            </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'COUPON' && (() => {
                const count = Math.max(0, Number(couponForm.number_of_coupons) || 0);
                const setCount = (n: number) => setCouponForm(prev => ({ ...prev, number_of_coupons: String(Math.max(1, n)) }));
                const psaVerified = !!myPsaId && couponForm.psa_id.trim() === myPsaId;
                return (
                <div>
                <form onSubmit={handleApplyCoupon} className="grid gap-6 xl:grid-cols-[1fr_380px]">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        <div className="mb-6 flex items-start gap-4 border-b pb-5">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                                <ShoppingBag className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold">Apply PAN Coupons</h2>
                                <p className="text-sm text-muted-foreground">Only for agents whose PAN Service is approved and PSA ID is assigned.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">PSA ID</label>
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        name="psa_id"
                                        value={couponForm.psa_id}
                                        onChange={handleCouponChange}
                                        className="w-full pl-10 pr-28 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all font-mono tracking-wide"
                                        placeholder="Enter approved PSA ID"
                                        required
                                    />
                                    {psaVerified && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {couponForm.psa_id ? 'Auto-filled from your approved PAN Service. You can still edit it.' : 'Auto-filled once your PAN Service is approved.'}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-foreground">Number of Coupons</label>
                                <div className="flex items-stretch gap-2">
                                    <button type="button" onClick={() => setCount(count - 1)} disabled={count <= 1} className="w-12 rounded-xl border text-xl font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40" aria-label="Fewer coupons">−</button>
                                    <input
                                        type="number"
                                        name="number_of_coupons"
                                        min="1"
                                        value={couponForm.number_of_coupons}
                                        onChange={handleCouponChange}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className="flex-1 min-w-0 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all text-center text-2xl font-bold tabular-nums"
                                        placeholder="1"
                                        required
                                    />
                                    <button type="button" onClick={() => setCount(count + 1)} className="w-12 rounded-xl border text-xl font-semibold hover:bg-black/5 dark:hover:bg-white/5" aria-label="More coupons">+</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[1, 5, 10, 25].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setCount(n)}
                                            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-all ${count === n ? ACTIVE_BUTTON + ' border-transparent' : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            {n} {n === 1 ? 'coupon' : 'coupons'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-foreground">PAN Agency</label>
                                {/* One agency today, so it is shown as the chosen option rather than a one-item dropdown. */}
                                <label className="flex items-center gap-3 rounded-xl border-2 border-zinc-900 dark:border-zinc-300 bg-background/50 p-4 cursor-pointer">
                                    <input type="radio" name="pan_agency_name" value="UTIITSL" checked={couponForm.pan_agency_name === 'UTIITSL'} onChange={handleCouponChange} className="sr-only" />
                                    <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}>
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">UTIITSL</p>
                                        <p className="text-xs text-muted-foreground">UTI Infrastructure Technology and Services Ltd.</p>
                                    </div>
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Coupon ticket summary */}
                    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm xl:sticky xl:top-4 xl:self-start">
                        <h2 className="text-lg font-semibold">Summary</h2>

                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-5 text-white shadow-lg dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl dark:bg-white/40" />
                            {/* Ticket notches */}
                            <span aria-hidden className="absolute left-0 top-[62%] h-5 w-5 -translate-x-1/2 rounded-full bg-card" />
                            <span aria-hidden className="absolute right-0 top-[62%] h-5 w-5 translate-x-1/2 rounded-full bg-card" />
                            <div className="relative">
                                <div className="flex items-center justify-between text-xs uppercase tracking-wider opacity-70">
                                    <span>PAN Coupon</span>
                                    <span>{couponForm.pan_agency_name}</span>
                                </div>
                                <p className="mt-3 text-5xl font-bold tabular-nums">×{count || 0}</p>
                                <p className="text-sm opacity-70">{count === 1 ? 'application token' : 'application tokens'}</p>
                                <div className="my-4 border-t border-dashed border-white/25 dark:border-black/20" />
                                <div className="flex items-end justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                        <p className="uppercase tracking-wider opacity-60">PSA ID</p>
                                        <p className="truncate font-mono text-sm font-semibold">{couponForm.psa_id || '—'}</p>
                                    </div>
                                    <ShoppingBag className="h-6 w-6 opacity-60" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background/50 p-4 text-sm">
                            <p className="flex gap-2 text-xs text-muted-foreground">
                                <Wallet className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                Coupon charges are calculated by Shahparpay and debited from your Main Wallet on submission.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={couponLoading}
                            className={`w-full py-3 ${ACTIVE_BUTTON} rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                        >
                            {couponLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Submitting Coupon Request...
                                </>
                            ) : (
                                <>
                                    <ChevronRight className="w-5 h-5" />
                                    Submit PAN Coupon Request
                                </>
                            )}
                        </button>
                    </section>
                </form>

                {couponResult && renderResult(couponResult, 'COUPON')}
                </div>
                );
            })()}

            {activeSubTab === 'STATUS' && (
                <div className="space-y-6">
                    {/* Manual Status Check */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-1">
                            <Search className="w-5 h-5 text-muted-foreground" />
                            Check Application Status
                        </h2>
                        <p className="text-xs text-muted-foreground mb-5">Enter the application number returned at submission time.</p>

                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="number"
                                value={statusForm.application_number}
                                onChange={(e) => setStatusForm({ application_number: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-background border rounded-xl shadow-sm outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500 text-foreground transition-all font-mono"
                                placeholder="Application Number (e.g. 2001)"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCheckStatus('SERVICE')}
                                    disabled={statusLoading !== null}
                                    className={`px-5 py-2.5 ${ACTIVE_BUTTON} rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2`}
                                >
                                    {statusLoading === 'SERVICE' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    PAN Service
                                </button>
                                <button
                                    onClick={() => handleCheckStatus('COUPON')}
                                    disabled={statusLoading !== null}
                                    className="px-5 py-2.5 bg-background border rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {statusLoading === 'COUPON' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                                    PAN Coupon
                                </button>
                            </div>
                        </div>

                        {statusResult && (
                            <div className="mt-6 p-5 bg-card border border-border/50 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusChipClass(statusResult.status)}`}>
                                            {statusResult.status || 'N/A'}
                                        </span>
                                        <span className="text-xs text-muted-foreground uppercase font-bold">{statusResult.service_type || ''}</span>
                                    </div>
                                    <span className="text-sm font-black text-foreground">#{statusResult.application_number}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="p-3 bg-muted/40 border border-border/40 rounded-xl">
                                        <p className="text-xs text-muted-foreground mb-1">Public Remarks</p>
                                        <p className="font-medium text-foreground leading-relaxed">{statusResult.public_remarks || '—'}</p>
                                    </div>
                                    <div className="space-y-3">
                                        {statusResult.psa_id !== undefined && (
                                            <div className="p-3 bg-muted/40 border border-border/40 rounded-xl flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">PSA ID</span>
                                                <span className="font-bold text-foreground font-mono">{statusResult.psa_id || 'Not assigned'}</span>
                                            </div>
                                        )}
                                        {statusResult.pan_number && (
                                            <div className="p-3 bg-muted/40 border border-border/40 rounded-xl flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">PAN Number</span>
                                                <span className="font-bold text-foreground uppercase font-mono">{statusResult.pan_number}</span>
                                            </div>
                                        )}
                                        {statusResult.number_of_coupons !== undefined && (
                                            <div className="p-3 bg-muted/40 border border-border/40 rounded-xl flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Coupons</span>
                                                <span className="font-bold text-foreground">{statusResult.number_of_coupons}</span>
                                            </div>
                                        )}
                                        {statusResult.final_amount !== undefined && (
                                            <div className="p-3 bg-muted/40 border border-border/40 rounded-xl flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Amount</span>
                                                <span className="font-bold text-foreground">{formatINR(statusResult.final_amount)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(statusResult.created_at || statusResult.updated_at) && (
                                    <div className="text-[11px] text-muted-foreground">
                                        Submitted: {statusResult.created_at ? new Date(statusResult.created_at).toLocaleString() : '—'}
                                        {statusResult.updated_at && statusResult.updated_at !== statusResult.created_at && (
                                            <> &nbsp;•&nbsp; Updated: {new Date(statusResult.updated_at).toLocaleString()}</>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* History */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-muted-foreground" />
                            Application History
                        </h2>

                        {historyLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-3" />
                                <span className="text-sm text-muted-foreground">Loading applications...</span>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                No eSevaTech PAN applications yet. Submit a PAN Service or PAN Coupon request to get started.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-[11px] text-muted-foreground uppercase tracking-wider bg-black/[0.03] dark:bg-white/[0.04]">
                                            <th className="py-3 px-4 font-semibold">Type</th>
                                            <th className="py-3 px-4 font-semibold">Application No.</th>
                                            <th className="py-3 px-4 font-semibold">Date</th>
                                            <th className="py-3 px-4 font-semibold">Amount</th>
                                            <th className="py-3 px-4 font-semibold">Status</th>
                                            <th className="py-3 px-4 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((tx, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                        tx.type === 'PAN_SERVICE' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30' : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30'
                                                    }`}>
                                                        {tx.type === 'PAN_SERVICE' ? 'PAN Service' : 'PAN Coupon'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono font-medium text-foreground">
                                                    #{tx.metadata?.application_number ?? '—'}
                                                </td>
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    {new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-foreground">{formatINR(tx.amount)}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusChipClass(tx.metadata?.eseva_status || tx.status)}`}>
                                                        {tx.metadata?.eseva_status || tx.status || 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleCheckStatus(tx.type === 'PAN_SERVICE' ? 'SERVICE' : 'COUPON', tx.metadata?.application_number)}
                                                        disabled={statusLoading !== null}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                                    >
                                                        {statusLoading !== null ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                        Check Status
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EsevaPanTab;
