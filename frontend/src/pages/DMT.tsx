import { useState } from 'react';
import { Search, UserPlus, Send, Plus, CreditCard, Lock, CheckCircle2, X, Trash, ShieldCheck, Clock, Loader2, Smartphone, User, Landmark } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/animate-ui/components/radix/alert-dialog';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { CopyButton } from '../components/animate-ui/components/buttons/copy';
import { SlidingNumber } from '../components/animate-ui/primitives/texts/sliding-number';
import PrimaryCta, { Busy } from '../components/PrimaryCta';
import Lottie, { Confetti } from '../components/Lottie';
import PortalDialog from '../components/PortalDialog';
import { TitleText } from '../components/BlurText';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

/**
 * Domestic money transfer.
 *
 * There is no remitter to register on this rail: a beneficiary carries the
 * sender's mobile number itself and is activated by an OTP sent to that number.
 * Only a verified beneficiary can be paid, so the OTP step is part of adding
 * one rather than a separate screen.
 */
const DMT = () => {
    const { token } = useAuth();

    const [mobile, setMobile] = useState('');
    // The sender the list below belongs to. Set once the mobile is searched, so
    // typing a new number does not silently repoint an open transfer.
    const [sender, setSender] = useState('');
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [showAddBene, setShowAddBene] = useState(false);
    const [beneData, setBeneData] = useState({ benename: '', beneaccount: '', confirmAccount: '', ifsc: '' });

    // The beneficiary an OTP is currently being collected for, and what that OTP
    // is meant to do — activating a new one, or authorising a deletion.
    const [otpFor, setOtpFor] = useState<{ bene: any; action: 'verify' | 'delete' } | null>(null);
    // The beneficiary the delete dialog is asking about, before any OTP is sent.
    const [confirmDelete, setConfirmDelete] = useState<any>(null);
    const [otp, setOtp] = useState('');

    const [transferBene, setTransferBene] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [transferMode, setTransferMode] = useState('IMPS');
    const [pin, setPin] = useState('');
    const [successTxn, setSuccessTxn] = useState<any>(null);
    const [bankVerification, setBankVerification] = useState<any>(null);

    const api = `${import.meta.env.VITE_BACKEND_URL}/api/dmt`;
    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    const fetchBeneficiaries = async (mob: string) => {
        try {
            const res = await axios.post(`${api}/beneficiary/fetch`, { mobile: mob }, getHeaders());
            setBeneficiaries(res.data.success ? res.data.data || [] : []);
            return res.data.success;
        } catch (error: any) {
            setBeneficiaries([]);
            toast.error(error.response?.data?.message || 'Failed to fetch beneficiaries');
            return false;
        }
    };

    const handleSearch = async () => {
        if (mobile.length !== 10) return toast.error('Enter valid 10-digit mobile number');
        setLoading(true);
        const ok = await fetchBeneficiaries(mobile);
        // The transfer step is inline now: a beneficiary of the previous sender must not stay selected.
        if (ok) { setSender(mobile); setTransferBene(null); }
        setLoading(false);
    };

    const handleAddBeneficiary = async () => {
        const { benename, beneaccount, confirmAccount, ifsc } = beneData;
        if (!benename || !beneaccount || !ifsc) return toast.error('Please fill all beneficiary details');
        // Caught here rather than at the bank: a typo in an account number sends
        // the money to a real stranger, and no refund follows.
        if (beneaccount !== confirmAccount) return toast.error('Account numbers do not match');
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return toast.error('Enter a valid IFSC code');

        setLoading(true);
        try {
            const res = await axios.post(`${api}/beneficiary/add`, { mobile: sender, benename, beneaccount, ifsc }, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || 'Beneficiary added');
                setBankVerification(res.data.data?.bankVerification || null);
                setShowAddBene(false);
                setBeneData({ benename: '', beneaccount: '', confirmAccount: '', ifsc: '' });
                await fetchBeneficiaries(sender);
                // A beneficiary is not payable until it is verified, so the OTP is
                // requested straight away rather than left for the retailer to find.
                if (res.data.data?.id) requestOtp({ ...res.data.data }, 'verify');
            } else {
                toast.error(res.data.message || 'Failed to add beneficiary');
            }
        } catch (error: any) {
            setBankVerification(error.response?.data?.data?.bankVerification || null);
            toast.error(error.response?.data?.message || 'Failed to add beneficiary');
        } finally {
            setLoading(false);
        }
    };

    const requestOtp = async (bene: any, action: 'verify' | 'delete') => {
        setOtp('');
        setOtpFor({ bene, action });
        try {
            const otpPath = action === 'delete' ? 'beneficiary/delete-otp' : 'beneficiary/otp';
            const body = { beneficiary_id: bene.id };
            const res = await axios.post(`${api}/${otpPath}`, body, getHeaders());
            if (res.data.success) {
                const expiry = res.data.expiresIn ? ` Valid for ${Math.ceil(Number(res.data.expiresIn) / 60)} minutes.` : '';
                toast.success(`${res.data.message || 'OTP sent'}${expiry}`);
            }
            else toast.error(res.data.message || 'Failed to send OTP');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        }
    };

    const handleOtpSubmit = async () => {
        if (!otpFor || otp.length !== 6) return toast.error('Enter the 6-digit OTP');
        const { bene, action } = otpFor;
        setLoading(true);
        try {
            const path = action === 'verify' ? 'beneficiary/verify' : 'beneficiary/delete';
            const res = await axios.post(`${api}/${path}`, { beneficiary_id: bene.id, otp }, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || (action === 'verify' ? 'Beneficiary verified' : 'Beneficiary deleted'));
                setOtpFor(null);
                setOtp('');
                if (action === 'delete' && transferBene?.id === bene.id) setTransferBene(null);
                await fetchBeneficiaries(sender);
            } else {
                toast.error(res.data.message || 'That OTP was not accepted');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'That OTP was not accepted');
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!amount || Number(amount) < 10 || pin.length !== 4) return toast.error('Enter an amount of at least ₹10 and a 4-digit PIN');
        setLoading(true);
        try {
            const res = await axios.post(`${api}/transfer`, {
                mobile: sender,
                beneficiary_id: transferBene.id,
                beneaccount: transferBene.account,
                ifsc: transferBene.ifsc,
                amount: Number(amount),
                transfer_mode: transferMode,
                pin,
            }, getHeaders());

            if (res.data.success) {
                // A transfer is accepted before the beneficiary bank confirms it, so
                // the receipt must not claim it landed while it is still pending.
                setSuccessTxn({
                    ...res.data.data,
                    amount: Number(amount),
                    beneficiaryName: transferBene.name,
                    beneficiaryAccount: transferBene.account,
                    pending: !!res.data.pending,
                    message: res.data.message,
                });
                setTransferBene(null);
                setAmount('');
                setPin('');
                window.dispatchEvent(new Event('wallet-updated'));
            } else {
                toast.error(res.data.message || 'Transfer failed');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setLoading(false);
        }
    };

    const initials = (name?: string) =>
        String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
    const verifiedCount = beneficiaries.filter((b) => b.verified).length;

    const DIALOG = 'relative w-full rounded-2xl border bg-card p-6 shadow-2xl';
    // Display only: the full number is what is sent.
    const masked = (acc?: string) => { const a = String(acc || ''); return a.length > 4 ? `•••• ${a.slice(-4)}` : a; };
    const SPRING = { type: 'spring', bounce: 0.18, duration: 0.45 } as const;
    const stepDot = (n: number) => <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n}</span>;
    const canSend = !!transferBene && !!amount && Number(amount) >= 10 && pin.length === 4;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex items-center gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                        <Send className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="Domestic Money Transfer" /></h1>
                        <p className="text-sm text-muted-foreground">Instantly transfer funds to any bank account in India.</p>
                    </div>
                </div>
            </section>

            {bankVerification && (
                <section className="rounded-2xl border border-emerald-500/30 bg-card p-5 shadow-sm animate-in fade-in duration-300">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-foreground">Bank account verification</h2>
                                <p className="text-xs text-muted-foreground">Verification response for the newly added beneficiary</p>
                            </div>
                        </div>
                        <button onClick={() => setBankVerification(null)} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"><X className="w-4 h-4" /></button>
                    </div>
                    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm md:grid-cols-4">
                        {[
                            ['Transaction ID', bankVerification.txnid], ['Status', bankVerification.status],
                            ['Account Name', bankVerification.AccountName], ['Account Number', bankVerification.AccountNumber],
                            ['Account Status', bankVerification.accountStatus], ['Bank', bankVerification.bank_name],
                            ['UTR', bankVerification.utr], ['City', bankVerification.city],
                            ['Branch', bankVerification.branch], ['MICR', bankVerification.micr],
                            ['Response', bankVerification.resText], ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                            ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
                        ].map(([label, value]) => <div key={label} className="bg-background/80 p-3"><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="font-medium text-foreground break-words">{String(value ?? '—')}</dd></div>)}
                    </dl>
                </section>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* The transfer, in three steps: who sends, to whom, how much. */}
                <section className="flex flex-col gap-7 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    {/* 1 Sender */}
                    <div>
                        <label htmlFor="dmt-sender" className="flex items-center gap-2 text-sm font-semibold">{stepDot(1)} Sender mobile number <span className="text-rose-500">*</span></label>
                        <p className="mb-3 ml-8 text-xs text-muted-foreground">Their saved beneficiaries load from this number.</p>
                        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm font-semibold text-muted-foreground">+91</span>
                            <input
                                id="dmt-sender"
                                type="text"
                                inputMode="numeric"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10-digit number"
                                className={cn(INPUT, 'h-14 pl-14 pr-32 text-lg font-semibold tracking-wider tabular-nums')}
                            />
                            <button
                                type="submit"
                                disabled={loading || mobile.length !== 10}
                                className={`absolute inset-y-2 right-2 flex items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity disabled:opacity-40 ${ACTIVE_BUTTON}`}
                            >
                                {loading && !sender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Find
                            </button>
                        </form>
                        {sender && (
                            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300">
                                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 font-semibold text-foreground"><Smartphone className="h-3.5 w-3.5" /> +91 {sender}</span>
                                <span><b className="tabular-nums text-foreground">{beneficiaries.length}</b> beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'} · <b className="tabular-nums text-emerald-600 dark:text-emerald-400">{verifiedCount}</b> verified</span>
                            </p>
                        )}
                    </div>

                    {/* 2 Beneficiary */}
                    <div className={sender ? '' : 'pointer-events-none opacity-50'} aria-disabled={!sender}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="flex items-center gap-2 text-sm font-semibold">{stepDot(2)} Beneficiary</p>
                            {sender && (
                                <button onClick={() => setShowAddBene(true)} className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5">
                                    <Plus className="h-3.5 w-3.5" /> Add beneficiary
                                </button>
                            )}
                        </div>
                        {!sender ? (
                            <p className="ml-8 text-sm text-muted-foreground">Find the sender first.</p>
                        ) : beneficiaries.length === 0 ? (
                            <div className="flex flex-col items-center rounded-2xl border border-dashed py-10 text-center">
                                <div className={`mb-3 rounded-2xl p-3 ${SILVER_TILE}`}><UserPlus className="h-6 w-6" /></div>
                                <p className="font-semibold">No beneficiaries yet</p>
                                <p className="mb-4 max-w-xs text-sm text-muted-foreground">Add a bank account to start transferring money instantly.</p>
                                <button onClick={() => setShowAddBene(true)} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${ACTIVE_BUTTON}`}>
                                    <Plus className="w-4 h-4" /> Add Beneficiary
                                </button>
                            </div>
                        ) : (
                            <ul role="radiogroup" aria-label="Beneficiary" className="stage-list grid gap-2.5 sm:grid-cols-2">
                                {beneficiaries.map((bene) => {
                                    const on = transferBene?.id === bene.id;
                                    return (
                                        <li key={bene.id} className="relative">
                                            <button
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                disabled={!bene.verified}
                                                onClick={() => setTransferBene(bene)}
                                                className={`relative flex w-full items-center gap-3 rounded-xl border p-3.5 pr-11 text-left transition-all active:scale-[0.99] disabled:cursor-default disabled:active:scale-100 ${on ? 'border-transparent bg-background' : 'bg-background/50 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md'}`}
                                            >
                                                {/* The ring slides to the chosen beneficiary. */}
                                                {on && <motion.span layoutId="dmt-bene" aria-hidden transition={SPRING} className="absolute inset-0 rounded-xl ring-2 ring-primary" />}
                                                <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${on ? ACTIVE_BUTTON : SILVER_TILE}`}>{initials(bene.name)}</span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="truncate text-sm font-semibold">{bene.name}</span>
                                                        {bene.verified
                                                            ? <CheckCircle2 aria-label="Verified" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                            : <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">Unverified</span>}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">{bene.bank || 'Bank'} · <span className="font-mono">{masked(bene.account)}</span></span>
                                                </span>
                                            </button>
                                            {!bene.verified && (
                                                <button
                                                    onClick={() => requestOtp(bene, 'verify')}
                                                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                                                >
                                                    <ShieldCheck className="h-3.5 w-3.5" /> Verify with OTP
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setConfirmDelete(bene)}
                                                aria-label={`Delete ${bene.name}`}
                                                title="Delete Beneficiary"
                                                className="absolute right-2 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-60 hover:bg-rose-500/10 hover:text-rose-600 hover:opacity-100 dark:hover:text-rose-400"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* 3 Amount, mode, PIN */}
                    <div className={transferBene ? '' : 'pointer-events-none opacity-50'} aria-disabled={!transferBene}>
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">{stepDot(3)} Amount and PIN</p>
                        {!transferBene ? (
                            <p className="ml-8 text-sm text-muted-foreground">Choose a verified beneficiary.</p>
                        ) : (
                            <div className="grid gap-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                <div>
                                    <label htmlFor="dmt-amount" className="text-sm font-medium">Amount <span className="text-rose-500">*</span></label>
                                    <div className="relative mt-1.5">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
                                        <input
                                            id="dmt-amount"
                                            type="text"
                                            inputMode="numeric"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
                                            placeholder="0"
                                            className={cn(INPUT, 'h-16 pl-11 text-3xl font-bold tabular-nums')}
                                        />
                                    </div>
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        {[500, 1000, 2000, 5000].map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setAmount(String(v))}
                                                aria-pressed={amount === String(v)}
                                                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-all active:scale-95 ${amount === String(v) ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            >
                                                ₹{v.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">At least ₹10.</p>
                                </div>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <p id="dmt-mode" className="text-sm font-medium">Transfer mode</p>
                                        <div role="radiogroup" aria-labelledby="dmt-mode" className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                                            {['IMPS', 'NEFT'].map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={transferMode === m}
                                                    onClick={() => setTransferMode(m)}
                                                    className={`relative rounded-lg py-2 text-sm font-semibold transition-colors ${transferMode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {transferMode === m && <motion.span layoutId="dmt-mode" aria-hidden transition={SPRING} className="absolute inset-0 rounded-lg bg-primary" />}
                                                    <span className="relative">{m}<span className="ml-1.5 text-[11px] font-medium opacity-70">{m === 'IMPS' ? 'Instant' : 'Batch'}</span></span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="dmt-pin" className="flex items-center gap-1.5 text-sm font-medium"><Lock className="h-3.5 w-3.5 text-muted-foreground" /> 4-digit PIN <span className="text-rose-500">*</span></label>
                                        <input
                                            id="dmt-pin"
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            value={pin}
                                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={e => { if (e.key === 'Enter' && canSend && !loading) handleTransfer(); }}
                                            placeholder="••••"
                                            className={cn(INPUT, 'mt-1.5 h-[46px] text-center text-xl font-bold tracking-[0.8em]')}
                                        />
                                    </div>
                                </div>
                                <PrimaryCta onClick={handleTransfer} disabled={loading || !canSend} className="w-full text-base font-bold">
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    {loading ? <Busy text="Processing..." /> : Number(amount) >= 10
                                        ? <>Send ₹{Number(amount).toLocaleString('en-IN')} to {String(transferBene.name || '').split(/\s+/)[0] || 'beneficiary'}</>
                                        : 'Confirm Transfer'}
                                </PrimaryCta>
                            </div>
                        )}
                    </div>
                </section>

                {/* Live summary of the transfer; before a sender, how it works. */}
                <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                    <section className="rounded-2xl border bg-card p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                        <dl className="mt-3 space-y-2.5 text-sm">
                            {([
                                ['Sender', sender ? `+91 ${sender}` : null, 'Find the sender'],
                                ['Beneficiary', transferBene?.name || null, 'Choose one'],
                                ['Bank', transferBene ? (transferBene.bank || transferBene.ifsc || null) : null, '—'],
                                ['Account', transferBene ? masked(transferBene.account) : null, '—'],
                                ['IFSC', transferBene?.ifsc || null, '—'],
                                ['Mode', transferBene ? transferMode : null, '—'],
                            ] as [string, string | null, string][]).map(([label, value, empty]) => (
                                <div key={label} className="flex items-baseline justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className={`truncate text-right ${value ? 'font-semibold' : 'text-xs text-muted-foreground/70'} ${label === 'Account' || label === 'IFSC' ? 'font-mono' : ''}`}>{value || empty}</dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-4 flex items-baseline justify-between border-t border-dashed pt-4">
                            <span className="text-sm font-medium">Total deducted</span>
                            <span className="text-2xl font-bold tabular-nums">₹{Number(amount) > 0 ? <SlidingNumber initiallyStable number={Number(amount)} thousandSeparator="," /> : '0'}</span>
                        </div>
                    </section>
                    {!sender && (
                        <section className="rounded-2xl border bg-card p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
                            <ol className="mt-3 space-y-3">
                                {[
                                    { icon: Smartphone, title: 'Find sender', text: 'Search by mobile number' },
                                    { icon: ShieldCheck, title: 'Verify beneficiary', text: 'Activate with an OTP' },
                                    { icon: Send, title: 'Send money', text: 'IMPS or NEFT with your PIN' },
                                ].map(({ icon: Icon, title, text }) => (
                                    <li key={title} className="flex items-center gap-3">
                                        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                        <span>
                                            <span className="block text-sm font-semibold">{title}</span>
                                            <span className="block text-xs text-muted-foreground">{text}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </aside>
            </div>

            {/* Add Beneficiary */}
            {showAddBene && (
                <PortalDialog label="Add beneficiary" onClose={() => setShowAddBene(false)}>
                    <div className={`${DIALOG} max-w-md`}>
                        <button onClick={() => setShowAddBene(false)} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="mb-5 flex items-center gap-3">
                            <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}>
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Add Beneficiary</h2>
                                <p className="text-sm text-muted-foreground">For sender +91 {sender} · ₹4 account verification from Utility Wallet</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {[
                                { label: 'Account Holder Name', icon: User, value: beneData.benename, set: (v: string) => setBeneData({ ...beneData, benename: v }), extra: '' },
                                { label: 'Account Number', icon: CreditCard, value: beneData.beneaccount, set: (v: string) => setBeneData({ ...beneData, beneaccount: v.replace(/\D/g, '') }), extra: 'font-mono tracking-wider' },
                                { label: 'Confirm Account Number', icon: CreditCard, value: beneData.confirmAccount, set: (v: string) => setBeneData({ ...beneData, confirmAccount: v.replace(/\D/g, '') }), extra: 'font-mono tracking-wider' },
                                { label: 'IFSC Code', icon: Landmark, value: beneData.ifsc, set: (v: string) => setBeneData({ ...beneData, ifsc: v.toUpperCase() }), extra: 'font-mono uppercase' },
                            ].map(({ label, icon: Icon, value, set, extra }, i) => (
                                <div key={label} className="flex flex-col gap-1.5">
                                    <label htmlFor={`dmt-bene-${i}`} className="text-sm font-medium text-foreground">{label} <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input id={`dmt-bene-${i}`} type="text" value={value} onChange={e => set(e.target.value)} className={cn(INPUT, 'h-11 pl-10', extra)} />
                                    </div>
                                    {label === 'Confirm Account Number' && beneData.confirmAccount && (
                                        <p className={`text-xs font-medium ${beneData.confirmAccount === beneData.beneaccount ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {beneData.confirmAccount === beneData.beneaccount ? 'Account numbers match' : 'Account numbers do not match'}
                                        </p>
                                    )}
                                </div>
                            ))}
                            <button onClick={handleAddBeneficiary} disabled={loading} className={`w-full rounded-xl py-3 font-semibold mt-2 disabled:opacity-50 ${ACTIVE_BUTTON}`}>
                                {loading ? 'Adding...' : 'Add Beneficiary'}
                            </button>
                        </div>
                    </div>
                </PortalDialog>
            )}

            {/* animate-ui AlertDialog: deleting a beneficiary asks first, then sends the OTP. */}
            <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
                <AlertDialogContent className="rounded-2xl border-border bg-popover">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {confirmDelete?.name || 'this beneficiary'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            We will send an OTP to +91 {sender} to confirm. Once deleted, you will need to add and verify this account again to send money to it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => requestOtp(confirmDelete, 'delete')} className="rounded-xl bg-rose-600 text-white hover:bg-rose-700">
                            Send OTP to delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* OTP — activation or deletion */}
            {otpFor && (
                <PortalDialog label="Enter OTP" onClose={() => { setOtpFor(null); setOtp(''); }}>
                    <div className={`${DIALOG} max-w-sm text-center`}>
                        <button onClick={() => { setOtpFor(null); setOtp(''); }} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
                            <X className="w-5 h-5" />
                        </button>
                        <div className={`mx-auto mb-4 inline-flex rounded-2xl p-3 ${otpFor.action === 'verify' ? SILVER_TILE : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20'}`}>
                            {otpFor.action === 'verify' ? <ShieldCheck className="h-6 w-6" /> : <Trash className="h-6 w-6" />}
                        </div>
                        <h2 className="text-lg font-semibold mb-1">
                            {otpFor.action === 'verify' ? 'Verify Beneficiary' : 'Confirm Deletion'}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            {otpFor.action === 'verify'
                                ? `Enter the OTP sent to +91 ${sender} to activate ${otpFor.bene.name}.`
                                : `Enter the OTP sent to +91 ${sender} to delete ${otpFor.bene.name}.`}
                        </p>
                        {/* animate-ui InputOTP: one box per digit, each digit springs in. */}
                        <InputOTP aria-label="OTP" autoFocus maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp} containerClassName="justify-center">
                            <InputOTPGroup>
                                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-xl font-bold sm:w-12" />)}
                            </InputOTPGroup>
                        </InputOTP>
                        <button
                            onClick={handleOtpSubmit}
                            disabled={loading || otp.length !== 6}
                            className={`w-full rounded-xl py-3 font-semibold mt-4 disabled:opacity-50 ${otpFor.action === 'verify' ? ACTIVE_BUTTON : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                        >
                            {loading ? 'Processing...' : otpFor.action === 'verify' ? 'Verify' : 'Delete Beneficiary'}
                        </button>
                        <button onClick={() => requestOtp(otpFor.bene, otpFor.action)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground mt-2">
                            Resend OTP
                        </button>
                    </div>
                </PortalDialog>
            )}

            {/* Receipt */}
            {successTxn && (
                <PortalDialog label="Transfer receipt" onClose={() => setSuccessTxn(null)}>
                    <div className={`${DIALOG} max-w-sm p-8 text-center`}>
                        {successTxn.pending ? (
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 bg-amber-500/10 ring-amber-500/5">
                                <Clock className="w-8 h-8 text-amber-500" />
                            </div>
                        ) : <Lottie name="payment" size={130} loop={false} className="mx-auto -mt-4 mb-1" />}
                        <h2 className="text-2xl font-bold text-foreground mb-1">
                            {successTxn.pending ? 'Transfer Pending' : 'Transfer Successful'}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-5">
                            {successTxn.message || (successTxn.pending ? 'The bank has not confirmed it yet.' : 'Your money is on its way!')}
                        </p>
                        <p className="mb-5 flex justify-center text-4xl font-bold tracking-tight tabular-nums">₹<SlidingNumber initiallyStable number={Number(successTxn.amount) || 0} thousandSeparator="," decimalPlaces={Number.isInteger(Number(successTxn.amount)) ? 0 : 2} /></p>

                        <div className="rounded-xl border bg-background/50 p-4 text-left space-y-3 mb-6 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">To</span>
                                <span className="font-medium text-right">{successTxn.beneficiaryName}<br /><span className="font-mono text-xs text-muted-foreground">{successTxn.beneficiaryAccount}</span></span>
                            </div>
                            <div className="flex justify-between gap-3 border-t pt-3">
                                <span className="text-muted-foreground">Ref No</span>
                                <span className="flex items-center gap-1 font-mono font-medium">{successTxn.rrn || successTxn.txnid || successTxn.transactionId}<CopyButton content={String(successTxn.rrn || successTxn.txnid || successTxn.transactionId || '')} variant="ghost" size="xs" aria-label="Copy reference number" /></span>
                            </div>
                        </div>

                        <PrimaryCta type="button" onClick={() => setSuccessTxn(null)} className="w-full font-semibold">
                            Done
                        </PrimaryCta>
                        {!successTxn.pending && <Confetti />}
                    </div>
                </PortalDialog>
            )}
        </div>
    );
};

export default DMT;
