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

const statusChipClass = (status?: string) => {
    if (!status) return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    const s = status.toUpperCase();
    if (s.includes('COMPLET') || s.includes('SUCCESS') || s.includes('APPROV')) return 'bg-green-500/10 text-green-500 border-green-500/30';
    if (s.includes('REJECT')) return 'bg-red-500/10 text-red-500 border-red-500/30';
    if (s.includes('PROCESS') || s.includes('SUBMIT')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
};

const EsevaPanTab: React.FC = () => {
    const { token } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('SERVICE');

    const [mainBalance, setMainBalance] = useState<number | null>(null);

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

    const fetchWalletBalance = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/wallet/balance`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMainBalance(res.data.data.mainBalance);
            }
        } catch (error) {
            console.error("Failed to fetch wallet balance:", error);
        }
    };

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
                setCouponForm(prev => ({ ...prev, psa_id: res.data.psa_id }));
            }
        } catch (error) {
            console.error("Failed to fetch PSA ID:", error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchWalletBalance();
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
                fetchWalletBalance();
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
                fetchWalletBalance();
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
                    <p className="font-black text-primary text-lg">#{result.application_number}</p>
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
                    <span className="font-bold text-primary font-mono">{result.psa_id}</span>
                </div>
            )}

            <div className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-xl text-sm">
                <span className="text-muted-foreground">New Wallet Balance</span>
                <span className="font-bold text-primary">{formatINR(result.new_wallet_balance)}</span>
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
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {statusLoading === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Check Live Status
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Sub-tabs Navigation */}
            <div className="flex bg-muted/50 p-1 rounded-xl w-full max-w-md border border-border/50">
                <button
                    onClick={() => setActiveSubTab('SERVICE')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'SERVICE' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <FileText className="w-4 h-4" />
                    PAN Service
                </button>
                <button
                    onClick={() => setActiveSubTab('COUPON')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'COUPON' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <ShoppingBag className="w-4 h-4" />
                    PAN Coupon
                </button>
                <button
                    onClick={() => setActiveSubTab('STATUS')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'STATUS' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <History className="w-4 h-4" />
                    Status & History
                </button>
            </div>

            {activeSubTab === 'SERVICE' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-foreground mb-4">PAN Service</h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Submit Application</p>
                                        <p className="text-xs text-muted-foreground">Apply for PAN Service for your shop / agent.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Auto Wallet Debit</p>
                                        <p className="text-xs text-muted-foreground">Admin Fee + 18% GST debited instantly.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="min-w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
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
                                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">eSevaTech</div>
                            </div>

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
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
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
                                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all uppercase"
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
                                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
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
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
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
                                            className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
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
                                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
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
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'COUPON' && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                    <ShoppingBag className="w-6 h-6 text-primary" />
                                    Apply PAN Coupons
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Only for agents whose PAN Service is Approved and PSA ID is assigned.
                                </p>
                            </div>
                            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">UTIITSL</div>
                        </div>

                        <form onSubmit={handleApplyCoupon} className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">PSA ID</label>
                                <input
                                    type="text"
                                    name="psa_id"
                                    value={couponForm.psa_id}
                                    onChange={handleCouponChange}
                                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all font-mono"
                                    placeholder="Enter approved PSA ID"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {couponForm.psa_id ? 'PSA ID auto-filled from your approved PAN Service. You can still edit it.' : 'PSA ID is auto-filled once your PAN Service is approved.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Number of Coupons</label>
                                    <input
                                        type="number"
                                        name="number_of_coupons"
                                        min="1"
                                        value={couponForm.number_of_coupons}
                                        onChange={handleCouponChange}
                                        className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all font-semibold"
                                        placeholder="Minimum 1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">PAN Agency</label>
                                    <select
                                        name="pan_agency_name"
                                        value={couponForm.pan_agency_name}
                                        onChange={handleCouponChange}
                                        className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                                    >
                                        <option value="UTIITSL">UTIITSL</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border/30">
                                <button
                                    type="submit"
                                    disabled={couponLoading}
                                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                            </div>
                        </form>

                        {couponResult && renderResult(couponResult, 'COUPON')}
                    </div>
                </div>
            )}

            {activeSubTab === 'STATUS' && (
                <div className="space-y-6">
                    {/* Manual Status Check */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-1">
                            <Search className="w-5 h-5 text-primary" />
                            Check Application Status
                        </h2>
                        <p className="text-xs text-muted-foreground mb-5">Enter the application number returned at submission time.</p>

                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="number"
                                value={statusForm.application_number}
                                onChange={(e) => setStatusForm({ application_number: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all font-mono"
                                placeholder="Application Number (e.g. 2001)"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCheckStatus('SERVICE')}
                                    disabled={statusLoading !== null}
                                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {statusLoading === 'SERVICE' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    PAN Service
                                </button>
                                <button
                                    onClick={() => handleCheckStatus('COUPON')}
                                    disabled={statusLoading !== null}
                                    className="px-5 py-2.5 bg-secondary text-secondary-foreground border border-border/50 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
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
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${statusChipClass(statusResult.status)}`}>
                                            {statusResult.status || 'N/A'}
                                        </span>
                                        <span className="text-xs text-muted-foreground uppercase font-bold">{statusResult.service_type || ''}</span>
                                    </div>
                                    <span className="text-sm font-black text-primary">#{statusResult.application_number}</span>
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
                                                <span className="font-bold text-primary font-mono">{statusResult.psa_id || 'Not assigned'}</span>
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
                            <History className="w-5 h-5 text-primary" />
                            Application History
                        </h2>

                        {historyLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
                                <span className="text-sm text-muted-foreground">Loading applications...</span>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                No eSevaTech PAN applications yet. Submit a PAN Service or PAN Coupon request to get started.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                                            <th className="py-3 pr-4 font-semibold">Type</th>
                                            <th className="py-3 pr-4 font-semibold">Application No.</th>
                                            <th className="py-3 pr-4 font-semibold">Date</th>
                                            <th className="py-3 pr-4 font-semibold">Amount</th>
                                            <th className="py-3 pr-4 font-semibold">Status</th>
                                            <th className="py-3 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((tx, idx) => (
                                            <tr key={idx} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                                                <td className="py-3 pr-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                        tx.type === 'PAN_SERVICE' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                                                    }`}>
                                                        {tx.type === 'PAN_SERVICE' ? 'PAN Service' : 'PAN Coupon'}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 font-mono font-medium text-foreground">
                                                    #{tx.metadata?.application_number ?? '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-muted-foreground">
                                                    {new Date(tx.createdAt).toLocaleString()}
                                                </td>
                                                <td className="py-3 pr-4 font-semibold text-foreground">{formatINR(tx.amount)}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusChipClass(tx.metadata?.eseva_status || tx.status)}`}>
                                                        {tx.metadata?.eseva_status || tx.status || 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <button
                                                        onClick={() => handleCheckStatus(tx.type === 'PAN_SERVICE' ? 'SERVICE' : 'COUPON', tx.metadata?.application_number)}
                                                        disabled={statusLoading !== null}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
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
