import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Copy, Check, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

/**
 * Collecting money from a customer.
 *
 * A payment link is a one-off order the customer pays by UPI, card or
 * netbanking; the retailer's wallet is credited once the gateway confirms it,
 * which is why nothing here trusts the customer's own "I paid" and every order
 * is verified against the gateway before anything is shown as received.
 *
 * The standing counter QR is issued from UPI Payments, not here, but its
 * proceeds are collections too, so they are listed below alongside the links.
 */
const Collect = () => {
    const { token } = useAuth();
    const [searchParams] = useSearchParams();

    const [form, setForm] = useState({ name: '', mobile: '', email: '', amount: '' });
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const api = `${import.meta.env.VITE_BACKEND_URL}/api/collect`;
    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${api}/history`, getHeaders());
            if (res.data.success) setHistory(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch collections', error);
        }
    };

    useEffect(() => {
        if (token) fetchHistory();
        if (!token) return;

        // Keep pending collection rows synchronized while this page is open.
        // The backend rechecks Icchhamati and credits the wallet idempotently.
        const refreshTimer = window.setInterval(fetchHistory, 15000);
        return () => window.clearInterval(refreshTimer);
    }, [token]);

    const verify = async (reference: string, quiet = false) => {
        setVerifying(true);
        try {
            const res = await axios.post(`${api}/verify`, { transactionId: reference }, getHeaders());
            const status = res.data.data?.status || 'PENDING';
            if (status === 'SUCCESS') {
                toast.success(res.data.message || 'Payment received');
                window.dispatchEvent(new Event('wallet-updated'));
            } else if (status === 'PENDING') {
                if (!quiet) toast.info(res.data.message || 'Payment not completed yet');
            } else {
                toast.error(res.data.message || 'Payment failed');
            }
            setOrder((prev: any) => (prev && prev.transactionId === reference ? { ...prev, status } : prev));
            fetchHistory();
        } catch (error: any) {
            if (!quiet) toast.error(error.response?.data?.message || 'Could not verify the payment');
        } finally {
            setVerifying(false);
        }
    };

    // The gateway sends the customer back here after checkout. The redirect only
    // says which order it was, never whether it was paid, so the result still
    // has to come from the gateway.
    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref && token) verify(ref, true);
    }, [searchParams, token]);

    const createOrder = async () => {
        const amount = Number(form.amount);
        if (!form.name.trim()) return toast.error("Enter the customer's name");
        if (form.mobile.length !== 10) return toast.error('Enter a valid 10-digit mobile number');
        // The gateway rejects an order without one, despite documenting it as
        // optional, so it is asked for here rather than failing at checkout.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            return toast.error("Enter the customer's email address");
        }
        // The gateway refuses anything smaller: "Minimum amount is 200.00".
        if (!(amount >= 200)) return toast.error('The minimum payment amount is ₹200');

        setLoading(true);
        try {
            const res = await axios.post(`${api}/order`, {
                name: form.name.trim(),
                mobile: form.mobile,
                email: form.email.trim(),
                amount,
            }, getHeaders());

            if (res.data.success) {
                setOrder({ ...res.data.data, status: 'PENDING' });
                setCopied(false);
                fetchHistory();
            } else {
                toast.error(res.data.message || 'Could not create the payment link');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not create the payment link');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = async () => {
        if (!order?.paymentUrl) return;
        await navigator.clipboard.writeText(order.paymentUrl);
        setCopied(true);
        toast.success('Payment link copied');
        setTimeout(() => setCopied(false), 2000);
    };

    const statusChip = (status: string) => {
        const map: Record<string, { cls: string; icon: any }> = {
            SUCCESS: { cls: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
            FAILED: { cls: 'bg-red-500/10 text-red-500', icon: XCircle },
            PENDING: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Clock },
        };
        const { cls, icon: Icon } = map[status] || map.PENDING;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${cls}`}>
                <Icon className="w-3.5 h-3.5" />
                {status}
            </span>
        );
    };

    const input = 'w-full px-3 py-2.5 bg-background border border-border/50 rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

    return (
        <div className="min-h-screen bg-background p-4 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Link2 className="w-8 h-8 text-primary" />
                        Collect Payments
                    </h1>
                    <p className="text-muted-foreground">Send a customer a payment link they can pay by UPI, card or netbanking.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-xl font-bold text-foreground">New Payment Request</h2>

                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Customer Name</label>
                            <input type="text" className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Customer Mobile</label>
                            <input type="text" className={input} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Customer Email</label>
                            <input type="email" className={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Amount (₹)</label>
                            <input type="text" className={input} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} placeholder="0" />
                        </div>

                        <button onClick={createOrder} disabled={loading} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {loading ? 'Creating...' : 'Create Payment Link'}
                        </button>
                    </div>

                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        {order ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-foreground">₹ {order.amount}</h2>
                                    {statusChip(order.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">Order {order.orderId}</p>

                                <div className="bg-background border border-border/50 rounded-xl p-3 break-all text-sm text-foreground">
                                    {order.paymentUrl}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={copyLink} className="py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied' : 'Copy Link'}
                                    </button>
                                    <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="py-2.5 bg-background border border-border/50 text-foreground rounded-xl font-medium hover:border-primary/40 transition-colors flex items-center justify-center gap-2">
                                        <Link2 className="w-4 h-4" /> Open
                                    </a>
                                </div>

                                <button onClick={() => verify(order.transactionId)} disabled={verifying} className="w-full py-2.5 bg-background border border-border/50 text-foreground rounded-xl font-medium hover:border-primary/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                                    {verifying ? 'Checking...' : 'Check Payment Status'}
                                </button>

                                <p className="text-xs text-muted-foreground text-center">
                                    Your wallet is credited only once the gateway confirms the payment.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                    <Link2 className="w-8 h-8 text-primary opacity-80" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-1">No Active Request</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">Fill in the customer's details to create a payment link you can send them.</p>
                            </div>
                        )}
                    </div>
                </div>


                {/* Collections */}
                <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-foreground">Recent Collections</h2>
                        <button onClick={fetchHistory} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                    </div>

                    {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No payment requests yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground border-b border-border/50">
                                        <th className="py-2 pr-4 font-medium">Date</th>
                                        <th className="py-2 pr-4 font-medium">Customer</th>
                                        <th className="py-2 pr-4 font-medium">Amount</th>
                                        <th className="py-2 pr-4 font-medium">Status</th>
                                        <th className="py-2 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((row) => (
                                        <tr key={row.transactionId} className="border-b border-border/30">
                                            <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{new Date(row.createdAt).toLocaleString('en-IN')}</td>
                                            <td className="py-3 pr-4 text-foreground">{row.metadata?.payerName || '—'}</td>
                                            <td className="py-3 pr-4 font-medium text-foreground">₹ {row.amount}</td>
                                            <td className="py-3 pr-4">{statusChip(row.status)}</td>
                                            <td className="py-3">
                                                {row.status === 'PENDING' && (
                                                    <button onClick={() => verify(row.transactionId)} className="text-primary hover:underline text-xs font-medium">
                                                        Check
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Collect;
