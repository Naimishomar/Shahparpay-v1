import React, { useState, useEffect } from 'react';
import { CreditCard, ChevronRight, Loader2, Store, MapPin, Hash, CheckCircle2, AlertCircle, ShoppingBag, History, Search, FileText, Wallet, KeyRound, Inbox } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import PrimaryCta from '../PrimaryCta';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import locationsData from '../../data/locations.json';
import { TitleText } from '../BlurText';
import { PILL_HIGHLIGHT } from '../PrimaryCta';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsHighlight, TabsHighlightItem } from '../animate-ui/primitives/radix/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// animate-ui Tabs panels: a quick blur cross-fade, not the 0.5 s default.
const PANEL = { duration: 0.25, ease: 'easeOut' } as const;

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
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const FIELD = cn(INPUT, 'h-11 pl-10');
const ICON = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground';
const REQ = <span className="text-rose-500"> *</span>;

/** A numbered step heading, as on Recharge and Lead Generation. */
const StepHead = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <div className="mb-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n}</span>
            {title}
        </p>
        {hint && <p className="ml-8 text-xs text-muted-foreground">{hint}</p>}
    </div>
);

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
        <div className="mt-6 space-y-4 rounded-2xl bg-emerald-500/5 p-5 ring-1 ring-emerald-500/25 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
        // animate-ui Tabs: the selected pill slides between tabs; panels cross-fade.
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as SubTab)} className="space-y-6">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">

                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                                <CreditCard className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="PAN Card Services" /></h1>
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

                    <TabsList aria-label="PAN services" className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-background/60 backdrop-blur p-1.5 w-full md:w-max">
                        <TabsHighlight className={PILL_HIGHLIGHT}>
                        {([
                            ['SERVICE', 'PAN Service', FileText],
                            ['COUPON', 'PAN Coupon', ShoppingBag],
                            ['STATUS', 'Status & History', History],
                        ] as const).map(([key, label, Icon]) => (
                            <TabsHighlightItem key={key} value={key}>
                            <TabsTrigger
                                value={key}
                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-foreground ${activeSubTab === key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </TabsTrigger>
                            </TabsHighlightItem>
                        ))}
                        </TabsHighlight>
                    </TabsList>
                </div>
            </section>

            <TabsContent value="SERVICE" transition={PANEL}>
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <div className="mb-6 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">PAN Service application</h2>
                                <p className="text-sm text-muted-foreground">Apply once for your shop; the PSA ID it gives you is used to buy PAN coupons.</p>
                            </div>
                            <span className="shrink-0 rounded-full border bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">eSevaTech</span>
                        </div>

                        {hasPsaId ? (
                            <div className="space-y-4 rounded-2xl bg-emerald-500/5 p-5 ring-1 ring-emerald-500/25">
                                <div className="flex items-center gap-3 font-semibold text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="h-6 w-6" />
                                    <span>PSA ID already generated</span>
                                </div>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    Your PSA ID has already been generated and approved. There is no need to apply for the
                                    PAN Service again — you can directly purchase PAN coupons using your PSA ID.
                                </p>
                                {myPsaId && (
                                    <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                                        <span className="text-muted-foreground">Your PSA ID</span>
                                        <span className="font-mono font-bold">{myPsaId}</span>
                                    </div>
                                )}
                                <PrimaryCta type="button" onClick={() => setActiveSubTab('COUPON')} className="w-full font-semibold">
                                    <ShoppingBag className="h-4 w-4" /> Go to PAN Coupon
                                </PrimaryCta>
                            </div>
                        ) : (
                            <>
                                <form onSubmit={handleApplyService} className="flex flex-col gap-7">
                                    <div>
                                        <StepHead n={1} title="Shop and agent" hint="The business the PSA ID is issued to." />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="eseva-shop" className="text-sm font-medium">Shop / business name{REQ}</label>
                                                <div className="relative">
                                                    <Store className={ICON} />
                                                    <input id="eseva-shop" type="text" name="shop_name" value={serviceForm.shop_name} onChange={handleServiceChange} className={FIELD} placeholder="Shop or business name" required />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="eseva-pan" className="text-sm font-medium">Agent / shop PAN{REQ}</label>
                                                <div className="relative">
                                                    <CreditCard className={ICON} />
                                                    <input
                                                        id="eseva-pan"
                                                        type="text"
                                                        name="pan_number"
                                                        value={serviceForm.pan_number}
                                                        onChange={(e) => setServiceForm({ ...serviceForm, pan_number: e.target.value.toUpperCase() })}
                                                        className={cn(FIELD, 'font-mono uppercase tracking-wider')}
                                                        placeholder="ABCDE1234F"
                                                        maxLength={10}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <StepHead n={2} title="Shop address" hint="Where the shop is." />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                                <label htmlFor="eseva-address" className="text-sm font-medium">Full address{REQ}</label>
                                                <div className="relative">
                                                    <MapPin className={ICON} />
                                                    <input id="eseva-address" type="text" name="shop_address" value={serviceForm.shop_address} onChange={handleServiceChange} className={FIELD} placeholder="Shop no., market, road, landmark" required />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="eseva-state" className="text-sm font-medium">State{REQ}</label>
                                                <Select name="state_name" required value={serviceForm.state_name} onValueChange={(value) => handleServiceChange({ target: { name: 'state_name', value } } as React.ChangeEvent<HTMLSelectElement>)}>
                                                    <SelectTrigger id="eseva-state" className={cn(INPUT, 'h-11 data-[size=default]:h-11')}><SelectValue placeholder="Select state" /></SelectTrigger>
                                                    <SelectContent position="popper" className="max-h-72">
                                                        {states.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="eseva-district" className="text-sm font-medium">District{REQ}</label>
                                                <Select name="district_name" required disabled={!serviceForm.state_name} value={serviceForm.district_name} onValueChange={(value) => handleServiceChange({ target: { name: 'district_name', value } } as React.ChangeEvent<HTMLSelectElement>)}>
                                                    <SelectTrigger id="eseva-district" className={cn(INPUT, 'h-11 data-[size=default]:h-11')}><SelectValue placeholder={serviceForm.state_name ? 'Select district' : 'Choose the state first'} /></SelectTrigger>
                                                    <SelectContent position="popper" className="max-h-72">
                                                        {districts.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="eseva-pincode" className="text-sm font-medium">Pincode{REQ}</label>
                                                <div className="relative">
                                                    <Hash className={ICON} />
                                                    <input
                                                        id="eseva-pincode"
                                                        type="text"
                                                        inputMode="numeric"
                                                        name="pincode"
                                                        value={serviceForm.pincode}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            if (val.length <= 6) setServiceForm({ ...serviceForm, pincode: val });
                                                        }}
                                                        className={cn(FIELD, 'tabular-nums tracking-wider')}
                                                        placeholder="6-digit pincode"
                                                        maxLength={6}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <PrimaryCta disabled={serviceLoading} className="w-full font-semibold">
                                        {serviceLoading
                                            ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting application…</>
                                            : <><ChevronRight className="h-5 w-5" /> Submit PAN Service application</>}
                                    </PrimaryCta>
                                </form>

                                {serviceResult && renderResult(serviceResult, 'SERVICE')}
                            </>
                        )}
                    </section>

                    {/* How the service goes, beside the form. */}
                    <aside className="rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
                        <ol className="mt-4 space-y-5">
                            {([
                                [FileText, 'Submit the application', 'Apply for PAN Service for your shop / agent.'],
                                [Wallet, 'Automatic wallet debit', 'Admin Fee + 18% GST debited instantly.'],
                                [KeyRound, 'PSA ID on approval', 'After admin approval, a PSA ID is assigned and you can apply for PAN coupons.'],
                            ] as const).map(([Icon, title, text], i, all) => (
                                <li key={title} className="relative flex gap-3">
                                    {i < all.length - 1 && <span aria-hidden className="absolute left-[17px] top-10 bottom-[-1.25rem] w-px bg-border" />}
                                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                    <span>
                                        <span className="block text-sm font-semibold">{i + 1}. {title}</span>
                                        <span className="block text-xs leading-relaxed text-muted-foreground">{text}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-5 flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
                            <span className="text-muted-foreground">Your PSA ID</span>
                            {myPsaId
                                ? <span className="font-mono font-semibold">{myPsaId}</span>
                                : <span className="text-xs text-muted-foreground">Not assigned yet</span>}
                        </div>
                    </aside>
                </div>
            </TabsContent>
            <TabsContent value="COUPON" transition={PANEL}>
            {(() => {
                const count = Math.max(0, Number(couponForm.number_of_coupons) || 0);
                const setCount = (n: number) => setCouponForm(prev => ({ ...prev, number_of_coupons: String(Math.max(1, n)) }));
                const psaVerified = !!myPsaId && couponForm.psa_id.trim() === myPsaId;
                return (
                <div>
                <form onSubmit={handleApplyCoupon} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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

                        <div className="flex flex-col gap-7">
                            <div className="flex flex-col gap-1.5">
                                <StepHead n={1} title="PSA ID" />
                                <label htmlFor="eseva-psa" className="sr-only">PSA ID</label>
                                <div className="relative">
                                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        id="eseva-psa"
                                        type="text"
                                        name="psa_id"
                                        value={couponForm.psa_id}
                                        onChange={handleCouponChange}
                                        className={cn(FIELD, 'pr-28 font-mono tracking-wide')}
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
                                <StepHead n={2} title="Number of coupons" />
                                <label htmlFor="eseva-coupons" className="sr-only">Number of coupons</label>
                                <div className="flex items-stretch gap-2">
                                    <button type="button" onClick={() => setCount(count - 1)} disabled={count <= 1} className="w-12 rounded-xl border text-xl font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40" aria-label="Fewer coupons">−</button>
                                    <input
                                        id="eseva-coupons"
                                        type="number"
                                        name="number_of_coupons"
                                        min="1"
                                        value={couponForm.number_of_coupons}
                                        onChange={handleCouponChange}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className={cn(INPUT, 'h-14 min-w-0 flex-1 text-center text-2xl font-bold tabular-nums')}
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
                                <StepHead n={3} title="PAN agency" />
                                {/* One agency today, so it is shown as the chosen option rather than a one-item dropdown. */}
                                <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-background/50 p-4">
                                    {couponForm.pan_agency_name === 'UTIITSL' && <motion.span layoutId="eseva-agency" aria-hidden className="absolute inset-0 rounded-xl ring-2 ring-primary" />}
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
                    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-4">
                        <h2 className="text-lg font-semibold">Summary</h2>

                        <div className="relative overflow-hidden rounded-2xl hero-panel p-5">
                            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#F47920]/25 blur-2xl" />
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
                                Coupon charges are calculated by Shahparpay and debited from your Utility Wallet on submission.
                            </p>
                        </div>

                        <PrimaryCta disabled={couponLoading} className="w-full font-semibold">
                            {couponLoading
                                ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting coupon request…</>
                                : <><ChevronRight className="h-5 w-5" /> Request {count || 0} {count === 1 ? 'coupon' : 'coupons'}</>}
                        </PrimaryCta>
                    </section>
                </form>

                {couponResult && renderResult(couponResult, 'COUPON')}
                </div>
                );
            })()}
            </TabsContent>

            <TabsContent value="STATUS" transition={PANEL}>
                <div className="space-y-6">
                    {/* Check one application by its number. */}
                    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-semibold">Check an application</h2>
                        <p className="mb-4 text-sm text-muted-foreground">Enter the application number returned at submission time.</p>
                        <div className="flex flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <label htmlFor="eseva-appno" className="sr-only">Application number</label>
                                <Hash className={ICON} />
                                <input
                                    id="eseva-appno"
                                    type="number"
                                    value={statusForm.application_number}
                                    onChange={(e) => setStatusForm({ application_number: e.target.value })}
                                    className={cn(FIELD, 'font-mono')}
                                    placeholder="Application number (e.g. 2001)"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleCheckStatus('SERVICE')}
                                    disabled={statusLoading !== null}
                                    className={`flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all disabled:opacity-50 ${ACTIVE_BUTTON}`}
                                >
                                    {statusLoading === 'SERVICE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                    PAN Service
                                </button>
                                <button
                                    onClick={() => handleCheckStatus('COUPON')}
                                    disabled={statusLoading !== null}
                                    className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-background px-5 text-sm font-semibold transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                                >
                                    {statusLoading === 'COUPON' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                                    PAN Coupon
                                </button>
                            </div>
                        </div>

                        {statusResult && (
                            <div className="mt-5 space-y-4 rounded-2xl border bg-background/50 p-5 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusChipClass(statusResult.status)}`}>
                                            {statusResult.status || 'N/A'}
                                        </span>
                                        <span className="text-xs font-semibold uppercase text-muted-foreground">{statusResult.service_type || ''}</span>
                                    </div>
                                    <span className="font-mono text-sm font-bold">#{statusResult.application_number}</span>
                                </div>
                                <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <dt className="text-xs text-muted-foreground">Public remarks</dt>
                                        <dd className="font-medium leading-relaxed">{statusResult.public_remarks || '—'}</dd>
                                    </div>
                                    {statusResult.psa_id !== undefined && (
                                        <div className="flex justify-between gap-3 border-t pt-2.5"><dt className="text-muted-foreground">PSA ID</dt><dd className="font-mono font-semibold">{statusResult.psa_id || 'Not assigned'}</dd></div>
                                    )}
                                    {statusResult.pan_number && (
                                        <div className="flex justify-between gap-3 border-t pt-2.5"><dt className="text-muted-foreground">PAN number</dt><dd className="font-mono font-semibold uppercase">{statusResult.pan_number}</dd></div>
                                    )}
                                    {statusResult.number_of_coupons !== undefined && (
                                        <div className="flex justify-between gap-3 border-t pt-2.5"><dt className="text-muted-foreground">Coupons</dt><dd className="font-semibold">{statusResult.number_of_coupons}</dd></div>
                                    )}
                                    {statusResult.final_amount !== undefined && (
                                        <div className="flex justify-between gap-3 border-t pt-2.5"><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{formatINR(statusResult.final_amount)}</dd></div>
                                    )}
                                </dl>
                                {(statusResult.created_at || statusResult.updated_at) && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Submitted: {statusResult.created_at ? new Date(statusResult.created_at).toLocaleString() : '—'}
                                        {statusResult.updated_at && statusResult.updated_at !== statusResult.created_at && (
                                            <> &nbsp;•&nbsp; Updated: {new Date(statusResult.updated_at).toLocaleString()}</>
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Every application, newest as the API returns them. */}
                    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                            <History className="h-5 w-5 text-muted-foreground" />
                            Application history
                        </h2>
                        {historyLoading ? (
                            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />)}</div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                                <Inbox className="mb-2 h-8 w-8 opacity-60" />
                                <p className="text-sm">No eSevaTech PAN applications yet. Submit a PAN Service or PAN Coupon request to get started.</p>
                            </div>
                        ) : (
                            <ul className="stage-list divide-y rounded-xl border">
                                {history.map((tx, idx) => {
                                    const service = tx.type === 'PAN_SERVICE';
                                    const Icon = service ? FileText : ShoppingBag;
                                    const status = tx.metadata?.eseva_status || tx.status || 'PENDING';
                                    return (
                                        <li key={idx} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:flex-nowrap">
                                            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold">
                                                    {service ? 'PAN Service' : 'PAN Coupon'} <span className="font-mono font-medium text-muted-foreground">#{tx.metadata?.application_number ?? '—'}</span>
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                                </span>
                                            </span>
                                            <span className="text-right">
                                                <span className="block text-sm font-semibold tabular-nums">{formatINR(tx.amount)}</span>
                                                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusChipClass(status)}`}>{status}</span>
                                            </span>
                                            <button
                                                onClick={() => handleCheckStatus(service ? 'SERVICE' : 'COUPON', tx.metadata?.application_number)}
                                                disabled={statusLoading !== null}
                                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                                            >
                                                {statusLoading !== null ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                                                Check status
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </TabsContent>
        </Tabs>
    );
};

export default EsevaPanTab;
