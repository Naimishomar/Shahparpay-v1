import { useEffect, useRef, useState } from 'react';
import { QrCode, RefreshCw, XCircle, ScanLine, Banknote, ShieldAlert, Timer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { CopyButton } from '../components/animate-ui/components/buttons/copy';
import PrimaryCta, { Busy } from '../components/PrimaryCta';
import Lottie, { Confetti } from '../components/Lottie';
import { TitleText } from '../components/BlurText';

const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const POLL_MS = 4000;
// Rate card range; the backend refuses anything outside it.
const MIN = 500;
const MAX = 5000;
// One tap for the usual amounts, all inside the rate card range.
const QUICK = [500, 1000, 2000, 3000, 5000];
const STEPS = [
    { icon: QrCode, title: 'Generate the QR', text: 'Enter the amount and the customer’s mobile.' },
    { icon: ScanLine, title: 'Customer scans and pays', text: 'From any UPI app: PhonePe, GPay, Paytm, BHIM.' },
    { icon: Banknote, title: 'Hand over the cash', text: 'Only after this screen says the payment is received.' },
] as const;

type Txn = { transactionId: string; amount: number; status: string; customerMobile?: string; bankRRN?: string; payerName?: string; accountNumber?: string; message?: string; createdAt?: string };
type Qr = { transactionId: string; qrCode?: string; qrImage?: string; amount: number; expiresAt: number; ttl: number };

/**
 * UPI cash withdrawal: the customer scans a QR for the amount and pays from their
 * UPI app; the Trade wallet is credited when the bank confirms, and only then is
 * the cash handed over.
 */
const UpiCashWithdrawal = () => {
    const { token } = useAuth();
    const { location } = useLocationContext();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/aeps/icchhamati/upicw`;
    const headers = { headers: { Authorization: `Bearer ${token}` } };

    const [amount, setAmount] = useState('');
    const [mobile, setMobile] = useState('');
    const [busy, setBusy] = useState(false);
    const [qr, setQr] = useState<Qr | null>(null);
    const [result, setResult] = useState<Txn | null>(null);
    const [now, setNow] = useState(Date.now());
    const polling = useRef(false);

    const checkStatus = async (transactionId: string, quiet = false) => {
        try {
            const res = await axios.post(`${api}/status`, { transactionId }, headers);
            const txn: Txn = res.data?.data;
            if (txn?.status === 'SUCCESS' || txn?.status === 'FAILED') {
                setQr(null);
                setResult(txn);
            } else if (!quiet) toast.info('Payment not received yet.');
            return txn;
        } catch (err: any) {
            if (!quiet) toast.error(err?.response?.data?.message || 'Could not check the status');
            return null;
        }
    };

    // While a QR is up: tick the countdown and ask the bank every few seconds.
    useEffect(() => {
        if (!qr) return;
        const tick = setInterval(() => setNow(Date.now()), 1000);
        const poll = setInterval(async () => {
            if (polling.current) return;
            polling.current = true;
            await checkStatus(qr.transactionId, true);
            polling.current = false;
        }, POLL_MS);
        return () => { clearInterval(tick); clearInterval(poll); };
    }, [qr]); // eslint-disable-line react-hooks/exhaustive-deps

    const start = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location) return toast.error('Allow location access to continue.');
        setBusy(true);
        setResult(null);
        try {
            const res = await axios.post(`${api}/initiate`, {
                amount: Number(amount),
                customerMobile: mobile,
                latitude: location.latitude,
                longitude: location.longitude,
            }, headers);
            const d = res.data.data;
            setQr({ transactionId: d.transactionId, qrCode: d.qrCode || undefined, qrImage: d.qrImage || undefined, amount: d.amount, expiresAt: Date.now() + d.expiresIn * 1000, ttl: d.expiresIn });
            setNow(Date.now());
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Could not start the UPI cash withdrawal');
        }
        setBusy(false);
    };

    const reset = () => { setQr(null); setResult(null); setAmount(''); setMobile(''); };
    const secondsLeft = qr ? Math.max(0, Math.round((qr.expiresAt - now) / 1000)) : 0;
    // Why Generate QR is off, shown once the field has something in it.
    const amountError = amount && (Number(amount) < MIN || Number(amount) > MAX) ? `Amount must be between ₹${MIN} and ₹${MAX.toLocaleString('en-IN')}.` : '';
    const mobileError = mobile && !/^[6-9]\d{9}$/.test(mobile) ? 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.' : '';
    const valid = !!amount && !!mobile && !amountError && !mobileError;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><QrCode className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="UPI Cash Withdrawal" /></h1>
                        <p className="text-sm text-muted-foreground">The customer scans a QR and pays from any UPI app; you hand over cash once it is confirmed.</p>
                    </div>
                </div>
            </section>

            <div className="w-full">
                <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
                    {result ? (
                        <div className="flex flex-col items-center gap-3 text-center py-6">
                            {result.status === 'SUCCESS'
                                ? <><Lottie name="payment" size={150} loop={false} className="-my-4" /><Confetti /></>
                                : <XCircle className="h-14 w-14 text-red-500" />}
                            <h2 className="text-xl font-bold">
                                {result.status === 'SUCCESS' ? `Received ₹${result.amount.toLocaleString('en-IN')}` : 'Payment failed'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {result.status === 'SUCCESS'
                                    ? <>Credited to your Trade Wallet. <b className="text-foreground">Hand over ₹{result.amount.toLocaleString('en-IN')} cash now.</b></>
                                    : result.message || 'No money was received. Do not give cash.'}
                            </p>
                            {result.bankRRN && <p className="flex items-center gap-1 text-xs text-muted-foreground">RRN {result.bankRRN} <CopyButton content={result.bankRRN} variant="ghost" size="xs" aria-label="Copy RRN" />{result.payerName ? ` · ${result.payerName}` : ''}{result.accountNumber ? ` · A/C ${result.accountNumber}` : ''}</p>}
                            <PrimaryCta type="button" onClick={reset} className="mt-2 py-2.5 text-sm font-semibold">New withdrawal</PrimaryCta>
                        </div>
                    ) : qr ? (
                        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                            <p className="text-sm text-muted-foreground">Ask the customer to scan and pay</p>
                            <p className="text-4xl font-bold tracking-tight tabular-nums">₹{qr.amount.toLocaleString('en-IN')}</p>
                            <div className={`relative rounded-3xl bg-white p-4 shadow-lg ring-1 ring-black/5 transition-opacity ${secondsLeft ? '' : 'opacity-30'}`}>
                                {/* Corner marks frame the code like a scanner viewfinder. */}
                                {['left-1.5 top-1.5 border-l-2 border-t-2 rounded-tl-xl', 'right-1.5 top-1.5 border-r-2 border-t-2 rounded-tr-xl', 'left-1.5 bottom-1.5 border-l-2 border-b-2 rounded-bl-xl', 'right-1.5 bottom-1.5 border-r-2 border-b-2 rounded-br-xl'].map((c) => (
                                    <span key={c} aria-hidden className={`absolute size-6 border-[#7C6BD6] ${c}`} />
                                ))}
                                {qr.qrImage ? (
                                    <img src={qr.qrImage} alt="UPI payment QR code" width={280} height={280} className="h-auto w-full max-w-[280px] object-contain" />
                                ) : qr.qrCode ? (
                                    <QRCodeSVG value={qr.qrCode} size={280} className="h-auto w-full max-w-[280px]" />
                                ) : null}
                            </div>
                            {/* Time left as a draining bar, then in words. */}
                            <div className="w-full max-w-[312px]">
                                <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                                    <div
                                        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${secondsLeft > 30 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${qr.ttl ? Math.min(100, (secondsLeft / qr.ttl) * 100) : 0}%` }}
                                    />
                                </div>
                                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium">
                                    <Timer aria-hidden className="h-4 w-4 text-muted-foreground" />
                                    {secondsLeft
                                        ? <>Expires in <span className="tabular-nums">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span> · waiting for payment…</>
                                        : 'QR expired. If the customer already paid, check the status.'}
                                </p>
                            </div>
                            <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                                <ShieldAlert aria-hidden className="h-4 w-4" /> Do not give cash until this screen shows success.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => checkStatus(qr.transactionId)} className="flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"><RefreshCw className="h-4 w-4" />Check status</button>
                                <button onClick={reset} className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                            <form onSubmit={start} className="flex flex-col gap-6">
                                <div>
                                    <label htmlFor="upicw-amount" className="text-sm font-semibold">Amount</label>
                                    <div className="relative mt-2">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">₹</span>
                                        <input id="upicw-amount" required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="0" aria-describedby="upicw-amount-hint" className={`${INPUT} h-16 pl-11 text-3xl font-bold tabular-nums`} />
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {QUICK.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setAmount(String(v))}
                                                aria-pressed={Number(amount) === v}
                                                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-all active:scale-95 ${Number(amount) === v ? 'btn-primary' : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            >
                                                ₹{v.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                    <p id="upicw-amount-hint" className={`mt-2 text-xs ${amountError ? 'text-red-600' : 'text-muted-foreground'}`}>{amountError || `Any amount from ₹${MIN} to ₹${MAX.toLocaleString('en-IN')}.`}</p>
                                </div>
                                <div>
                                    <label htmlFor="upicw-mobile" className="text-sm font-semibold">Customer mobile</label>
                                    <div className="relative mt-2">
                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">+91</span>
                                        <input id="upicw-mobile" required inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className={`${INPUT} h-12 pl-14 text-base font-semibold tracking-wider tabular-nums`} />
                                    </div>
                                    {mobileError && <p className="mt-2 text-xs text-red-600">{mobileError}</p>}
                                </div>
                                <PrimaryCta disabled={busy || !valid} className="w-full font-semibold">
                                    <QrCode className="h-4 w-4" />{busy ? <Busy text="Generating…" /> : valid ? `Generate QR for ₹${Number(amount).toLocaleString('en-IN')}` : 'Generate QR'}
                                </PrimaryCta>
                            </form>

                            {/* How it goes, so a new retailer never hands over cash early. */}
                            <aside className="rounded-2xl border bg-background/50 p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
                                <ol className="mt-4 space-y-5">
                                    {STEPS.map(({ icon: Icon, title, text }, i) => (
                                        <li key={title} className="relative flex gap-3">
                                            {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[17px] top-10 bottom-[-1.25rem] w-px bg-border" />}
                                            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                            <span>
                                                <span className="block text-sm font-semibold">{i + 1}. {title}</span>
                                                <span className="block text-xs leading-relaxed text-muted-foreground">{text}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs font-medium leading-relaxed text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                                    <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                                    A screenshot from the customer is not proof. Wait for success here.
                                </p>
                            </aside>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default UpiCashWithdrawal;
