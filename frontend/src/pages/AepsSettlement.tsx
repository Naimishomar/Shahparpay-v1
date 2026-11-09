import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Building2, Clock, RefreshCw, SearchCheck, Landmark, Phone, KeyRound, IndianRupee, ShieldCheck, CheckCircle2, XCircle, Download, X, Trash2 } from 'lucide-react';
import axios from 'axios';
import html2canvas from 'html2canvas-pro';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import logo from '../assets/logo.png';

const SETTLEMENT_BASE_CHARGE = 5;
const SETTLEMENT_GST_RATE = 18;
const SETTLEMENT_GST_AMOUNT = Math.round(SETTLEMENT_BASE_CHARGE * (SETTLEMENT_GST_RATE / 100) * 100) / 100;
const SETTLEMENT_FEE = SETTLEMENT_BASE_CHARGE + SETTLEMENT_GST_AMOUNT;
const SETTLEMENT_MIN = 100;
const SETTLEMENT_MAX = 25000;

// Same black (light) / silver (dark) language as the dashboard and AEPS page.
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const AepsSettlement = () => {
    const { token, user } = useAuth();
    const [savedBanks, setSavedBanks] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [checkingId, setCheckingId] = useState('');

    // Form states
    const [beneficiaryMobile, setBeneficiaryMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState('IMPS');
    const [receipt, setReceipt] = useState<SettlementReceiptData | null>(null);
    const [addingBank, setAddingBank] = useState(false);
    const [deletingBank, setDeletingBank] = useState<any>(null);

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    useEffect(() => {
        fetchSavedBanks();
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
                toast.success(`Synced ${res.data.synced ?? 0} bank account(s)`);
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

    const handleSettlement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBankId || !amount || !pin) {
            return toast.error("Please fill all required fields");
        }

        const amt = Number(amount);
        if (amt < SETTLEMENT_MIN || amt > SETTLEMENT_MAX) {
            return toast.error(`Settlement amount must be between ₹${SETTLEMENT_MIN} and ₹${SETTLEMENT_MAX}`);
        }

        
        setLoading(true);
        const bank = savedBanks.find(b => b._id === selectedBankId);
        // A receipt is issued whenever the backend created a transaction, whatever its outcome.
        const issueReceipt = (body: any, status: SettlementReceiptData['status']) => {
            const transactionId = body?.data?.transactionId || body?.transactionId;
            if (!transactionId) return false;
            setReceipt({
                status,
                message: body?.message || '',
                transactionId,
                utr: body?.data?.response?.rrn || body?.data?.response?.utr || '',
                amount: amt,
                fee: SETTLEMENT_FEE,
                mode,
                bankName: bank?.bankName || '',
                accountNumber: String(bank?.accountNumber || ''),
                accountHolderName: bank?.accountHolderName || '',
                beneficiaryMobile,
                at: new Date(),
            });
            return true;
        };
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/settlement/initiate`, {
                bankId: selectedBankId,
                amount: amt,
                pin,
                mode,
                beneficiaryMobile
            }, getHeaders());

            if (res.data.success) {
                if (!issueReceipt(res.data, res.data.pending ? 'PENDING' : 'SUCCESS')) {
                    toast.success("Settlement request submitted successfully!");
                }
                setAmount('');
                setPin('');
                fetchHistory(); // refresh history after settlement
            } else if (!issueReceipt(res.data, 'FAILED')) {
                toast.error(res.data.message || "Settlement failed");
            }
        } catch (error: any) {
            if (!issueReceipt(error.response?.data, 'FAILED')) {
                toast.error(error.response?.data?.message || "Failed to initiate settlement");
            } else {
                fetchHistory();
            }
        }
        window.dispatchEvent(new Event('wallet-updated'));
        setLoading(false);
    };

    const selectedBank = savedBanks.find(b => b._id === selectedBankId);

    const amt = Number(amount);
    const amountValid = amt >= SETTLEMENT_MIN && amt <= SETTLEMENT_MAX;
    const txnPill = (status?: string) =>
        status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
            : status === 'FAILED' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ring-1 ${SILVER_TILE}`}>
                            <Building2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trade Wallet Settlement</h1>
                            <p className="text-sm text-muted-foreground">Move your Trade Wallet balance to your bank account</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSyncBanks}
                            disabled={syncing}
                            className="flex items-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-50"
                            title="Sync settlement accounts"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync Banks'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddingBank(true)}
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
                    <div className="relative overflow-hidden rounded-2xl hero-panel p-5">
                        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#F47920]/25 blur-2xl" />
                        {selectedBank ? (
                            <div className="relative flex flex-col gap-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-5 w-5 opacity-80" />
                                        <span className="font-semibold">{selectedBank.bankName}</span>
                                    </div>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/20">
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
                                <p className="text-xs opacity-70">Add a bank account and verify it with the OTP sent to your registered mobile.</p>
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
                                {selectedBank && (
                                    <button
                                        type="button"
                                        onClick={() => setDeletingBank(selectedBank)}
                                        title="Delete this bank account"
                                        aria-label="Delete this bank account"
                                        className="rounded-xl border bg-background px-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
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
                            <span className="text-muted-foreground">Total deduction from Trade Wallet</span>
                            <span className="text-2xl font-bold tracking-tight tabular-nums">₹{amountValid ? (amt + SETTLEMENT_FEE).toFixed(2) : '0.00'}</span>
                        </div>
                    </div>

                    <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" /> Available 24×7</li>
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

            {receipt && <SettlementReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
            {addingBank && (
                <AddSettlementBank
                    headers={getHeaders()}
                    onClose={() => setAddingBank(false)}
                    onAdded={() => { setAddingBank(false); fetchSavedBanks(); }}
                />
            )}
            {deletingBank && (
                <DeleteSettlementBank
                    bank={deletingBank}
                    headers={getHeaders()}
                    onClose={() => setDeletingBank(null)}
                    onDeleted={() => { setDeletingBank(null); fetchSavedBanks(); }}
                />
            )}
        </div>
    );
};

type SettlementReceiptData = {
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    message: string;
    transactionId: string;
    utr: string;
    amount: number;
    fee: number;
    mode: string;
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    beneficiaryMobile: string;
    at: Date;
};

/** Opens after every settlement the backend accepted, whatever the outcome; same layout as the AEPS receipt. */
const SettlementReceipt = ({ receipt, onClose }: { receipt: SettlementReceiptData; onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { status } = receipt;
    const tone = status === 'SUCCESS' ? 'text-emerald-600' : status === 'PENDING' ? 'text-amber-600' : 'text-red-600';
    const label = status === 'SUCCESS' ? 'Settlement successful' : status === 'PENDING' ? 'Awaiting bank confirmation' : 'Settlement failed';
    const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rows = ([
        ['Type', 'Trade Wallet Settlement'],
        ['Amount', inr(receipt.amount)],
        ['Charges (incl. GST)', inr(receipt.fee)],
        ['Total debited', status === 'FAILED' ? `${inr(0)} (refunded)` : inr(receipt.amount + receipt.fee)],
        ['Mode', receipt.mode],
        ['Account holder', receipt.accountHolderName],
        ['Bank', receipt.bankName],
        ['Account number', receipt.accountNumber],
        ['Beneficiary mobile', receipt.beneficiaryMobile],
        ['UTR', receipt.utr],
        ['Reference ID', receipt.transactionId],
    ] as [string, string][]).filter(([, v]) => v);

    const download = async () => {
        if (!ref.current) return;
        try {
            const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = `Settlement_Receipt_${receipt.transactionId}.png`;
            a.click();
        } catch {
            toast.error('Could not download the receipt.');
        }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Settlement receipt" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div onClick={(e) => e.stopPropagation()} className="relative max-h-[90vh] w-full max-w-md overflow-y-auto no-scrollbar rounded-2xl bg-white shadow-2xl">
                <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
                <div ref={ref} className="space-y-4 bg-white p-6 text-slate-800">
                    <div className="border-b border-dashed border-slate-300 pb-4 text-center">
                        <img src={logo} alt="Shahparpay" className="mx-auto mb-2 h-auto w-64 max-w-full object-contain" />
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-900">Settlement receipt</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                        {status === 'SUCCESS' ? <CheckCircle2 className="h-12 w-12 text-emerald-500" /> : status === 'PENDING' ? <Clock className="h-12 w-12 text-amber-500" /> : <XCircle className="h-12 w-12 text-red-500" />}
                        <p className={`text-lg font-bold ${tone}`}>{label}</p>
                        {receipt.message && receipt.message !== label && <p className="text-sm text-slate-500">{receipt.message}</p>}
                        <p className="text-xs text-slate-500">{receipt.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <dl className="space-y-2 text-sm">
                        {rows.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-2 last:border-0">
                                <dt className={['Type', 'Amount', 'Total debited', 'Mode'].includes(k) ? 'font-semibold text-slate-900' : 'text-slate-500'}>{k}</dt><dd className={`break-all text-right tabular-nums ${['Type', 'Amount', 'Total debited', 'Mode'].includes(k) ? 'text-base font-bold text-slate-900' : 'font-medium'}`}>{v}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="text-center text-[11px] text-slate-400">System generated receipt; no signature required.</p>
                </div>
                <div className="flex gap-3 border-t p-4">
                    <button onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold hover:bg-black/5"><Download size={16} /> Download</button>
                    <button onClick={onClose} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${ACTIVE_BUTTON}`}>Done</button>
                </div>
            </div>
        </div>
    );
};

/** Adds a payout (type 3) beneficiary on the registered mobile, then activates it by OTP. */
const AddSettlementBank = ({ headers, onClose, onAdded }: { headers: object; onClose: () => void; onAdded: () => void }) => {
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/settlement`;
    const [form, setForm] = useState({ benename: '', beneaccount: '', confirm: '', ifsc: '' });
    const [beneId, setBeneId] = useState('');
    const [otp, setOtp] = useState('');
    const [busy, setBusy] = useState(false);
    const fail = (e: unknown, fallback: string) =>
        toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback);

    const sendOtp = async (id: string) => {
        const res = await axios.post(`${api}/bank-otp`, { beneficiary_id: id }, headers);
        toast.success(res.data.message || 'OTP sent to your registered mobile');
    };

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.beneaccount !== form.confirm) return toast.error('Account numbers do not match');
        setBusy(true);
        try {
            const res = await axios.post(`${api}/add-bank`, { benename: form.benename.trim(), beneaccount: form.beneaccount.trim(), ifsc: form.ifsc.trim() }, headers);
            const id = res.data?.data?.id;
            if (!id) { toast.success(res.data.message || 'Bank added'); return onAdded(); }
            setBeneId(id);
            await sendOtp(id);
        } catch (err) { fail(err, 'Could not add this bank account'); }
        setBusy(false);
    };

    const verify = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await axios.post(`${api}/bank-verify`, { beneficiary_id: beneId, otp }, headers);
            toast.success(res.data.message || 'Bank account activated');
            return onAdded();
        } catch (err) { fail(err, 'Could not verify that OTP'); }
        setBusy(false);
    };

    const field = (key: keyof typeof form, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
            {label}
            <input required value={form[key]} onChange={(e) => setForm({ ...form, [key]: key === 'ifsc' ? e.target.value.toUpperCase() : e.target.value })} className={INPUT} {...extra} />
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{beneId ? 'Verify Bank Account' : 'Add Settlement Bank'}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                {beneId ? (
                    <form onSubmit={verify} className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">Enter the OTP sent to your registered mobile.</p>
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                            OTP
                            <input required inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className={INPUT} />
                        </label>
                        <button type="submit" disabled={busy} className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}>{busy ? 'Verifying...' : 'Verify & Activate'}</button>
                        <button type="button" disabled={busy} onClick={() => sendOtp(beneId).catch((err) => fail(err, 'Could not send the OTP'))} className="text-sm font-medium text-muted-foreground hover:text-foreground">Resend OTP</button>
                    </form>
                ) : (
                    <form onSubmit={add} className="flex flex-col gap-4">
                        {field('benename', 'Account holder name')}
                        {field('beneaccount', 'Account number', { inputMode: 'numeric' })}
                        {field('confirm', 'Confirm account number', { inputMode: 'numeric' })}
                        {field('ifsc', 'IFSC', { maxLength: 11 })}
                        <p className="text-xs text-muted-foreground">A ₹4 account verification charge is debited from your Utility Wallet.</p>
                        <button type="submit" disabled={busy} className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}>{busy ? 'Adding...' : 'Add Bank'}</button>
                    </form>
                )}
            </div>
        </div>
    );
};

/** Sends an OTP to the registered mobile, then deletes the payout beneficiary with it. */
const DeleteSettlementBank = ({ bank, headers, onClose, onDeleted }: { bank: any; headers: object; onClose: () => void; onDeleted: () => void }) => {
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/settlement`;
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [busy, setBusy] = useState(false);
    const fail = (e: unknown, fallback: string) =>
        toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback);

    const sendOtp = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`${api}/bank-otp`, { beneficiary_id: bank._id }, headers);
            toast.success(res.data.message || 'OTP sent to your registered mobile');
            setOtpSent(true);
        } catch (err) { fail(err, 'Could not send the OTP'); }
        setBusy(false);
    };

    const remove = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await axios.delete(`${api}/bank/${encodeURIComponent(bank._id)}`, { ...headers, data: { otp } });
            toast.success(res.data.message || 'Bank account deleted');
            return onDeleted();
        } catch (err) { fail(err, 'Could not delete this bank account'); }
        setBusy(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Delete Bank Account</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{bank.accountHolderName || 'Account'}</span> · {bank.bankName} · •••• {String(bank.accountNumber || '').slice(-4)}
                </p>
                {otpSent ? (
                    <form onSubmit={remove} className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                            OTP sent to your registered mobile
                            <input required inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className={INPUT} />
                        </label>
                        <button type="submit" disabled={busy} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Deleting...' : 'Delete Account'}</button>
                        <button type="button" disabled={busy} onClick={sendOtp} className="text-sm font-medium text-muted-foreground hover:text-foreground">Resend OTP</button>
                    </form>
                ) : (
                    <button type="button" disabled={busy} onClick={sendOtp} className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Sending...' : 'Send OTP to delete'}</button>
                )}
            </div>
        </div>
    );
};

export default AepsSettlement;
