import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, Link2, Copy, Check, RefreshCw, Clock, CheckCircle2, XCircle, Download } from 'lucide-react';
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
 * The QR is different: a standing UPI code printed against the retailer's own
 * bank account. Money scanned into it settles to that bank account directly,
 * never through the wallet.
 */
const Collect = () => {
    const { token } = useAuth();
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState<'link' | 'qr'>('link');

    const [form, setForm] = useState({ name: '', mobile: '', email: '', amount: '' });
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const [qrForm, setQrForm] = useState({ name: '', account_number: '', account_ifsc: '' });
    const [qr, setQr] = useState<any>(null);
    const [bankVerification, setBankVerification] = useState<any>(null);
    const [verifyingBank, setVerifyingBank] = useState(false);

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
        // The gateway refuses anything smaller: "Minimum amount is 200.00".
        if (!(amount >= 200)) return toast.error('The minimum payment amount is ₹200');

        setLoading(true);
        try {
            const res = await axios.post(`${api}/order`, {
                name: form.name.trim(),
                mobile: form.mobile,
                email: form.email || undefined,
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

    const verifyBank = async () => {
        if (!qrForm.name.trim() || !qrForm.account_number || !qrForm.account_ifsc) {
            return toast.error('Enter the account holder name, account number and IFSC');
        }
        setVerifyingBank(true);
        try {
            const res = await axios.post(`${api}/verify-bank-account`, qrForm, getHeaders());
            const details = res.data.data || null;
            setBankVerification(details);
            if (res.data.success) toast.success(res.data.message || 'Bank account verified');
            else toast.error(res.data.message || 'Bank account details did not match');
        } catch (error: any) {
            setBankVerification(error.response?.data?.data || null);
            toast.error(error.response?.data?.message || 'Could not verify the bank account');
        } finally {
            setVerifyingBank(false);
        }
    };

    const generateQr = async () => {
        if (!qrForm.name.trim() || !qrForm.account_number || !qrForm.account_ifsc) {
            return toast.error('Enter the account holder name, account number and IFSC');
        }
        if (!bankVerification?.verified) {
            return toast.error('Verify the bank account before generating the QR code');
        }
        setLoading(true);
        try {
            const res = await axios.post(`${api}/qr`, qrForm, getHeaders());
            if (res.data.success) {
                setQr(res.data.data);
                toast.success(res.data.message || 'QR code generated');
            } else {
                toast.error(res.data.message || 'Could not generate the QR code');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not generate the QR code');
        } finally {
            setLoading(false);
        }
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
                        <QrCode className="w-8 h-8 text-primary" />
                        Collect Payments
                    </h1>
                    <p className="text-muted-foreground">Send a payment link or print a UPI QR to accept money from customers.</p>
                </div>

                <div className="flex items-center gap-2 border-b border-border/50">
                    <button
                        onClick={() => setTab('link')}
                        className={`pb-3 px-3 font-semibold flex items-center gap-2 transition-colors ${tab === 'link' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Link2 className="w-4 h-4" /> Payment Link
                    </button>
                    <button
                        onClick={() => setTab('qr')}
                        className={`pb-3 px-3 font-semibold flex items-center gap-2 transition-colors ${tab === 'qr' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <QrCode className="w-4 h-4" /> UPI QR
                    </button>
                </div>

                {tab === 'link' && (
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
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Customer Email <span className="text-muted-foreground font-normal">(optional)</span></label>
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
                )}

                {tab === 'qr' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                            <h2 className="text-xl font-bold text-foreground">Generate UPI QR</h2>
                            <p className="text-sm text-muted-foreground">
                                Money scanned into this QR settles straight to the bank account below — it does not pass through your wallet.
                            </p>

                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Account Holder Name</label>
                                <input type="text" className={input} value={qrForm.name} onChange={e => { setQrForm({ ...qrForm, name: e.target.value }); setBankVerification(null); }} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Account Number</label>
                                <input type="text" className={input} value={qrForm.account_number} onChange={e => { setQrForm({ ...qrForm, account_number: e.target.value.replace(/\D/g, '') }); setBankVerification(null); }} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">IFSC Code</label>
                                <input type="text" className={`${input} uppercase`} value={qrForm.account_ifsc} onChange={e => { setQrForm({ ...qrForm, account_ifsc: e.target.value.toUpperCase() }); setBankVerification(null); }} />
                            </div>

                            <button onClick={verifyBank} disabled={verifyingBank} className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-bold hover:bg-secondary/80 transition-colors disabled:opacity-50">
                                {verifyingBank ? 'Verifying...' : 'Verify Bank Account'}
                            </button>

                            {bankVerification && (
                                <div className={`rounded-xl border p-4 text-sm space-y-3 ${bankVerification.verified ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">Bank verification details</span>
                                        <span className={bankVerification.verified ? 'text-green-600' : 'text-red-600'}>{bankVerification.verified ? 'VERIFIED' : 'NOT VERIFIED'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-left">
                                        {[
                                            ['Transaction ID', bankVerification.txnid], ['Status', bankVerification.status],
                                            ['Account Name', bankVerification.AccountName], ['Account Number', bankVerification.AccountNumber],
                                            ['Account Status', bankVerification.accountStatus], ['Bank', bankVerification.bank_name],
                                            ['UTR', bankVerification.utr], ['City', bankVerification.city],
                                            ['Branch', bankVerification.branch], ['MICR', bankVerification.micr],
                                            ['Response', bankVerification.resText], ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                                            ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
                                        ].map(([label, value]) => <div key={label} className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium text-foreground break-words">{String(value ?? '—')}</div></div>)}
                                    </div>
                                </div>
                            )}

                            <button onClick={generateQr} disabled={loading || !bankVerification?.verified} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {loading ? 'Generating...' : 'Generate QR Code'}
                            </button>
                        </div>

                        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                            {qr ? (
                                <div className="space-y-4 w-full">
                                    {qr.qrImage && (
                                        <img src={qr.qrImage} alt="UPI QR code" className="w-56 h-56 mx-auto rounded-xl border border-border/50 bg-white p-2" />
                                    )}
                                    {qr.upiHandle && (
                                        <p className="text-sm font-medium text-foreground break-all">{qr.upiHandle}</p>
                                    )}
                                    {qr.virtualAccountId && (
                                        <p className="text-xs text-muted-foreground">Virtual account {qr.virtualAccountId}</p>
                                    )}
                                    {qr.qrPdf && (
                                        <a href={qr.qrPdf} download="upi-qr.pdf" className="w-full py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                                            <Download className="w-4 h-4" /> Download Printable QR
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                        <QrCode className="w-8 h-8 text-primary opacity-80" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-1">No QR Yet</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs">Enter your settlement account details to generate a QR you can print for the counter.</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

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
