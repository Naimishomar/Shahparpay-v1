import { useState } from 'react';
import { Search, UserPlus, Send, Plus, CreditCard, Lock, CheckCircle2, X, Trash, ShieldCheck, Clock, Loader2, Smartphone, Users, User, Landmark } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
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
        if (ok) setSender(mobile);
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
    const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200';
    const DIALOG = 'relative w-full rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200';

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero with sender search */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Send className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Domestic Money Transfer</h1>
                            <p className="text-sm text-muted-foreground">Instantly transfer funds to any bank account in India.</p>
                        </div>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                        className="flex w-full flex-col gap-1.5 lg:w-[420px]"
                    >
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sender mobile number</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 text-sm font-semibold text-muted-foreground">
                                    <Smartphone className="h-4 w-4" />
                                    +91
                                    <span className="h-4 w-px bg-border" />
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="10-digit number"
                                    className={`${INPUT} pl-[5.25rem] text-base font-semibold tracking-wider tabular-nums bg-background/80 backdrop-blur`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || mobile.length !== 10}
                                className={`flex shrink-0 min-w-[130px] items-center justify-center gap-2 rounded-xl px-8 text-sm font-semibold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}
                            >
                                {loading && !sender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Find
                            </button>
                        </div>
                    </form>
                </div>

                {sender && (
                    <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t pt-5">
                        <span className="flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-3 py-2 text-sm">
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Sending as</span>
                            <span className="font-semibold tabular-nums">+91 {sender}</span>
                        </span>
                        <span className="flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-3 py-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold tabular-nums">{beneficiaries.length}</span>
                            <span className="text-muted-foreground">beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{verifiedCount}</span>
                            <span className="text-muted-foreground">verified</span>
                        </span>
                    </div>
                )}
            </section>

            {bankVerification && (
                <section className="rounded-2xl border border-emerald-500/30 bg-card p-5 shadow-sm">
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
                        <button onClick={() => setBankVerification(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {[
                            ['Transaction ID', bankVerification.txnid], ['Status', bankVerification.status],
                            ['Account Name', bankVerification.AccountName], ['Account Number', bankVerification.AccountNumber],
                            ['Account Status', bankVerification.accountStatus], ['Bank', bankVerification.bank_name],
                            ['UTR', bankVerification.utr], ['City', bankVerification.city],
                            ['Branch', bankVerification.branch], ['MICR', bankVerification.micr],
                            ['Response', bankVerification.resText], ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                            ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
                        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-background/50 p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-medium text-foreground break-words">{String(value ?? '—')}</div></div>)}
                    </div>
                </section>
            )}

            {/* Beneficiaries */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm min-h-[360px]">
                {sender ? (
                    <>
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold">Saved Beneficiaries</h2>
                            <button
                                onClick={() => setShowAddBene(true)}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${ACTIVE_BUTTON}`}
                            >
                                <Plus className="w-4 h-4" />
                                Add New
                            </button>
                        </div>

                        {beneficiaries.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {beneficiaries.map((bene) => (
                                    <div key={bene.id} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-background/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600">
                                        <div className="flex items-start gap-3">
                                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${SILVER_TILE}`}>
                                                {initials(bene.name)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate font-semibold text-foreground">{bene.name}</h3>
                                                <p className="truncate text-xs text-muted-foreground">{bene.bank || 'Bank'}{bene.branch ? ` · ${bene.branch}` : ''}</p>
                                            </div>
                                            <button
                                                onClick={() => requestOtp(bene, 'delete')}
                                                className="rounded-lg p-1.5 text-muted-foreground opacity-60 hover:bg-rose-500/10 hover:text-rose-600 hover:opacity-100 dark:hover:text-rose-400"
                                                title="Delete Beneficiary"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="my-4 rounded-xl border bg-card px-3.5 py-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-mono text-sm font-semibold tracking-wider tabular-nums">{bene.account}</p>
                                                {bene.verified ? (
                                                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20">Unverified</span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 font-mono text-xs uppercase text-muted-foreground">{bene.ifsc}</p>
                                        </div>

                                        {bene.verified ? (
                                            <button
                                                onClick={() => setTransferBene(bene)}
                                                className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${ACTIVE_BUTTON}`}
                                            >
                                                <Send className="h-4 w-4" />
                                                Transfer Now
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => requestOtp(bene, 'verify')}
                                                className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                                Verify with OTP
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className={`mb-4 rounded-2xl p-4 ${SILVER_TILE}`}>
                                    <UserPlus className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No beneficiaries yet</h3>
                                <p className="text-sm text-muted-foreground mb-5 max-w-sm">Add a bank account to start transferring money instantly.</p>
                                <button
                                    onClick={() => setShowAddBene(true)}
                                    className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold ${ACTIVE_BUTTON}`}
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Beneficiary
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className={`mb-4 rounded-2xl p-4 ${SILVER_TILE}`}>
                            <Send className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-semibold mb-1">Ready to transfer</h2>
                        <p className="text-sm text-muted-foreground max-w-md">Enter the sender's mobile number above to see their saved beneficiaries and send money.</p>
                        <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                            {[
                                { icon: Smartphone, title: 'Find sender', text: 'Search by mobile number' },
                                { icon: ShieldCheck, title: 'Verify beneficiary', text: 'Activate with an OTP' },
                                { icon: Send, title: 'Send money', text: 'IMPS or NEFT with your PIN' },
                            ].map(({ icon: Icon, title, text }, i) => (
                                <div key={title} className="flex items-center gap-3 rounded-xl border bg-background/50 p-3 text-left">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold text-muted-foreground">{i + 1}</span>
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{title}</p>
                                        <p className="text-xs text-muted-foreground">{text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Add Beneficiary */}
            {showAddBene && (
                <div className={OVERLAY}>
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
                                <p className="text-sm text-muted-foreground">For sender +91 {sender}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {[
                                { label: 'Account Holder Name', icon: User, value: beneData.benename, set: (v: string) => setBeneData({ ...beneData, benename: v }), extra: '' },
                                { label: 'Account Number', icon: CreditCard, value: beneData.beneaccount, set: (v: string) => setBeneData({ ...beneData, beneaccount: v.replace(/\D/g, '') }), extra: 'font-mono tracking-wider' },
                                { label: 'Confirm Account Number', icon: CreditCard, value: beneData.confirmAccount, set: (v: string) => setBeneData({ ...beneData, confirmAccount: v.replace(/\D/g, '') }), extra: 'font-mono tracking-wider' },
                                { label: 'IFSC Code', icon: Landmark, value: beneData.ifsc, set: (v: string) => setBeneData({ ...beneData, ifsc: v.toUpperCase() }), extra: 'font-mono uppercase' },
                            ].map(({ label, icon: Icon, value, set, extra }) => (
                                <div key={label} className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">{label}</label>
                                    <div className="relative">
                                        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input type="text" value={value} onChange={e => set(e.target.value)} className={`${INPUT} pl-10 ${extra}`} />
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
                </div>
            )}

            {/* OTP — activation or deletion */}
            {otpFor && (
                <div className={OVERLAY}>
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
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className={`${INPUT} py-3 text-center tracking-[0.5em] text-2xl font-bold`}
                        />
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
                </div>
            )}

            {/* Transfer */}
            {transferBene && !successTxn && (
                <div className={OVERLAY}>
                    <div className={`${DIALOG} max-w-md`}>
                        <button onClick={() => { setTransferBene(null); setPin(''); setAmount(''); }} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-semibold mb-4">Send Money</h2>

                        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-4 text-white dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold ring-1 ring-white/20 dark:bg-black/10 dark:ring-black/10">
                                {initials(transferBene.name)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate font-semibold">{transferBene.name}</p>
                                <p className="truncate font-mono text-xs opacity-70">{transferBene.account} · {transferBene.ifsc}</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Amount</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        min="10"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
                                        placeholder="0"
                                        className={`${INPUT} pl-10 py-3 text-2xl font-bold tabular-nums`}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[500, 1000, 2000, 5000].map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setAmount(String(v))}
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-all ${amount === String(v) ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            ₹{v.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Transfer Mode</label>
                                <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                                    {['IMPS', 'NEFT'].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setTransferMode(m)}
                                            className={`rounded-lg py-2 text-sm font-semibold transition-all ${transferMode === m ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            {m}
                                            <span className="ml-1.5 text-[11px] font-medium opacity-70">{m === 'IMPS' ? 'Instant' : 'Batch'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Lock className="w-4 h-4 text-muted-foreground" /> 4-Digit Security PIN
                                </label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••"
                                    className={`${INPUT} py-3 text-center tracking-[1em] text-2xl font-bold`}
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border bg-background/50 p-4">
                                <span className="text-sm text-muted-foreground">Total Deducted</span>
                                <span className="text-xl font-bold tabular-nums">₹ {amount || '0'}</span>
                            </div>

                            <button onClick={handleTransfer} disabled={loading || !amount || Number(amount) < 10 || pin.length !== 4} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                {loading ? 'Processing...' : 'Confirm Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt */}
            {successTxn && (
                <div className={OVERLAY}>
                    <div className={`${DIALOG} max-w-sm p-8 text-center`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ${successTxn.pending ? 'bg-amber-500/10 ring-amber-500/5' : 'bg-emerald-500/10 ring-emerald-500/5'}`}>
                            {successTxn.pending
                                ? <Clock className="w-8 h-8 text-amber-500" />
                                : <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-1">
                            {successTxn.pending ? 'Transfer Pending' : 'Transfer Successful'}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-5">
                            {successTxn.message || (successTxn.pending ? 'The bank has not confirmed it yet.' : 'Your money is on its way!')}
                        </p>
                        <p className="mb-5 text-4xl font-bold tracking-tight tabular-nums">₹{Number(successTxn.amount).toLocaleString('en-IN')}</p>

                        <div className="rounded-xl border bg-background/50 p-4 text-left space-y-3 mb-6 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">To</span>
                                <span className="font-medium text-right">{successTxn.beneficiaryName}<br /><span className="font-mono text-xs text-muted-foreground">{successTxn.beneficiaryAccount}</span></span>
                            </div>
                            <div className="flex justify-between gap-3 border-t pt-3">
                                <span className="text-muted-foreground">Ref No</span>
                                <span className="font-mono font-medium">{successTxn.rrn || successTxn.txnid || successTxn.transactionId}</span>
                            </div>
                        </div>

                        <button onClick={() => setSuccessTxn(null)} className={`w-full rounded-xl py-3 font-semibold ${ACTIVE_BUTTON}`}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DMT;
