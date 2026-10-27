import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Copy, Check, RefreshCw, Clock, CheckCircle2, XCircle, User, Phone, Mail, Loader2, ExternalLink, ShieldCheck, QrCode, Inbox, Download, Wallet, ArrowRight, Landmark, Lock } from 'lucide-react';
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
 *
 * The standing counter QR is issued here too. Its payments settle into the
 * platform's Icchhamati wallet and are credited to the retailer's QR wallet,
 * less Icchhamati's charge, from which the retailer moves them to Main.
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
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
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
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* New request */}
                <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
                    <h2 className="text-lg font-semibold">New Payment Request</h2>
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
                        <div className="flex flex-wrap gap-2">
                            {[200, 500, 1000, 2000, 5000].map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setForm({ ...form, amount: String(v) })}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-all ${form.amount === String(v) ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                >
                                    ₹{v.toLocaleString('en-IN')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={createOrder} disabled={loading} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`}>
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                        {loading ? 'Creating...' : 'Create Payment Link'}
                    </button>
                </section>

                <CounterQr api={api} getHeaders={getHeaders} />

                {/* Active request */}
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                    {order ? (
                        <div className="flex flex-col gap-4">
                            <div className="relative overflow-hidden rounded-2xl hero-panel p-5">
                                <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#F47920]/25 blur-2xl" />
                                <div className="relative flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs uppercase tracking-wider opacity-70">Payment request</p>
                                        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">₹{Number(order.amount).toLocaleString('en-IN')}</p>
                                        <p className="mt-2 truncate font-mono text-xs opacity-70">Order {order.orderId}</p>
                                        <div className="mt-3">{statusChip(order.status)}</div>
                                    </div>
                                    {order.paymentUrl && (
                                        <div className="shrink-0 rounded-xl bg-white p-2 shadow-md">
                                            <QRCodeSVG value={order.paymentUrl} size={112} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-center text-xs text-muted-foreground">The customer can scan the QR or open the link you send.</p>

                            <div className="flex items-center gap-2 rounded-xl border bg-background/50 p-2 pl-3">
                                <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{order.paymentUrl}</p>
                                <button onClick={copyLink} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${ACTIVE_BUTTON}`}>
                                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                    <ExternalLink className="w-4 h-4" /> Open
                                </a>
                                <button onClick={() => verify(order.transactionId)} disabled={verifying} className="flex items-center justify-center gap-2 rounded-xl border py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50">
                                    <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                                    {verifying ? 'Checking...' : 'Check Status'}
                                </button>
                            </div>

                            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Your wallet is credited only once the gateway confirms the payment.
                            </p>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                            <div className={`mb-4 rounded-2xl p-4 ${SILVER_TILE}`}>
                                <QrCode className="h-8 w-8" />
                            </div>
                            <h3 className="mb-1 text-lg font-semibold">No active request</h3>
                            <p className="max-w-xs text-sm text-muted-foreground">Fill in the customer's details to create a payment link and QR you can share.</p>
                        </div>
                    )}
                </section>

                <QrWallet getHeaders={getHeaders} history={history} />
            </div>

            {/* Collections */}
            <section className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent Collections</h2>
                    <button onClick={fetchHistory} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
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
                                            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                {row.metadata?.collectionChannel === 'QR' ? <QrCode className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                                {row.metadata?.collectionChannel === 'QR' ? 'QR' : 'Link'}
                                            </span>
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

type Qr = { virtualAccountId: string; upiHandle: string | null; qrImage: string | null; name: string | null; qrPdf?: string | null };

/** The retailer's standing counter QR. */
const CounterQr = ({ api, getHeaders }: { api: string; getHeaders: () => object }) => {
    const { user } = useAuth();
    const [qr, setQr] = useState<Qr | null>(null);
    const [qrLoaded, setQrLoaded] = useState(false);
    const [form, setForm] = useState({ name: user?.name || '', account_number: '', account_ifsc: '' });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        axios.get(`${api}/qr`, getHeaders())
            .then((res) => res.data.success && setQr(res.data.data))
            .catch(() => {})
            .finally(() => setQrLoaded(true));
    }, []);

    const generate = async () => {
        if (!form.name.trim() || !form.account_number || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.account_ifsc)) {
            return toast.error('Enter the account holder name, account number and a valid IFSC');
        }
        setGenerating(true);
        try {
            const res = await axios.post(`${api}/qr`, form, getHeaders());
            if (res.data.success) {
                setQr(res.data.data);
                toast.success(res.data.message || 'QR code generated');
            } else toast.error(res.data.message || 'Could not generate the QR code');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not generate the QR code');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Counter QR</h2>
            <p className="mb-4 text-sm text-muted-foreground">A standing UPI QR to print for your counter. Every payment is credited to your QR wallet automatically.</p>
            {!qrLoaded ? (
                <div className="flex min-h-[200px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : qr ? (
                <div className="flex flex-col items-center gap-3 text-center">
                    {qr.qrImage && <img src={qr.qrImage} alt="Your UPI QR code" className="w-56 rounded-xl border bg-white p-2" />}
                    {qr.upiHandle && <p className="break-all font-mono text-sm font-medium">{qr.upiHandle}</p>}
                    <p className="text-xs text-muted-foreground">Virtual account {qr.virtualAccountId}</p>
                    <div className="grid w-full grid-cols-2 gap-3">
                        {qr.qrImage && (
                            <a href={qr.qrImage} download="shahparpay-qr.png" className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                <Download className="h-4 w-4" /> Image
                            </a>
                        )}
                        {qr.qrPdf && (
                            <a href={qr.qrPdf} download="shahparpay-qr.pdf" className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
                                <Download className="h-4 w-4" /> Printable PDF
                            </a>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">Account holder name</label>
                        <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">Account number</label>
                            <input className={`${INPUT} font-mono`} inputMode="numeric" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '').slice(0, 18) })} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">IFSC</label>
                            <input className={`${INPUT} font-mono uppercase`} value={form.account_ifsc} onChange={(e) => setForm({ ...form, account_ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })} />
                        </div>
                    </div>
                    <button onClick={generate} disabled={generating} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-50 ${ACTIVE_BUTTON}`}>
                        {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                        {generating ? 'Generating...' : 'Generate QR'}
                    </button>
                </div>
            )}
        </section>
    );
};

/** The QR wallet counter-QR payments land in, and the move to Main. */
const QrWallet = ({ getHeaders, history }: { getHeaders: () => object; history: any[] }) => {
    const [qrBalance, setQrBalance] = useState(0);
    const [move, setMove] = useState({ amount: '', pin: '' });
    const [moving, setMoving] = useState(false);
    const walletApi = `${import.meta.env.VITE_BACKEND_URL}/api/wallet`;

    const fetchBalance = async () => {
        try {
            const res = await axios.get(`${walletApi}/balance`, getHeaders());
            if (res.data.success) setQrBalance(Number(res.data.data?.qrBalance) || 0);
        } catch { /* the balance tile just stays as it was */ }
    };

    // A QR payment arrives by webhook and shows up in the history; the balance
    // here and in the header follow it.
    const qrCredits = history.filter((r) => r.metadata?.collectionChannel === 'QR').length;
    useEffect(() => {
        fetchBalance();
        if (qrCredits) window.dispatchEvent(new Event('wallet-updated'));
    }, [qrCredits]);

    const moveToMain = async () => {
        const amount = Number(move.amount);
        if (!(amount > 0)) return toast.error('Enter an amount');
        if (amount > qrBalance) return toast.error('That is more than your QR wallet balance');
        if (!/^\d{4}$/.test(move.pin)) return toast.error('Enter your 4-digit wallet PIN');
        setMoving(true);
        try {
            const res = await axios.post(`${walletApi}/transfer`, { amount, pin: move.pin }, getHeaders());
            if (res.data.success) {
                toast.success(res.data.message || 'Moved to your main wallet');
                setMove({ amount: '', pin: '' });
                fetchBalance();
                window.dispatchEvent(new Event('wallet-updated'));
            } else toast.error(res.data.message || 'Transfer failed');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setMoving(false);
        }
    };

    return (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">QR wallet</h2>
                    <p className="text-sm text-muted-foreground">Counter QR payments land here, less the provider's charge.</p>
                </div>
                <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}><Wallet className="h-5 w-5" /></div>
            </div>
            <p className="text-4xl font-bold tracking-tight tabular-nums">₹{qrBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Amount</label>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">₹</span>
                        <input inputMode="decimal" className={`${INPUT} pl-8 tabular-nums`} value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>
                    <button type="button" onClick={() => setMove({ ...move, amount: String(qrBalance) })} className="self-start text-xs font-semibold text-muted-foreground hover:text-foreground">Use full balance</button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Wallet PIN</label>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input type="password" inputMode="numeric" autoComplete="off" className={`${INPUT} pl-10 tracking-[0.4em]`} value={move.pin} onChange={(e) => setMove({ ...move, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                    </div>
                </div>
            </div>
            <button onClick={moveToMain} disabled={moving || qrBalance <= 0} className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-50 ${ACTIVE_BUTTON}`}>
                {moving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Landmark className="h-5 w-5" />}
                {moving ? 'Moving...' : 'Move to main wallet'}
                {!moving && <ArrowRight className="h-4 w-4" />}
            </button>
        </section>
    );
};

export default Collect;