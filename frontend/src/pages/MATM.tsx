import { useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const formatProviderTime = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const statusMap: Record<string, { cls: string; icon: any }> = {
    SUCCESS: { cls: 'bg-green-500/10 text-green-600', icon: CheckCircle2 },
    PENDING: { cls: 'bg-amber-500/10 text-amber-600', icon: Clock },
    FAILED: { cls: 'bg-red-500/10 text-red-600', icon: XCircle },
};

const MATM = () => {
    const { token, user } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/matm`;
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const [config, setConfig] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    const [form, setForm] = useState({
        mobile: user?.contactNumber || '',
        terminalId: '',
        transactionAmount: '',
        transactionType: 'WDLS',
        cardType: 'Unknown',
        bankName: '',
        cardNumber: '',
        bankRRN: '',
        fpTransactionId: '',
    });

    const fetchHistory = async () => {
        try {
            const response = await axios.get(`${api}/history`, headers);
            if (response.data.success) setHistory(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch MATM history', error);
        }
    };

    const initialize = async () => {
        setConfigLoading(true);
        try {
            const response = await axios.post(`${api}/config`, {}, headers);
            if (response.data.success) setConfig(response.data.data);
            else toast.error(response.data.message || 'Could not initialize MATM');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not initialize MATM');
        } finally {
            setConfigLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        initialize();
        fetchHistory();
    }, [token]);

    const processTransaction = async () => {
        const amount = Number(form.transactionAmount);
        if (!/^[6-9]\d{9}$/.test(form.mobile)) return toast.error('Enter a valid 10-digit mobile number');
        if (!(amount > 0)) return toast.error('Enter a valid transaction amount');
        if (!form.terminalId.trim()) return toast.error('Enter the MATM terminal ID');

        setLoading(true);
        try {
            const response = await axios.post(`${api}/request`, {
                mobile: form.mobile,
                data: {
                    terminalId: form.terminalId.trim(),
                    requestTransactionTime: formatProviderTime(),
                    transactionAmount: amount,
                    transactionStatus: 'successful',
                    balanceAmount: 0,
                    bankRRN: form.bankRRN.trim(),
                    transactionType: form.transactionType,
                    fpTransactionId: form.fpTransactionId.trim(),
                    errorCode: '00',
                    errorMessage: 'Success',
                    cardType: form.cardType,
                    bankName: form.bankName.trim(),
                    cardNumber: form.cardNumber.trim(),
                },
            }, headers);

            if (response.data.success || response.data.pending) {
                toast.success(response.data.message || 'MATM request submitted');
                fetchHistory();
                window.dispatchEvent(new Event('wallet-updated'));
            } else {
                toast.error(response.data.message || 'MATM transaction failed');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'MATM transaction failed');
        } finally {
            setLoading(false);
        }
    };

    const input = 'w-full px-3 py-2.5 bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary';
    const setField = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><CreditCard className="w-8 h-8 text-primary" /> MATM</h1>
                    <p className="text-muted-foreground mt-2">Process Micro ATM cash-withdrawal transactions through Icchhamati.</p>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">MATM Configuration</h2>
                            <p className="text-sm text-muted-foreground">Initialize the terminal before processing a transaction.</p>
                        </div>
                        <button onClick={initialize} disabled={configLoading} className="px-3 py-2 rounded-xl border border-border/50 flex items-center gap-2 text-sm font-medium hover:border-primary/50 disabled:opacity-50">
                            <RefreshCw className={`w-4 h-4 ${configLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>
                    {config && <pre className="max-h-40 overflow-auto rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{JSON.stringify(config, null, 2)}</pre>}
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                    <h2 className="text-xl font-bold text-foreground">Process MATM Transaction</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium block mb-1.5">Customer Mobile</label><input className={input} value={form.mobile} onChange={e => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Transaction Amount (₹)</label><input className={input} value={form.transactionAmount} onChange={e => setField('transactionAmount', e.target.value.replace(/\D/g, ''))} /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Terminal ID</label><input className={input} value={form.terminalId} onChange={e => setField('terminalId', e.target.value)} placeholder="NSD60705" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Transaction Type</label><select className={input} value={form.transactionType} onChange={e => setField('transactionType', e.target.value)}><option value="WDLS">Cash Withdrawal (WDLS)</option><option value="BAL">Balance Enquiry</option></select></div>
                        <div><label className="text-sm font-medium block mb-1.5">Bank Name</label><input className={input} value={form.bankName} onChange={e => setField('bankName', e.target.value)} /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Card Type</label><input className={input} value={form.cardType} onChange={e => setField('cardType', e.target.value)} /></div>
                        <div><label className="text-sm font-medium block mb-1.5">Card Number (masked)</label><input className={input} value={form.cardNumber} onChange={e => setField('cardNumber', e.target.value)} placeholder="************3808" /></div>
                        <div><label className="text-sm font-medium block mb-1.5">FP Transaction ID (optional)</label><input className={input} value={form.fpTransactionId} onChange={e => setField('fpTransactionId', e.target.value)} /></div>
                    </div>
                    <button onClick={processTransaction} disabled={loading || configLoading} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50">{loading ? 'Processing...' : 'Process MATM Transaction'}</button>
                    <p className="text-xs text-muted-foreground">The outlet ID is taken from the logged-in retailer account and cannot be changed from the browser.</p>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-foreground">MATM History</h2><button onClick={fetchHistory} className="text-sm text-muted-foreground flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</button></div>
                    {history.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No MATM transactions yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border/50"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Terminal</th><th className="py-2">Status</th></tr></thead><tbody>{history.map((row) => { const item = statusMap[row.status] || statusMap.PENDING; const Icon = item.icon; return <tr key={row.transactionId} className="border-b border-border/30"><td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{new Date(row.createdAt).toLocaleString('en-IN')}</td><td className="py-3 pr-4 font-medium">₹ {row.amount}</td><td className="py-3 pr-4">{row.metadata?.terminalId || '—'}</td><td className="py-3"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${item.cls}`}><Icon className="w-3.5 h-3.5" />{row.status}</span></td></tr>; })}</tbody></table></div>}
                </div>
            </div>
        </div>
    );
};

export default MATM;
