import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XCircle, Clock, Smartphone, Tv, Search, Lock, Loader2, Zap, ListFilter, Radio, MapPin, Hash, ReceiptText } from "lucide-react";
import axios from "axios";
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import logo from '../assets/logo.png';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SlidingNumber } from '../components/animate-ui/primitives/texts/sliding-number';
import PrimaryCta, { PILL_HIGHLIGHT } from '../components/PrimaryCta';
import Lottie from '../components/Lottie';
import { Highlight, HighlightItem } from '../components/animate-ui/primitives/effects/highlight';
import PortalDialog from '../components/PortalDialog';
import { TitleText } from '../components/BlurText';
import { txnRef } from "@/lib/txnRef";

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

/** One numbered step of the form: a dot, a title and a hint, then its fields indented under it. */
const Step = ({ n, title, hint, last = false, children }: { n: number; title: string; hint?: string; last?: boolean; children: React.ReactNode }) => (
    <div className="relative pl-10">
        {/* The rail joining this step to the next. */}
        {!last && <span aria-hidden className="absolute left-[13px] top-8 bottom-[-1.25rem] w-px bg-border" />}
        <span aria-hidden className="absolute left-0 top-0 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">{n}</span>
        <p className="text-sm font-semibold leading-7">{title}</p>
        {hint && <p className="-mt-0.5 mb-3 text-xs text-muted-foreground">{hint}</p>}
        {!hint && <div className="mb-3" />}
        {children}
    </div>
);

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
                    transactionId: resData.orderId || resData.transactionId || resData.ackno || resData.refid || 'TXN' + Date.now(),
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
                    setDthNumber(""); setDthAmount(""); setDthPin("");
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

    const isDth = (item: any) => String(item.metadata?.mode || item.metadata?.rechargeType || '').toLowerCase() === 'dth';
    const numberOf = (item: any) => String(item.metadata?.caNumber || item.metadata?.number || '');
    // The last few distinct numbers recharged successfully, newest first: one tap fills them in.
    const recents = (type: 'prepaid' | 'dth') => {
        const seen = new Set<string>();
        return history
            .filter((item: any) => item.status === 'SUCCESS' && isDth(item) === (type === 'dth') && numberOf(item))
            .filter((item: any) => !seen.has(numberOf(item)) && seen.add(numberOf(item)))
            .slice(0, 4);
    };
    const fillRecent = (type: 'prepaid' | 'dth', item: any) => {
        const num = numberOf(item);
        if (type === 'prepaid') {
            setMobileNumber(num.replace(/\D/g, '').slice(-10));
            setResolvedOperator("");
            setResolvedCircle("");
        } else {
            setDthNumber(num);
            const name = String(item.metadata?.operatorName || item.metadata?.operator || '').toLowerCase();
            const op = dthOperators.find((o: any) => String(o.name).toLowerCase() === name);
            if (op) setDthOperator(String(op.id));
        }
    };

    /** Steps 2 and 3 and the button, the same for prepaid and DTH. */
    const payment = (type: 'prepaid' | 'dth') => {
        const amount = type === 'prepaid' ? prepaidAmount : dthAmount;
        const setAmount = type === 'prepaid' ? setPrepaidAmount : setDthAmount;
        const pin = type === 'prepaid' ? prepaidPin : dthPin;
        const setPin = type === 'prepaid' ? setPrepaidPin : setDthPin;
        return (
            <>
                <Step n={2} title="Amount" hint={type === 'prepaid' ? 'Pick a plan, or type the plan amount' : 'The amount to add to the DTH account'}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">₹</span>
                            <input
                                type="number"
                                min="10"
                                step="1"
                                inputMode="numeric"
                                aria-label="Amount"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                placeholder="0"
                                className={cn(INPUT, 'h-14 pl-10 text-2xl font-bold tabular-nums')}
                            />
                        </div>
                        {type === 'prepaid' && resolvedOperator && (
                            <button type="button" onClick={() => setShowPlansModal(true)} className="flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">
                                <ListFilter className="h-4 w-4" /> See plans
                            </button>
                        )}
                    </div>
                </Step>
                <Step n={3} title="Transaction PIN" hint="Your 4-digit PIN confirms the payment" last>
                    <div className="relative max-w-[240px]">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            aria-label="Transaction PIN"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            onKeyDown={e => { if (e.key === 'Enter' && !loading) handleRechargeSubmit(type); }}
                            placeholder="••••"
                            className={cn(INPUT, 'h-12 pl-11 text-lg tracking-[0.5em]')}
                        />
                    </div>
                </Step>
                <PrimaryCta
                    onClick={() => handleRechargeSubmit(type)}
                    disabled={loading}
                    className="mt-2 w-full font-bold"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                    Recharge{Number(amount) > 0 && <> ₹<SlidingNumber initiallyStable number={Number(amount)} decimalPlaces={Number.isInteger(Number(amount)) ? 0 : 2} /></>}
                </PrimaryCta>
            </>
        );
    };

    /** The side panel: what is about to be paid, and the numbers recharged lately. */
    const summary = (type: 'prepaid' | 'dth') => {
        const amount = Number(type === 'prepaid' ? prepaidAmount : dthAmount) || 0;
        const dthName = dthOperators.find((o: any) => String(o.id) === dthOperator)?.name;
        const rows: [string, string | null, string][] = type === 'prepaid'
            ? [
                ['Mobile', /^[6-9]\d{9}$/.test(mobileNumber) ? `+91 ${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}` : null, 'Enter the number'],
                ['Operator', resolvedOperator || null, 'Found when you browse plans'],
                ['Circle', resolvedCircle || null, 'Found when you browse plans'],
            ]
            : [
                ['DTH number', dthNumber.trim() || null, 'Enter the number'],
                ['Operator', dthName || null, 'Choose the operator'],
            ];
        const recent = recents(type);
        return (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                    <dl className="mt-3 space-y-2.5 text-sm">
                        {rows.map(([label, value, empty]) => (
                            <div key={label} className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className={`truncate text-right ${value ? 'font-semibold' : 'text-xs text-muted-foreground/70'}`}>{value || empty}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-4 flex items-baseline justify-between border-t border-dashed pt-4">
                        <span className="text-sm font-medium">You pay</span>
                        <span className="text-2xl font-bold tabular-nums">₹{amount > 0 ? <SlidingNumber initiallyStable number={amount} decimalPlaces={Number.isInteger(amount) ? 0 : 2} /> : '0'}</span>
                    </div>
                    <p className="mt-1 text-right text-xs text-muted-foreground">From your Utility Wallet</p>
                </section>

                {recent.length > 0 && (
                    <section className="rounded-2xl border bg-card p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recharged lately</p>
                        <ul className="mt-3 space-y-1">
                            {recent.map((item: any) => (
                                <li key={item._id}>
                                    <button
                                        type="button"
                                        onClick={() => fillRecent(type, item)}
                                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/[0.04] active:scale-[0.99] dark:hover:bg-white/[0.05]"
                                    >
                                        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}>
                                            {type === 'prepaid' ? <Smartphone className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold tabular-nums">{numberOf(item)}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{item.metadata?.operatorName || item.metadata?.operator || 'Recharge'}</span>
                                        </span>
                                        <span className="text-sm font-semibold tabular-nums">₹{item.amount}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </aside>
        );
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Smartphone className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="Recharge" /></h1>
                            <p className="text-sm text-muted-foreground">Instant prepaid mobile and DTH recharges.</p>
                        </div>
                    </div>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border bg-background/60 backdrop-blur p-1.5 w-full md:w-max">
                        <Highlight controlledItems value={activeTab} click={false} className={PILL_HIGHLIGHT}>
                        {([
                            ['prepaid', 'Prepaid', Smartphone],
                            ['dth', 'DTH', Tv],
                            ['history', 'History', Clock],
                        ] as const).map(([key, label, Icon]) => (
                            <HighlightItem key={key} value={key}>
                            <button
                                onClick={() => setActiveTab(key)}
                                aria-pressed={activeTab === key}
                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2 text-sm font-medium transition-colors ${activeTab === key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                            </HighlightItem>
                        ))}
                        </Highlight>
                    </div>
                </div>
            </section>

            {/* PREPAID TAB: the form in numbered steps, the summary beside it. */}
            {activeTab === 'prepaid' && (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] animate-in fade-in duration-300">
                    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-semibold">Mobile prepaid recharge</h2>
                        <Step n={1} title="Mobile number" hint="Then browse plans: that finds the operator and circle">
                            <div className="relative">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">+91</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    aria-label="Mobile number"
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
                                    onKeyDown={e => { if (e.key === 'Enter' && /^[6-9]\d{9}$/.test(mobileNumber) && !loading) handleBrowsePlan(); }}
                                    className={cn(INPUT, 'h-14 pl-14 pr-40 text-lg font-semibold tracking-wider tabular-nums')}
                                />
                                {/* Browse Plans sits in the field: it is the next thing to do with the number. */}
                                <button
                                    type="button"
                                    onClick={handleBrowsePlan}
                                    disabled={loading || !/^[6-9]\d{9}$/.test(mobileNumber)}
                                    className={`absolute inset-y-2 right-2 flex items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity disabled:opacity-40 ${ACTIVE_BUTTON}`}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
                                    Browse plans
                                </button>
                            </div>
                            {resolvedOperator && resolvedCircle && (
                                <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                    {([[resolvedOperator, Radio], [resolvedCircle, MapPin]] as const).map(([value, Icon]) => (
                                        <span key={value} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-xs font-semibold">
                                            <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {value}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Step>
                        {payment('prepaid')}
                    </section>
                    {summary('prepaid')}
                </div>
            )}

            {/* DTH TAB: same shape as prepaid. */}
            {activeTab === 'dth' && (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] animate-in fade-in duration-300">
                    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-semibold">DTH recharge</h2>
                        <Step n={1} title="DTH account" hint="The subscriber or VC number, and the operator">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="relative">
                                    <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        inputMode="text"
                                        maxLength={20}
                                        aria-label="DTH number"
                                        placeholder="DTH number"
                                        value={dthNumber}
                                        onChange={e => setDthNumber(e.target.value)}
                                        className={cn(INPUT, 'h-12 pl-11 font-semibold tracking-wider')}
                                    />
                                </div>
                                <div className="relative">
                                    <Tv className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Select value={dthOperator} onValueChange={setDthOperator}>
                                        <SelectTrigger aria-label="DTH operator" className={cn(INPUT, 'h-12 pl-11 data-[size=default]:h-12')}>
                                            <SelectValue placeholder="Select operator" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[110]">
                                            {dthOperators.map((op: any) => (
                                                <SelectItem key={op.id} value={String(op.id)}>{op.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Step>
                        {payment('dth')}
                    </section>
                    {summary('dth')}
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
                                        <td className="px-4 py-3 font-medium tabular-nums">{item.metadata?.caNumber || item.metadata?.number}</td>
                                        <td className="px-4 py-3">{item.metadata?.operatorName || item.metadata?.operator}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{txnRef(item)}</td>
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
                                                        transactionId: txnRef(item),
                                                        status: item.status,
                                                        operatorRef: item.metadata?.operatorTxnId || item.metadata?.operatorRef,
                                                        date: item.createdAt,
                                                        amount: item.amount,
                                                        number: item.metadata?.caNumber || item.metadata?.number,
                                                        operator: item.metadata?.operatorName || item.metadata?.operator,
                                                        type: String(item.metadata?.mode || item.metadata?.rechargeType || '').toLowerCase() === 'dth' ? 'dth' : 'prepaid'
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
                                            <div className="flex justify-center"><Lottie name="empty" size={96} /></div>
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
                <PortalDialog label="Recharge plans" onClose={() => { setShowPlansModal(false); setPlanSearch(""); }}>
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
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
                                    className={cn(INPUT, 'pl-10')}
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
                </PortalDialog>
            )}

            {/* Receipt Modal */}
            {showReceiptModal && receiptData && (
                <PortalDialog label="Recharge receipt" onClose={() => setShowReceiptModal(false)}>
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
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
                                <img src={logo} alt="Shahparpay" className="w-64 max-w-full h-auto object-contain" crossOrigin="anonymous" />
                                <h2 className="text-xl font-bold mt-2" style={{ color: '#1f2937' }}>Shahparpay Pvt. Ltd.</h2>
                                <p className="text-sm" style={{ color: '#6b7280' }}>{receiptData.status === 'PENDING' ? 'Recharge Pending' : receiptData.status === 'FAILED' ? 'Recharge Failed' : 'Recharge Successful'}</p>
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
                </PortalDialog>
            )}
        </div>
    );
};

export default Recharge;
