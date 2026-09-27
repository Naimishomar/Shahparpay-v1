import { useState, useEffect } from "react";
import { XCircle, Clock, Smartphone, Tv, Search, Lock, Loader2, Zap, ListFilter, Radio, MapPin, Hash, ReceiptText } from "lucide-react";
import axios from "axios";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';
import { toast } from 'sonner';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const Recharge = () => {
    // UI State
    const [activeTab, setActiveTab] = useState("prepaid");
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [dthOperators, setDthOperators] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [planMeta, setPlanMeta] = useState<any>(null);
    const [showPlansModal, setShowPlansModal] = useState(false);
    const [planSearch, setPlanSearch] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);

    // Form State (Prepaid)
    const [mobileNumber, setMobileNumber] = useState("");
    // Icchhamati resolves both values from the mobile number during plan lookup.
    // They are kept internally for the recharge request and are not retailer inputs.
    const [resolvedOperator, setResolvedOperator] = useState("");
    const [resolvedCircle, setResolvedCircle] = useState("");
    const [prepaidAmount, setPrepaidAmount] = useState("");
    const [prepaidPin, setPrepaidPin] = useState("");

    // Form State (DTH)
    const [dthNumber, setDthNumber] = useState("");
    const [dthOperator, setDthOperator] = useState("");
    const [dthAmount, setDthAmount] = useState("");
    const [dthPin, setDthPin] = useState("");
    const [dthInfo, setDthInfo] = useState<any>(null);

    // Initial Data Fetch
    useEffect(() => {
        fetchOperators('dth');
        fetchHistory();
    }, []);

    const fetchOperators = async (type: string) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/operators/${type}`);
            const data = await res.json();
            if (!data.success) {
                // A refused list is not an empty list — say why, rather than
                // leaving an empty dropdown that looks like our bug.
                toast.error(data.message || `Could not load ${type} operators`);
                return;
            }
            if (type === 'dth') setDthOperators(data.data);
        } catch (error) {
            console.error(`Failed to fetch ${type} operators`, error);
            toast.error(`Could not load ${type} operators`);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/history`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    };

    const handleBrowsePlan = async () => {
        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
            toast.error("Please enter a valid 10-digit mobile number.");
            return;
        }
        setLoading(true);
        try {
            // The provider derives the operator and circle from the number itself,
            // so the number is all it is sent.
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/browse-plan`, {
                mobileNumber
            });
            if (response.data && response.data.success) {
                // Icchhamati resolves the operator and circle from the number.
                const meta = response.data.meta || {};
                setPlanMeta({
                    ...meta,
                    logo: meta.logo || response.data.logo || response.data.data?.logo || null,
                    operatorName: meta.operatorName || response.data.operatorname || response.data.data?.operatorname || null,
                    circleName: meta.circleName || response.data.circalname || response.data.data?.circalname || null,
                });
                setResolvedOperator(meta.operator ? String(meta.operator) : "");
                setResolvedCircle(meta.circle ? String(meta.circle) : "");

                // response.data.data contains the plans object with categories like TOPUP, 3G/4G, etc.
                const plansData = response.data.data || {};
                const flattenedPlans: any[] = [];
                Object.keys(plansData).forEach(category => {
                    const categoryPlans = plansData[category];
                    if (Array.isArray(categoryPlans)) {
                        categoryPlans.forEach((p: any) => {
                            flattenedPlans.push({
                                category,
                                amount: p.rs || p.amount,
                                description: p.desc || p.description,
                                validity: p.validity,
                                planstatus: p.planstatus || 'Active',
                            });
                        });
                    }
                });
                setPlans(flattenedPlans);
                if (flattenedPlans.length === 0) {
                    toast.info("No active plans were returned. You can enter the recharge amount manually.");
                    return;
                }
                setShowPlansModal(true);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const downloadReceipt = async () => {
        const element = document.getElementById('receipt-content');
        if (!element) return;
        
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Receipt_${receiptData?.transactionId || 'Txn'}.pdf`);
        } catch (error: any) {
            console.error("PDF generation failed", error);
            toast.error(`Failed to generate PDF: ${error?.message || error}`);
        }
    };

    const handleFetchDthInfo = async () => {
        if (!dthNumber || !dthOperator) {
            toast.error("Please enter DTH number and select operator first.");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/dth-info`, {
                dthNumber,
                operator: dthOperator
            });
            if (response.data && response.data.success) {
                // If it's an array with 1 item, extract the first item
                let info = response.data.data;
                if (Array.isArray(info) && info.length > 0) info = info[0];
                setDthInfo(info);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to connect to server");
        } finally {
            setLoading(false);
        }
    };

    const handleRechargeSubmit = async (type: string) => {
        let payload: any = { type };
        
        if (type === 'prepaid') {
            if (!/^[6-9]\d{9}$/.test(mobileNumber) || !prepaidAmount || !prepaidPin) {
                toast.error("Enter mobile number, amount and transaction PIN.");
                return;
            }
            if (!resolvedOperator || !resolvedCircle) {
                toast.error("Please browse plans first so the operator and circle can be detected.");
                return;
            }
            payload = { ...payload, mobileNumber, operator: resolvedOperator, circle: resolvedCircle, amount: prepaidAmount, pin: prepaidPin };
        } else {
            if (!dthNumber.trim() || !dthOperator || !dthAmount || !dthPin || Number(dthAmount) < 10) {
                toast.error("Please fill all fields.");
                return;
            }
            payload = { ...payload, dthNumber: dthNumber.trim(), operator: dthOperator, amount: dthAmount, pin: dthPin };
        }

        setLoading(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/recharge/do-recharge`, payload);
            
            if (response.data && response.data.success) {
                const selectedOp = type === 'prepaid'
                    ? null
                    : dthOperators.find((op: any) => op.id.toString() === dthOperator?.toString());
                const opName = type === 'prepaid'
                    ? response.data.data?.operatorname || response.data.data?.operator || resolvedOperator
                    : selectedOp?.name || "Unknown";
                const resData = response.data.data || {};

                // The provider accepts a recharge before the operator confirms it, so a
                // successful response is not the same as a successful recharge — the
                // receipt must not claim SUCCESS while it is still pending.
                setReceiptData({
                    transactionId: resData.transactionId || resData.ackno || resData.refid || 'TXN' + Date.now(),
                    status: response.data.pending || String(resData.status).toUpperCase() === 'PENDING'
                        ? 'PENDING'
                        : resData.status === false || resData.response_code === 0 ? 'FAILED' : 'SUCCESS',
                    operatorRef: resData.opr_txn_id || resData.operatorid || resData.operator_ref || 'N/A',
                    date: new Date().toISOString(),
                    amount: type === 'prepaid' ? prepaidAmount : dthAmount,
                    number: type === 'prepaid' ? mobileNumber : dthNumber,
                    operator: opName,
                    type: type
                });
                setShowReceiptModal(true);
                window.dispatchEvent(new Event('wallet-updated'));
                if (type === 'prepaid') {
                    setMobileNumber(""); setPrepaidAmount(""); setPrepaidPin("");
                } else {
                    setDthNumber(""); setDthAmount(""); setDthPin(""); setDthInfo(null);
                }
                // Refresh history after recharge
                fetchHistory();
            }
        } catch (error: any) {
            console.error("AXIOS ERROR:", error);
            console.log("AXIOS RESPONSE:", error.response);
            const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to process recharge";
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const statusPill = (status?: string) =>
        status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
            : status === 'PENDING' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20';

    const amountAndPin = (type: 'prepaid' | 'dth') => {
        const amount = type === 'prepaid' ? prepaidAmount : dthAmount;
        const setAmount = type === 'prepaid' ? setPrepaidAmount : setDthAmount;
        const pin = type === 'prepaid' ? prepaidPin : dthPin;
        const setPin = type === 'prepaid' ? setPrepaidPin : setDthPin;
        return (
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Payment</h3>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">Amount</label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">₹</span>
                            <input
                                type="number"
                                min="10"
                                step="1"
                                inputMode="numeric"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                placeholder="0"
                                className={`${INPUT} pl-8 text-lg font-semibold tabular-nums`}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">Transaction PIN</label>
                        <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={pin}
                                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="••••"
                                className={`${INPUT} pl-10 text-lg tracking-[0.5em]`}
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => handleRechargeSubmit(type)}
                        disabled={loading}
                        className={`flex items-center justify-center gap-2 rounded-xl px-8 py-3 font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                        Recharge{Number(amount) > 0 ? ` ₹${amount}` : ''}
                    </button>
                </div>
            </section>
        );
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Smartphone className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Recharge</h1>
                            <p className="text-sm text-muted-foreground">Instant prepaid mobile and DTH recharges.</p>
                        </div>
                    </div>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-background/60 backdrop-blur p-1.5 w-full md:w-max">
                        {([
                            ['prepaid', 'Prepaid', Smartphone],
                            ['dth', 'DTH', Tv],
                            ['history', 'History', Clock],
                        ] as const).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2 text-sm font-medium transition-all ${activeTab === key ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* PREPAID TAB */}
            {activeTab === 'prepaid' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-semibold">Mobile Prepaid Recharge</h3>
                        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">+91</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="10-digit mobile number"
                                        value={mobileNumber}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 10) {
                                                toast.error("Mobile number cannot exceed 10 digits");
                                                return;
                                            }
                                            setMobileNumber(val);
                                            setResolvedOperator("");
                                            setResolvedCircle("");
                                        }}
                                        className={`${INPUT} pl-12 text-lg font-semibold tracking-wider tabular-nums`}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleBrowsePlan}
                                disabled={loading || !/^[6-9]\d{9}$/.test(mobileNumber)}
                                className="flex items-center justify-center gap-2 rounded-xl border bg-background px-6 py-3 font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
                                Browse Plans
                            </button>
                        </div>

                        {resolvedOperator && resolvedCircle && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {([
                                    ['Detected operator', resolvedOperator, Radio],
                                    ['Customer circle', resolvedCircle, MapPin],
                                ] as const).map(([label, value, Icon]) => (
                                    <div key={label} className="flex items-center gap-3 rounded-xl border bg-background/50 p-3">
                                        <div className={`rounded-lg p-2 ${SILVER_TILE}`}><Icon className="h-4 w-4" /></div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                                            <p className="truncate text-sm font-semibold">{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                    {amountAndPin('prepaid')}
                </div>
            )}

            {/* DTH TAB */}
            {activeTab === 'dth' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                    <section className="rounded-2xl border bg-card p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-semibold">DTH Recharge</h3>
                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">DTH Number</label>
                                <div className="relative">
                                    <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        inputMode="text"
                                        maxLength={20}
                                        placeholder="Enter DTH Number"
                                        value={dthNumber}
                                        onChange={e => setDthNumber(e.target.value)}
                                        className={`${INPUT} pl-10 font-semibold tracking-wider`}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">DTH Operator</label>
                                <div className="relative">
                                    <Tv className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <select
                                        value={dthOperator}
                                        onChange={e => setDthOperator(e.target.value)}
                                        className={`${INPUT} pl-10`}
                                    >
                                        <option value="">Select DTH Operator</option>
                                        {dthOperators.map((op: any) => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleFetchDthInfo}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 rounded-xl border bg-background px-6 py-3 font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Fetch Details
                            </button>
                        </div>

                        {dthInfo && (
                            <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {[
                                    ['Name', dthInfo.customerName || '-'],
                                    ['Balance', `₹ ${dthInfo.Balance || 0}`],
                                    ['Plan', dthInfo.planName || '-'],
                                    ['Next Recharge', dthInfo.NextRechargeDate || '-'],
                                    ['Status', dthInfo.status || 'Active'],
                                    ['Monthly', `₹ ${dthInfo.MonthlyRecharge || 0}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border bg-background/50 p-3">
                                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                                        <p className={`truncate text-sm font-semibold ${label === 'Status' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{value}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                    {amountAndPin('dth')}
                </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
                <section className="rounded-2xl border bg-card p-6 shadow-sm animate-in fade-in duration-300">
                    <h3 className="mb-4 text-lg font-semibold">Recharge History</h3>
                    <div className="w-full overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-black/[0.03] dark:bg-white/[0.04]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">No.</th>
                                    <th className="px-4 py-3 font-semibold">Date Time</th>
                                    <th className="px-4 py-3 font-semibold">Mobile</th>
                                    <th className="px-4 py-3 font-semibold">Operator</th>
                                    <th className="px-4 py-3 font-semibold">Reference Id</th>
                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                    <th className="px-4 py-3 font-semibold">Discount</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.length > 0 ? history.map((item: any, idx) => (
                                    <tr key={item._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</td>
                                        <td className="px-4 py-3 font-medium tabular-nums">{item.metadata?.number}</td>
                                        <td className="px-4 py-3">{item.metadata?.operator}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.transactionId}</td>
                                        <td className="px-4 py-3 font-semibold tabular-nums">₹ {item.amount}</td>
                                        <td className="px-4 py-3 text-muted-foreground">0</td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => {
                                                    setReceiptData({
                                                        transactionId: item.transactionId,
                                                        status: item.status,
                                                        operatorRef: item.metadata?.operatorRef,
                                                        date: item.createdAt,
                                                        amount: item.amount,
                                                        number: item.metadata?.number,
                                                        operator: item.metadata?.operator,
                                                        type: item.metadata?.rechargeType?.toLowerCase() === 'dth' ? 'dth' : 'prepaid'
                                                    });
                                                    setShowReceiptModal(true);
                                                }}
                                                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                                            >
                                                <ReceiptText className="h-3.5 w-3.5" />
                                                Receipt
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                                            No recharge transaction found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Plans Modal */}
            {showPlansModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3 min-w-0">
                                {planMeta?.logo ? <img src={planMeta.logo} alt={planMeta.operatorName || 'Operator'} className="w-10 h-10 rounded-full object-contain bg-white border border-border p-1" /> : <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Smartphone className="h-5 w-5" /></div>}
                                <div className="min-w-0">
                                    <h3 className="font-bold text-lg truncate">Available Plans for {mobileNumber}</h3>
                                    <p className="text-xs text-muted-foreground truncate">{planMeta?.operatorName || 'Operator'} {planMeta?.circleName ? `· ${planMeta.circleName}` : ''}</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowPlansModal(false); setPlanSearch(""); }} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="px-4 pt-4">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Search by amount or validity (e.g., 299 or 28 Days)" 
                                    value={planSearch}
                                    onChange={(e) => setPlanSearch(e.target.value)}
                                    className={`${INPUT} pl-10`}
                                />
                            </div>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
                            {plans.filter((p: any) => 
                                (p.amount && p.amount.toString().toLowerCase().includes(planSearch.toLowerCase())) || 
                                (p.validity && p.validity.toString().toLowerCase().includes(planSearch.toLowerCase()))
                            ).map((plan: any, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-xl bg-background/50 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition-all gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-2xl font-black text-foreground">₹ {plan.amount}</span>
                                        <div className="flex gap-2">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border text-muted-foreground">{plan.category || 'Plan'}</span>
                                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Validity: {plan.validity}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 text-sm text-muted-foreground">
                                        {plan.description}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setPrepaidAmount(plan.amount);
                                            setShowPlansModal(false);
                                        }}
                                        className={`px-5 py-2 rounded-xl font-semibold whitespace-nowrap ${ACTIVE_BUTTON}`}
                                    >
                                        Select
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                Transaction Receipt
                            </h3>
                            <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div id="receipt-content" className="p-6 flex flex-col gap-4" style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
                            {/* Receipt content styling */}
                            <div className="flex flex-col items-center gap-2 pb-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <img src={logo} alt="Shahparpay" className="w-48 h-auto max-h-24 object-contain" crossOrigin="anonymous" />
                                <h2 className="text-xl font-bold mt-2" style={{ color: '#1f2937' }}>Shahparpay Pvt. Ltd.</h2>
                                <p className="text-sm" style={{ color: '#6b7280' }}>{receiptData.status === 'PENDING' ? 'Recharge Pending' : 'Recharge Successful'}</p>
                            </div>
                            <div className="flex flex-col gap-3 py-2">
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Status</span>
                                    <span className="font-bold" style={{ color: receiptData.status === 'SUCCESS' ? '#16a34a' : '#ca8a04' }}>{receiptData.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Amount</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>₹ {receiptData.amount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Number</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Operator</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.operator}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Transaction ID</span>
                                    <span className="font-bold text-xs my-auto" style={{ color: '#1f2937' }}>{receiptData.transactionId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Operator Ref</span>
                                    <span className="font-bold" style={{ color: '#1f2937' }}>{receiptData.operatorRef || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <span className="font-medium text-sm" style={{ color: '#6b7280' }}>Date</span>
                                    <span className="font-bold text-xs text-right max-w-[150px]" style={{ color: '#1f2937' }}>{new Date(receiptData.date || Date.now()).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="pt-2 text-center text-xs" style={{ borderTop: '1px solid #e5e7eb', color: '#9ca3af' }}>
                                <p>This is a computer-generated receipt and does not require a physical signature.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/30 flex gap-4">
                            <button 
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-2.5 rounded-xl border bg-background hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition-colors"
                            >
                                Close
                            </button>
                            <button 
                                onClick={downloadReceipt}
                                className={`flex-1 py-2.5 rounded-xl font-semibold ${ACTIVE_BUTTON}`}
                            >
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recharge;
