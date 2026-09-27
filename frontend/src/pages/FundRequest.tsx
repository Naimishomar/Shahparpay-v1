import { useState, useEffect } from 'react';
import { Send, Plus, X, FileText, Trash2, Inbox, Landmark, Hash, Paperclip } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const FundRequest = () => {
    const { token } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    
    // Form States
    const [formData, setFormData] = useState({
        transactionMode: '',
        amount: '',
        bankUtr: '',
        depositDate: '',
        remarks: ''
    });
    const [depositSlip, setDepositSlip] = useState<File | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/retailer`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setRequests(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch fund requests", error);
        }
    };

    useEffect(() => {
        if (token) fetchRequests();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.transactionMode || !formData.amount || !formData.bankUtr || !formData.depositDate) {
            return toast.error("Please fill all required fields");
        }

        const data = new FormData();
        data.append('transactionMode', formData.transactionMode);
        data.append('amount', formData.amount);
        data.append('bankUtr', formData.bankUtr);
        data.append('depositDate', formData.depositDate);
        data.append('remarks', formData.remarks);
        if (depositSlip) {
            data.append('depositSlip', depositSlip);
        }

        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/create`, data, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (res.data.success) {
                toast.success("Fund request submitted successfully");
                setShowAddModal(false);
                setFormData({ transactionMode: '', amount: '', bankUtr: '', depositDate: '', remarks: '' });
                setDepositSlip(null);
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit fund request");
        }
        setLoading(false);
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this fund request?")) return;
        
        try {
            const res = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/delete/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                toast.success("Fund request deleted successfully");
                fetchRequests();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete fund request");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20';
            case 'REJECTED': return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20';
            default: return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';
        }
    };
    const countOf = (st: string) => requests.filter((r) => st === 'ALL' || r.status === st).length;
    const shown = requests.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);
    const approvedTotal = requests.filter((r) => r.status === 'APPROVED').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Send className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fund Request</h1>
                            <p className="text-sm text-muted-foreground">Request Main Wallet funds from your distributor against a bank deposit.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className={`flex items-center justify-center gap-2 self-start lg:self-auto rounded-xl px-6 py-3 font-semibold ${ACTIVE_BUTTON}`}
                    >
                        <Plus className="w-5 h-5" />
                        Create Request
                    </button>
                </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total requests', value: requests.length, dot: 'bg-zinc-400' },
                    { label: 'Pending', value: countOf('PENDING'), dot: 'bg-amber-500' },
                    { label: 'Approved', value: countOf('APPROVED'), dot: 'bg-emerald-500' },
                    { label: 'Approved amount', value: `₹${approvedTotal.toLocaleString('en-IN')}`, dot: 'bg-emerald-500' },
                ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border bg-card p-5 shadow-sm">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />{stat.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Your requests</h2>
                    <div className="flex gap-1 rounded-xl border bg-background/60 p-1">
                        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${statusFilter === st ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                {st.toLowerCase()} <span className="opacity-60">{countOf(st)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/[0.03] dark:bg-white/[0.04]">
                            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {['#', 'Txn Mode', 'Amount', 'Bank UTR', 'Deposit Date', 'Deposit Slip', 'Remarks', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {shown.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                        <Inbox className="mx-auto mb-2 h-8 w-8 opacity-60" />
                                        No fund requests found.
                                    </td>
                                </tr>
                            ) : (
                                shown.map((req, index) => (
                                    <tr key={req._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                                        <td className="px-4 py-3 font-medium">{req.transactionMode}</td>
                                        <td className="px-4 py-3 font-bold tabular-nums">₹{Number(req.amount).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{req.bankUtr}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{new Date(req.depositDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td className="px-4 py-3">
                                            {req.depositSlipUrl ? (
                                                <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                                    <FileText className="w-3.5 h-3.5" /> View
                                                </a>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]" title={req.remarks}>{req.remarks || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getStatusColor(req.status)}`}>
                                                {req.status}
                                            </span>
                                            {req.adminRemarks && <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[120px]" title={req.adminRemarks}>{req.adminRemarks}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {req.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleDeleteRequest(req._id)}
                                                    className="rounded-lg p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                                                    title="Delete Request"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Add Fund Request Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}>
                                    <Landmark className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Add Fund Request</h2>
                                    <p className="text-xs text-muted-foreground">Enter the details of your bank deposit.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="flex flex-col gap-2 mb-5">
                                <label className="text-sm font-medium text-foreground">Transaction Mode *</label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cash Deposit', 'Cheque'].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, transactionMode: m })}
                                            className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${formData.transactionMode === m ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Deposit Amount *</label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">₹</span>
                                        <input
                                            type="number"
                                            required min="1"
                                            placeholder="Enter amount"
                                            className={`${INPUT} pl-8 text-lg font-semibold tabular-nums`}
                                            value={formData.amount}
                                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Bank UTR / Ref ID *</label>
                                    <div className="relative">
                                        <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Enter UTR"
                                            className={`${INPUT} pl-10 font-mono`}
                                            value={formData.bankUtr}
                                            onChange={(e) => setFormData({...formData, bankUtr: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Deposit Date *</label>
                                    <input
                                        type="date"
                                        required
                                        className={INPUT}
                                        value={formData.depositDate}
                                        onChange={(e) => setFormData({...formData, depositDate: e.target.value})}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Deposit Slip</label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed bg-background px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                                        <Paperclip className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{depositSlip ? depositSlip.name : 'Attach image or PDF'}</span>
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            className="hidden"
                                            onChange={(e) => setDepositSlip(e.target.files ? e.target.files[0] : null)}
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-foreground">Remark</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Optional remarks..."
                                        className={`${INPUT} resize-none`}
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3 border-t pt-5">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl border py-3 font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`flex-[2] rounded-xl py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed ${ACTIVE_BUTTON}`}
                                >
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundRequest;