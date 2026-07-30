import React, { useState, useEffect } from 'react';
import { FileText, Loader2, ArrowRight, CheckCircle2, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Transaction {
    _id: string;
    transactionId: string;
    amount: number;
    status: string;
    createdAt: string;
    metadata?: {
        application_id?: number;
        eseva_fee?: number;
        partner_margin?: number;
        gst_amount?: number;
        late_fee?: number;
        timestamp?: string;
        message?: string;
    };
}

const ITR: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<Transaction[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const fetchHistory = async () => {
        if (!token) return;
        setHistoryLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/itr/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setHistory(res.data.transactions || []);
            }
        } catch (error: any) {
            console.error("Failed to fetch ITR history:", error);
            toast.error("Failed to load ITR history.");
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [token]);

    const handleLaunchPortal = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/itr/launch`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (res.data.success && res.data.redirect_url) {
                toast.success("ITR portal link generated successfully! Redirecting...");
                // Open in new tab
                window.open(res.data.redirect_url, '_blank');
            } else {
                toast.error(res.data.message || "Failed to launch ITR portal.");
            }
        } catch (error: any) {
            console.error("ITR Launch Error:", error);
            toast.error(
                error.response?.data?.message || 
                "An error occurred while generating the ITR portal URL."
            );
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'FAILED':
                return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
            case 'REFUNDED':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'PROCESSING':
            case 'PENDING':
            default:
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <FileText className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        ITR Filing Services
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Seamlessly submit and manage Income Tax Returns for your clients.
                    </p>
                </div>
            </div>

            {/* Main Section Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Launch Card */}
                <div className="md:col-span-2 glass-card p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between min-h-[320px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-30 pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Partner Integration
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Launch ITR Filing Portal
                        </h2>
                        <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                            Click below to open the secure eSevaTech ITR module. All charges will be verified against your Main Wallet. Make sure you have sufficient balance before starting an application.
                        </p>
                    </div>

                    <div className="relative z-10 pt-6">
                        <button
                            onClick={handleLaunchPortal}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    <span>Generating secure link...</span>
                                </>
                            ) : (
                                <>
                                    <span>Open Filing Module</span>
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Instructions Card */}
                <div className="glass-card p-6 rounded-3xl flex flex-col justify-between border-indigo-500/10 bg-indigo-500/[0.02]">
                    <h3 className="font-bold text-lg text-foreground mb-4">Guidelines & Rules</h3>
                    <ul className="space-y-4 flex-1">
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Wallet balance checks will run automatically during submission.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Each single-use token generated is valid for 15 minutes.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Ensure you validate information carefully before submitting the form.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-muted-foreground">
                            <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span>Refunds for rejected requests will automatically credit your Main Wallet.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Filing History Table */}
            <div className="glass-card rounded-3xl p-6 border-white/5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Filing Ledger</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            List of all recent ITR filings submitted by your account.
                        </p>
                    </div>
                    <button 
                        onClick={fetchHistory}
                        disabled={historyLoading}
                        className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground transition-all duration-300 cursor-pointer"
                        title="Refresh History"
                    >
                        <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {historyLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            <p className="text-sm text-muted-foreground">Fetching transaction ledger...</p>
                        </div>
                    ) : history.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                                    <th className="pb-3 pt-2 font-medium">Application ID</th>
                                    <th className="pb-3 pt-2 font-medium">Transaction ID</th>
                                    <th className="pb-3 pt-2 font-medium">Amount</th>
                                    <th className="pb-3 pt-2 font-medium">Date</th>
                                    <th className="pb-3 pt-2 font-medium">Status</th>
                                    <th className="pb-3 pt-2 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {history.map((txn) => (
                                    <tr key={txn._id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 font-semibold text-foreground">
                                            #{txn.metadata?.application_id || 'N/A'}
                                        </td>
                                        <td className="py-4 text-muted-foreground text-xs font-mono">
                                            {txn.transactionId}
                                        </td>
                                        <td className="py-4 font-bold text-foreground">
                                            ₹ {txn.amount.toFixed(2)}
                                        </td>
                                        <td className="py-4 text-muted-foreground">
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(txn.createdAt).toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(txn.status)}`}>
                                                {txn.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-xs text-muted-foreground max-w-xs truncate">
                                            {txn.metadata?.message || 
                                             `Fee: ₹${txn.metadata?.eseva_fee || 0} | Margin: ₹${txn.metadata?.partner_margin || 0} | GST: ₹${txn.metadata?.gst_amount || 0}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-16 flex flex-col items-center justify-center text-center gap-2">
                            <div className="p-3 bg-white/5 rounded-2xl text-muted-foreground">
                                <FileText className="h-8 w-8" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">No filing history found</p>
                            <p className="text-xs text-muted-foreground">Submit your first ITR form to see transaction details here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ITR;
