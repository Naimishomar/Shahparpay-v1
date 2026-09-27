import { useState, useEffect } from 'react';
import { Send, Plus, Building2, Clock, Trash2, RefreshCw, SearchCheck, FileUp, Landmark, Phone, KeyRound, IndianRupee, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const isSettlementWindow = () => {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return mins >= 9 * 60 && mins < 21 * 60;
};

const SETTLEMENT_BASE_CHARGE = 5;
const SETTLEMENT_GST_RATE = 18;
const SETTLEMENT_GST_AMOUNT = Math.round(SETTLEMENT_BASE_CHARGE * (SETTLEMENT_GST_RATE / 100) * 100) / 100;
const SETTLEMENT_FEE = SETTLEMENT_BASE_CHARGE + SETTLEMENT_GST_AMOUNT;
const SETTLEMENT_MIN = 100;
const SETTLEMENT_MAX = 25000;

// Same black (light) / silver (dark) language as the dashboard and AEPS page.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const FILE_INPUT = 'w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white dark:file:bg-zinc-200 dark:file:text-zinc-900';

const AepsSettlement = () => {
    const { token } = useAuth();
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [checkingId, setCheckingId] = useState('');
    const [checkingBankStatusId, setCheckingBankStatusId] = useState('');
    const [uploadDocBankId, setUploadDocBankId] = useState<string | null>(null);
    const [docType, setDocType] = useState<'PAN' | 'AADHAAR'>('PAN');
    const [docFiles, setDocFiles] = useState<{ passbook?: File; panimage?: File; front_aadhar?: File; back_aadhar?: File }>({});
    const [uploading, setUploading] = useState(false);

    // Form states
    const [beneficiaryMobile, setBeneficiaryMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState('IMPS');

    // Add Bank Modal state
    const [showAddBank, setShowAddBank] = useState(false);
    const [bankData, setBankData] = useState({
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        accountHolderName: ''
    });

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    useEffect(() => {
        fetchSavedBanks();
        fetchAvailableBanks();
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/history`, getHeaders());
            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch settlement history", error);
        }
    };

    const fetchAvailableBanks = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/aeps/banks`);
            if (res.data.success && res.data.data) {
                setAvailableBanks(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch available banks", error);
        }
    };

    const fetchSavedBanks = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/saved-banks`, getHeaders());
            if (res.data.success) {
                const banks: any[] = res.data.data;
                setSavedBanks(banks);
                setSelectedBankId(prevId => {
                    if (banks.length === 0) return '';
                    if (prevId && banks.some(b => b._id === prevId)) return prevId;
                    return banks[0]._id;
                });
            }
        } catch (error) {
            console.error("Failed to fetch saved banks", error);
        }
    };

    const handleSyncBanks = async () => {
        setSyncing(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/sync-banks`, getHeaders());
            if (res.data.success) {
                toast.success(`Synced ${res.data.synced ?? 0} bank account(s) from PaySprint`);
                fetchSavedBanks();
            } else {
                toast.error(res.data.message || "Failed to sync banks");
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || "Failed to sync banks");
        }
        setSyncing(false);
    };

    const handleCheckStatus = async (txnId: string) => {
        setCheckingId(txnId);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/status`, { transactionId: txnId }, getHeaders());
            if (res.data.success) {
                const msg = res.data.message || "Status checked";
                toast.success(msg);
            } else {
                toast.error(res.data.message || "Status enquiry failed");
            }
            fetchHistory();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || "Failed to check settlement status");
        }
        setCheckingId('');
    };

    const handleDeleteBank = async (id: string) => {
        if (!confirm("Are you sure you want to remove this bank account?")) return;
        
        try {
            const res = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/bank/${id}`, getHeaders());
            if (res.data.success) {
                toast.success("Bank account removed successfully!");
                fetchSavedBanks();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to remove bank account");
        }
    };

    const handleCheckBankStatus = async (id: string) => {
        setCheckingBankStatusId(id);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/account-status/${id}`, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || "Account status checked");
            } else {
                toast.error(res.data.message || "Failed to check account status");
            }
            fetchSavedBanks();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to check account status");
        }
        setCheckingBankStatusId('');
    };

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadDocBankId) return;

        if (!docFiles.passbook) return toast.error("Please upload the passbook / bank statement image (required for all accounts)");
        const hasFile = docFiles.passbook || docFiles.panimage || docFiles.front_aadhar || docFiles.back_aadhar;
        if (!hasFile) return toast.error("Please select at least one document file");

        setUploading(true);
        const formData = new FormData();
        formData.append('bankId', uploadDocBankId);
        formData.append('doctype', docType);
        if (docFiles.passbook) formData.append('passbook', docFiles.passbook);
        if (docFiles.panimage) formData.append('panimage', docFiles.panimage);
        if (docFiles.front_aadhar) formData.append('front_aadhar', docFiles.front_aadhar);
        if (docFiles.back_aadhar) formData.append('back_aadhar', docFiles.back_aadhar);

        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/upload-document`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                toast.success(res.data.message || "Document uploaded successfully");
                setUploadDocBankId(null);
                setDocFiles({});
                fetchSavedBanks();
            } else {
                toast.error(res.data.message || "Failed to upload document");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to upload document");
        }
        setUploading(false);
    };

    const handleAddBank = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/add-bank`, bankData, getHeaders());
            if (res.data.success) {
                toast.success("Bank account added successfully!");
                setShowAddBank(false);
                setBankData({ bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '' });
                fetchSavedBanks();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add bank account");
        }
        setLoading(false);
    };

    const handleSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBankId || !amount || !pin) {
            return toast.error("Please fill all required fields");
        }

        const amt = Number(amount);
        if (amt < SETTLEMENT_MIN || amt > SETTLEMENT_MAX) {
            return toast.error(`Settlement amount must be between ₹${SETTLEMENT_MIN} and ₹${SETTLEMENT_MAX}`);
        }

        if (!isSettlementWindow()) {
            return toast.error("AEPS Settlement is available from 9 AM to 9 PM IST only. Please try again during service hours.");
        }
        
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/initiate`, {
                bankId: selectedBankId,
                amount: amt,
                pin,
                mode,
                beneficiaryMobile
            }, getHeaders());

            if (res.data.success) {
                toast.success("Settlement request submitted successfully!");
                setAmount('');
                setPin('');
                fetchHistory(); // refresh history after settlement
            } else {
                toast.error(res.data.message || "Settlement failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to initiate settlement");
        }
        window.dispatchEvent(new Event('wallet-updated'));
        setLoading(false);
    };

    const selectedBank = savedBanks.find(b => b._id === selectedBankId);
    const uploadDocBank = uploadDocBankId ? savedBanks.find(b => b._id === uploadDocBankId) : null;

    const settlementOpen = isSettlementWindow();
    const amt = Number(amount);
    const amountValid = amt >= SETTLEMENT_MIN && amt <= SETTLEMENT_MAX;
    const txnPill = (status?: string) =>
        status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
            : status === 'FAILED' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ring-1 ${SILVER_TILE}`}>
                            <Building2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AEPS Settlement</h1>
                            <p className="text-sm text-muted-foreground">Move your AEPS wallet balance to your bank account</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${settlementOpen ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/30'}`}>
                            <span className="relative flex h-2 w-2">
                                {settlementOpen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${settlementOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            </span>
                            {settlementOpen ? 'Open · 9 AM – 9 PM IST' : 'Closed · opens 9 AM IST'}
                        </span>
                        <button
                            type="button"
                            onClick={handleSyncBanks}
                            disabled={syncing}
                            className="flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-50"
                            title="Sync settlement accounts from PaySprint"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync Banks'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddBank(true)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${ACTIVE_BUTTON}`}
                        >
                            <Plus className="w-4 h-4" />
                            Add Bank
                        </button>
                    </div>
                </div>
            </section>

            <form onSubmit={handleSettlement} className="grid gap-6 xl:grid-cols-[1fr_380px]">
                {/* Transfer to bank */}
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold">Transfer to Bank</h2>

                    {/* Selected bank, shown as a card */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-5 text-white shadow-lg dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl dark:bg-white/40" />
                        {selectedBank ? (
                            <div className="relative flex flex-col gap-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-5 w-5 opacity-80" />
                                        <span className="font-semibold">{selectedBank.bankName}</span>
                                    </div>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/20 dark:bg-black/10 dark:ring-black/10">
                                        <span className={`h-1.5 w-1.5 rounded-full ${selectedBank.status === 'VERIFIED' ? 'bg-emerald-400' : selectedBank.status === 'PENDING' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                                        {selectedBank.status === 'VERIFIED' ? 'Active' : selectedBank.status === 'PENDING' ? 'Pending Activation' : 'Rejected'}
                                    </span>
                                </div>
                                <p className="font-mono text-xl tracking-[0.2em] tabular-nums">
                                    •••• {String(selectedBank.accountNumber || '').slice(-4)}
                                </p>
                                <div className="flex items-end justify-between gap-3 text-xs">
                                    <div>
                                        <p className="uppercase tracking-wider opacity-60">Beneficiary</p>
                                        <p className="text-sm font-semibold">{selectedBank.accountHolderName || '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="uppercase tracking-wider opacity-60">IFSC</p>
                                        <p className="text-sm font-semibold font-mono">{selectedBank.ifscCode}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
                                <Landmark className="h-8 w-8 opacity-70" />
                                <p className="font-semibold">No bank account added</p>
                                <p className="text-xs opacity-70">Add a bank or sync from PaySprint to start settling.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Settlement Account</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Landmark className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <select
                                        value={selectedBankId}
                                        onChange={(e) => setSelectedBankId(e.target.value)}
                                        className={`${INPUT} pl-10`}
                                    >
                                        {savedBanks.length === 0 ? (
                                            <option value="">No banks added</option>
                                        ) : (
                                            savedBanks.map(bank => (
                                                <option key={bank._id} value={bank._id}>
                                                    {bank.status === 'VERIFIED' ? '✓ ' : bank.status === 'PENDING' ? '⏳ ' : '✗ '}{bank.bankName} · {String(bank.accountNumber || '').slice(-4)}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                {selectedBankId && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleCheckBankStatus(selectedBankId)}
                                            disabled={checkingBankStatusId === selectedBankId || !selectedBank?.beneId}
                                            className="flex shrink-0 items-center justify-center rounded-xl border px-3 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                                            title="Check activation status on PaySprint"
                                        >
                                            <SearchCheck className={`w-4 h-4 ${checkingBankStatusId === selectedBankId ? 'animate-pulse' : ''}`} />
                                        </button>
                                        {selectedBank && selectedBank.status !== 'VERIFIED' && (
                                            <button
                                                type="button"
                                                onClick={() => { setUploadDocBankId(selectedBank._id); setDocType('PAN'); setDocFiles({}); }}
                                                className="flex shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                                                title="Upload supportive document to activate account"
                                            >
                                                <FileUp className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteBank(selectedBankId)}
                                            className="flex shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white"
                                            title="Delete Bank Account"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Beneficiary Mobile</label>
                            <div className="relative">
                                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={beneficiaryMobile}
                                    onChange={(e) => setBeneficiaryMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="Enter Mobile"
                                    className={`${INPUT} pl-10`}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Amount</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    placeholder="0.00"
                                    required
                                    min={SETTLEMENT_MIN}
                                    max={SETTLEMENT_MAX}
                                    className={`${INPUT} pl-8 text-lg font-semibold tabular-nums`}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Between ₹{SETTLEMENT_MIN} and ₹{SETTLEMENT_MAX.toLocaleString('en-IN')}</p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Transaction PIN</label>
                            <div className="relative">
                                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Enter 4-6 digit PIN"
                                    required
                                    className={`${INPUT} pl-10 tracking-widest`}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Transaction Mode</label>
                            <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                                {['IMPS', 'NEFT'].map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMode(m)}
                                        className={`rounded-lg py-2 text-sm font-semibold transition-all ${mode === m ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                    >
                                        {m}
                                        <span className="ml-1.5 text-[11px] font-medium opacity-70">{m === 'IMPS' ? 'Instant' : 'Batch'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Summary & submit */}
                <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm xl:sticky xl:top-4 xl:self-start">
                    <h2 className="text-lg font-semibold">Summary</h2>

                    <div className="rounded-2xl border bg-background/50 p-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Amount credited to bank</span>
                            <span className="font-semibold tabular-nums">₹{amountValid ? amt.toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Charge (₹{SETTLEMENT_BASE_CHARGE} + {SETTLEMENT_GST_RATE}% GST)</span>
                            <span className="font-semibold tabular-nums">₹{SETTLEMENT_FEE.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Mode</span>
                            <span className="font-semibold">{mode}</span>
                        </div>
                        <div className="flex items-end justify-between gap-3 border-t pt-3">
                            <span className="text-muted-foreground">Total deduction from AEPS Wallet</span>
                            <span className="text-2xl font-bold tracking-tight tabular-nums">₹{amountValid ? (amt + SETTLEMENT_FEE).toFixed(2) : '0.00'}</span>
                        </div>
                    </div>

                    <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" /> Available 9 AM – 9 PM IST</li>
                        <li className="flex items-center gap-2"><IndianRupee className="h-3.5 w-3.5 shrink-0" /> ₹{SETTLEMENT_MIN} – ₹{SETTLEMENT_MAX.toLocaleString('en-IN')} per settlement</li>
                        <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Only active (verified) accounts can receive funds</li>
                    </ul>

                    <button
                        type="submit"
                        disabled={loading || !selectedBankId}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}
                    >
                        <Send className="w-4 h-4" />
                        {loading ? 'Processing...' : 'Submit Settlement'}
                    </button>
                </section>
            </form>

            {/* History Section */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Settlement History
                </h2>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[11px] text-muted-foreground uppercase tracking-wider bg-black/[0.03] dark:bg-white/[0.04]">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Reference ID</th>
                                <th className="px-4 py-3 font-semibold">Bank Details</th>
                                <th className="px-4 py-3 font-semibold">Amount</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                                        No settlement history found.
                                    </td>
                                </tr>
                            ) : (
                                history.map((tx: any, idx) => (
                                    <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-foreground">
                                            {new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                            <div className="flex flex-col">
                                                <span>{tx.transactionId}</span>
                                                {tx.metadata?.utr && (
                                                    <span className="text-emerald-600 dark:text-emerald-400">UTR: {tx.metadata.utr}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{tx.metadata?.bankName}</span>
                                                <span className="text-xs text-muted-foreground">A/C: {tx.metadata?.bankAccount}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold tabular-nums text-foreground">
                                            ₹{Number(tx.amount).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${txnPill(tx.status)}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(tx.status === 'PROCESSING' || tx.status === 'PENDING') && (
                                                <button
                                                    onClick={() => handleCheckStatus(tx.transactionId)}
                                                    disabled={checkingId === tx.transactionId}
                                                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                                                >
                                                    <SearchCheck className="w-3.5 h-3.5" />
                                                    {checkingId === tx.transactionId ? 'Checking...' : 'Check Status'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Add Bank Modal */}
            {showAddBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="mb-5 flex items-center gap-3">
                            <div className={`rounded-xl p-2.5 ring-1 ${SILVER_TILE}`}>
                                <Landmark className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-semibold">Add Bank Account</h3>
                        </div>
                        <form onSubmit={handleAddBank} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Bank Name</label>
                                <select
                                    value={bankData.bankName}
                                    onChange={e => setBankData({...bankData, bankName: e.target.value})}
                                    required
                                    className={INPUT}
                                >
                                    <option value="">Select a Bank</option>
                                    {availableBanks.map((bank: any, idx) => (
                                        <option key={idx} value={bank.bankName || bank.name}>
                                            {bank.bankName || bank.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5 rounded-xl border bg-black/[0.03] dark:bg-white/[0.04] p-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    <strong className="text-foreground">NPCI Strict Rule:</strong> For self (savings) accounts the Account Holder Name must match your official KYC PAN/Aadhaar Name and is used automatically.
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    For a business / current account, enter the exact Account Holder Name below (as per bank records) so the penny-drop validates it.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Account Holder Name <span className="text-muted-foreground">(current/business accounts)</span></label>
                                <input
                                    type="text"
                                    value={bankData.accountHolderName}
                                    onChange={e => setBankData({...bankData, accountHolderName: e.target.value})}
                                    placeholder="Leave blank for self (KYC name) account"
                                    className={INPUT}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Account Number</label>
                                <input
                                    type="text"
                                    value={bankData.accountNumber}
                                    onChange={e => setBankData({...bankData, accountNumber: e.target.value.replace(/\D/g, '')})}
                                    placeholder="Account Number"
                                    required
                                    className={INPUT}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">IFSC Code</label>
                                <input
                                    type="text"
                                    value={bankData.ifscCode}
                                    onChange={e => setBankData({...bankData, ifscCode: e.target.value.toUpperCase()})}
                                    placeholder="e.g. SBIN0001234"
                                    required
                                    className={`${INPUT} font-mono uppercase`}
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowAddBank(false)}
                                    className="flex-1 rounded-xl border py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`flex-1 rounded-xl py-2.5 font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}
                                >
                                    {loading ? 'Adding...' : 'Add Bank'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload Supportive Document Modal */}
            {uploadDocBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
                                <FileUp className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-semibold">Upload Supportive Document</h3>
                        </div>
                        <div className="mb-4 rounded-xl border bg-background/50 p-3 text-sm">
                            <p className="font-medium text-foreground">{uploadDocBank.bankName}</p>
                            <p className="text-xs text-muted-foreground">A/C: {uploadDocBank.accountNumber}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                This account requires a supportive document to activate. Once verified, it will become eligible for settlement.
                            </p>
                        </div>
                        <form onSubmit={handleUploadDocument} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Document Type</label>
                                <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1">
                                    {([['PAN', 'PAN / Passbook'], ['AADHAAR', 'Aadhaar']] as const).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setDocType(value)}
                                            className={`rounded-lg py-2 text-sm font-semibold transition-all ${docType === value ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Passbook / Bank Statement Image (required)</label>
                                <input
                                    type="file"
                                    accept="image/png,image/jpg,image/jpeg"
                                    onChange={e => setDocFiles({ ...docFiles, passbook: e.target.files?.[0] || undefined })}
                                    className={FILE_INPUT}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Savings: upload passbook page. Current account: upload first page of account statement or a cancelled cheque.
                                </p>
                            </div>

                            {docType === 'PAN' ? (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">PAN Image (optional)</label>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpg,image/jpeg"
                                        onChange={e => setDocFiles({ ...docFiles, panimage: e.target.files?.[0] || undefined })}
                                        className={FILE_INPUT}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">Aadhaar Front</label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpg,image/jpeg"
                                            onChange={e => setDocFiles({ ...docFiles, front_aadhar: e.target.files?.[0] || undefined })}
                                            className={FILE_INPUT}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">Aadhaar Back</label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpg,image/jpeg"
                                            onChange={e => setDocFiles({ ...docFiles, back_aadhar: e.target.files?.[0] || undefined })}
                                            className={FILE_INPUT}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => { setUploadDocBankId(null); setDocFiles({}); }}
                                    className="flex-1 rounded-xl border py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className={`flex-1 rounded-xl py-2.5 font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}
                                >
                                    {uploading ? 'Uploading...' : 'Upload Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AepsSettlement;
