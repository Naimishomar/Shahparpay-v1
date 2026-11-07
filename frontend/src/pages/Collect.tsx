import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Copy, Check, RefreshCw, Clock, CheckCircle2, XCircle, User, Phone, Mail, Loader2, ExternalLink, ShieldCheck, QrCode, Inbox } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useVisiblePolling } from '../hooks/use-visible-polling';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

/**
 * Collecting money from a customer.
 *
 * A payment link is a one-off order the customer pays by UPI, card or
 * netbanking; the retailer's wallet is credited once the gateway confirms it,
 * which is why nothing here trusts the customer's own "I paid" and every order
 * is verified against the gateway before anything is shown as received.
 */
/** `embedded`: shown inside Fund Request, which supplies the page heading. */
const Collect = ({ embedded = false }: { embedded?: boolean }) => {
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
    }, [token]);

    // Keep pending collection rows synchronized while this page is open — but
    // only while something is actually pending; settled history never changes.
    const hasPending = history.some((row: any) => row.status === 'PENDING');
    useVisiblePolling(fetchHistory, 20000, Boolean(token) && hasPending, false);

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

    // Brings an earlier link back into the request card, to share or check again.
    const showOrder = (row: any) => {
        setOrder({
            transactionId: row.transactionId,
            orderId: row.metadata?.orderId || row.transactionId,
            paymentUrl: row.metadata.paymentUrl,
            amount: row.amount,
            status: row.status,
        });
        setCopied(false);
        document.getElementById('payment-request')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            SUCCESS: { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20', icon: CheckCircle2 },
            FAILED: { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20', icon: XCircle },
            PENDING: { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20', icon: Clock },
        };
        const { cls, icon: Icon } = map[status] || map.PENDING;
        return (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>
                <Icon className="w-3.5 h-3.5" />
                {status}
            </span>
        );
    };

    const collected = history.filter((r) => r.status === 'SUCCESS').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const pendingCount = history.filter((r) => r.status === 'PENDING').length;
    const fields = [
        { key: 'name', label: 'Customer Name', icon: User, type: 'text', placeholder: 'Full name', clean: (v: string) => v },
        { key: 'mobile', label: 'Customer Mobile', icon: Phone, type: 'text', placeholder: '10-digit mobile', clean: (v: string) => v.replace(/\D/g, '').slice(0, 10) },
        { key: 'email', label: 'Customer Email', icon: Mail, type: 'email', placeholder: 'name@example.com', clean: (v: string) => v },
    ] as const;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            {!embedded && <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Link2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Collect Payments</h1>
                            <p className="text-sm text-muted-foreground">Send a payment link the customer can pay by UPI, card or netbanking.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Collected</p>
                            <p className="text-xl font-bold tabular-nums">₹{collected.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Pending</p>
                            <p className="text-xl font-bold tabular-nums">{pendingCount}</p>
                        </div>
                    </div>
                </div>
            </section>}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* New request: the form, and beside it the link's QR once created */}
                <section id="payment-request" className="scroll-mt-24 rounded-2xl border bg-card p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold">New Payment Request</h2>
                    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
                        <div className="flex min-w-0 flex-col gap-3">
                            {fields.map(({ key, label, icon: Icon, type, placeholder, clean }) => (
                                <div key={key} className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">{label}</label>
                                    <div className="relative">
                                        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input type={type} className={`${INPUT} pl-10`} placeholder={placeholder} value={form[key]} onChange={e => setForm({ ...form, [key]: clean(e.target.value) })} />
                                    </div>
                                </div>
                            ))}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Amount</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">₹</span>
                                    <input type="text" inputMode="numeric" className={`${INPUT} pl-8 text-lg font-semibold tabular-nums`} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} placeholder="Minimum ₹200" />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[200, 500, 1000, 2000, 5000].map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setForm({ ...form, amount: String(v) })}
                                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums transition-all ${form.amount === String(v) ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        >
                                            ₹{v.toLocaleString('en-IN')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={createOrder} disabled={loading} className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                                {loading ? 'Creating...' : 'Create Payment Link'}
                            </button>
                        </div>

                        {order ? (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-background/50 p-4 text-center">
                                {order.paymentUrl && (
                                    <div className="rounded-xl bg-white p-2 shadow-sm">
                                        <QRCodeSVG value={order.paymentUrl} size={148} />
                                    </div>
                                )}
                                <p className="text-2xl font-bold tracking-tight tabular-nums">₹{Number(order.amount).toLocaleString('en-IN')}</p>
                                {statusChip(order.status)}
                                <p className="w-full truncate font-mono text-[11px] text-muted-foreground">Order {order.orderId}</p>
                                <div className="grid w-full gap-2">
                                    <button onClick={copyLink} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${ACTIVE_BUTTON}`}>
                                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        {copied ? 'Copied' : 'Copy link'}
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                            <ExternalLink className="h-3.5 w-3.5" /> Open
                                        </a>
                                        <button onClick={() => verify(order.transactionId)} disabled={verifying} className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50">
                                            <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} /> Status
                                        </button>
                                    </div>
                                </div>
                                <p className="flex items-start gap-1 text-left text-[11px] text-muted-foreground">
                                    <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                                    Credited only once the gateway confirms it.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center">
                                <div className={`mb-3 rounded-2xl p-3 ${SILVER_TILE}`}>
                                    <QrCode className="h-7 w-7" />
                                </div>
                                <p className="text-sm font-semibold">No active request</p>
                                <p className="mt-1 text-xs text-muted-foreground">The payment link and its QR appear here.</p>
                            </div>
                        )}
                    </div>
                </section>

            </div>

            {/* Collections */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent Collections</h2>
                </div>

                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <Inbox className="h-8 w-8 mb-2 opacity-60" />
                        <p className="text-sm">No payment requests yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-black/[0.03] dark:bg-white/[0.04]">
                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Customer</th>
                                    <th className="px-4 py-3 font-semibold">Channel</th>
                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((row) => (
                                    <tr key={row.transactionId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(row.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</td>
                                        <td className="px-4 py-3 font-medium">{row.metadata?.payerName || row.metadata?.remitterName || '—'}</td>
                                        <td className="px-4 py-3">
                                            {row.metadata?.paymentUrl ? (
                                                <button type="button" onClick={() => showOrder(row)} title="Show this link and its QR" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground">
                                                    <Link2 className="h-3 w-3" /> Link
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                    {row.metadata?.collectionChannel === 'QR' ? <QrCode className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                                    {row.metadata?.collectionChannel === 'QR' ? 'QR' : 'Link'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-semibold tabular-nums">₹ {row.amount}</td>
                                        <td className="px-4 py-3">{statusChip(row.status)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {row.status === 'PENDING' && (
                                                <button onClick={() => verify(row.transactionId)} className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
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
            </section>
        </div>
    );
};

export default Collect;