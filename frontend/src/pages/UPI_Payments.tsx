import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Loader2, ExternalLink, RefreshCw, CheckCircle2, XCircle, Hourglass, Smartphone, IndianRupee } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

type TxnStatus = 'idle' | 'PENDING' | 'SUCCESS' | 'FAILED';

const UPI_Payments = () => {
    const { token, user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [mobile, setMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<TxnStatus>('idle');
    const [message, setMessage] = useState('');
    const [txn, setTxn] = useState<any>(null);
    const [polling, setPolling] = useState(false);
    const [merchantOk, setMerchantOk] = useState<boolean | null>(null);
    const [merchantStatusMsg, setMerchantStatusMsg] = useState('');
    const [checkingMerchant, setCheckingMerchant] = useState(true);
    const [onboarding, setOnboarding] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const getHeaders = () => ({ headers: { 'Authorization': `Bearer ${token}` } });

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        setPolling(false);
    };

    const checkMerchantStatus = async () => {
        setCheckingMerchant(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/upi/cashout/merchant-status`, getHeaders());
            if (res.data?.success) {
                setMerchantOk(res.data.data?.onboarded ?? null);
                setMerchantStatusMsg(res.data.data?.message || '');
            }
        } catch (error: any) {
            setMerchantOk(null);
            console.error('Merchant status check failed', error);
        } finally {
            setCheckingMerchant(false);
        }
    };

    // Kicks off PaySprint Bank 6 web onboarding for the current merchant.
    const handleStartOnboarding = async () => {
        const merchantId = user?.retailerId || user?.distributorId;
        if (!merchantId) return toast.error('Merchant code not found');
        setOnboarding(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                merchantId,
                isNew: false,
                pipe: 'bank6'
            }, getHeaders());

            if (res.data?.success && res.data.alreadyOnboarded) {
                toast.success('Your merchant is already onboarded on Bank 6!');
                checkMerchantStatus();
            } else if (res.data?.success && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener,noreferrer');
                toast.success('Bank 6 onboarding page opened. Complete it, then come back and re-check your status.');
            } else {
                toast.error(res.data?.message || 'Failed to start Bank 6 onboarding');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to start Bank 6 onboarding');
        } finally {
            setOnboarding(false);
        }
    };

    const checkStatus = async (transactionId: string) => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/upi/cashout/status`, { transactionId }, getHeaders());
            const data = res.data?.data;
            if (!res.data?.success || !data) return;

            setStatus(data.status);
            setTxn(data.transaction || null);
            setMessage(data.message || data.transaction?.metadata?.gatewayMessage || '');

            if (data.status === 'SUCCESS' || data.status === 'FAILED') {
                stopPolling();
                if (data.status === 'SUCCESS') {
                    window.dispatchEvent(new Event('wallet-updated'));
                    toast.success('UPI cashout successful! Amount credited to your MAIN wallet.');
                } else if (data.status === 'FAILED') {
                    toast.error(data.message || 'UPI cashout failed.');
                }
            }
        } catch (error: any) {
            console.error('Status check failed', error);
        }
    };

    const startPolling = (transactionId: string) => {
        stopPolling();
        setPolling(true);
        checkStatus(transactionId);
        pollRef.current = setInterval(() => checkStatus(transactionId), 4000);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkMerchantStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const txnId = searchParams.get('txn');
        if (txnId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            startPolling(txnId);
            setSearchParams({}, { replace: true });
        }
        return () => stopPolling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When the user returns from the PaySprint onboarding tab, refresh status.
    useEffect(() => {
        const onFocus = () => {
            if (!polling && merchantOk === false) checkMerchantStatus();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polling, merchantOk]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mobile || !amount) return toast.error('Enter customer mobile and amount');
        if (!/^\d{10}$/.test(mobile)) return toast.error('Enter a valid 10-digit customer mobile number');

        setLoading(true);
        setStatus('PENDING');
        setMessage('');
        setTxn(null);
        try {
            const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/upi/cashout/generate-token`, {
                mobile,
                amount: Number(amount)
            }, getHeaders());

            if (res.data?.success && res.data.data?.url) {
                window.open(res.data.data.url, '_blank', 'noopener,noreferrer');
                startPolling(res.data.data.transactionId);
                toast.success('UPI Cashout QR page opened. Awaiting customer payment...');
            } else {
                setStatus('FAILED');
                setMessage(res.data?.message || 'Failed to generate UPI cashout');
                toast.error(res.data?.message || 'Failed to generate UPI cashout');
            }
        } catch (error: any) {
            setStatus('FAILED');
            setMessage(error.response?.data?.message || 'Failed to initiate UPI cashout');
            toast.error(error.response?.data?.message || 'Failed to initiate UPI cashout');
        }
        setLoading(false);
    };

    const resetForm = () => {
        stopPolling();
        setStatus('idle');
        setMessage('');
        setTxn(null);
        setMobile('');
        setAmount('');
    };

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-3">
                        <Wallet className="w-7 h-7 text-primary" />
                        UPI Cashout
                    </h1>
                </div>
            </div>

            {checkingMerchant ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking merchant onboarding status...
                </div>
            ) : merchantOk === false ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-700 text-sm">
                    <div className="flex items-start gap-2">
                        <span>Your merchant is not onboarded for UPI Cashout (Bank 6). {merchantStatusMsg ? `PaySprint: ${merchantStatusMsg}` : 'Complete onboarding before accepting payments.'}</span>
                    </div>
                    <button
                        onClick={handleStartOnboarding}
                        disabled={onboarding}
                        className="flex items-center gap-2 justify-center bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                        {onboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                        Onboard for Bank 6
                    </button>
                </div>
            ) : merchantOk === true ? (
                <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Merchant is onboarded on Bank 6 — UPI Cashout is ready.</span>
                    </div>
                    <button
                        onClick={checkMerchantStatus}
                        className="flex items-center gap-2 justify-center border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap"
                    >
                        <RefreshCw className="w-4 h-4" /> Re-check
                    </button>
                </div>
            ) : null}

            {/* Main Container */}
            <div className="flex flex-col gap-6 glass-card p-6 rounded-2xl relative overflow-hidden group border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                            <h2 className="text-lg font-bold text-foreground">Give Cash, Get Paid via UPI</h2>
                            <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-600 rounded-full font-medium">Credits to Main Wallet</span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Customer Mobile</label>
                                    <div className="relative">
                                        <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="tel"
                                            value={mobile}
                                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder="10-digit mobile number"
                                            required
                                            disabled={polling}
                                            className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Amount (₹)</label>
                                    <div className="relative">
                                        <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            required
                                            min="1"
                                            disabled={polling}
                                            className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md focus:border-primary outline-none shadow-sm transition-colors text-foreground"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    disabled={loading || polling}
                                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-md font-medium transition-colors disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                    {polling ? 'Cashout In Progress...' : 'Start UPI Cashout'}
                                </button>

                                {polling && (
                                    <button
                                        type="button"
                                        onClick={() => { const id = txn?.transactionId; if (id) checkStatus(id); }}
                                        className="flex items-center gap-2 border border-border hover:bg-muted px-5 py-2.5 rounded-md font-medium transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Check Status
                                    </button>
                                )}

                                {status !== 'idle' && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex items-center gap-2 border border-border hover:bg-muted px-5 py-2.5 rounded-md font-medium transition-colors"
                                    >
                                        New Cashout
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Status Panel */}
                    {status !== 'idle' && (
                        <div className={`flex flex-col gap-3 p-5 rounded-xl border ${
                            status === 'SUCCESS' ? 'border-emerald-500/40 bg-emerald-500/10' :
                            status === 'FAILED' ? 'border-rose-500/40 bg-rose-500/10' :
                            'border-primary/30 bg-primary/5'
                        }`}>
                            <div className="flex items-center gap-3">
                                {status === 'SUCCESS' ? (
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                ) : status === 'FAILED' ? (
                                    <XCircle className="w-8 h-8 text-rose-500" />
                                ) : (
                                    <Hourglass className="w-8 h-8 text-primary animate-pulse" />
                                )}
                                <div className="flex flex-col gap-0.5">
                                    <span className={`text-lg font-bold ${
                                        status === 'SUCCESS' ? 'text-emerald-500' :
                                        status === 'FAILED' ? 'text-rose-500' : 'text-primary'
                                    }`}>
                                        {status === 'SUCCESS' ? 'Cashout Successful' :
                                         status === 'FAILED' ? 'Cashout Failed' : 'Awaiting Customer Payment...'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {status === 'PENDING' && polling
                                            ? 'QR page opened — ask the customer to scan and pay. You will be notified once the payment completes.'
                                            : message || (txn?.metadata?.gatewayMessage || '') || 'Processing...'}
                                    </span>
                                </div>
                            </div>

                            {txn && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Amount</span>
                                        <span className="text-sm font-semibold">₹ {txn.amount || 0}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Customer</span>
                                        <span className="text-sm font-semibold">{txn.metadata?.mobile || '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Reference</span>
                                        <span className="text-xs font-semibold truncate max-w-[120px]">{txn.metadata?.refid || txn.transactionId || '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Status</span>
                                        <span className="text-sm font-semibold uppercase">{status}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UPI_Payments;
