import { useEffect, useRef, useState } from 'react';
import { QrCode, Phone, IndianRupee, RefreshCw, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { CopyButton } from '../components/animate-ui/components/buttons/copy';
import PrimaryCta, { Busy } from '../components/PrimaryCta';
import Lottie, { Confetti } from '../components/Lottie';

const SILVER_TILE = 'icon-chip';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';
const POLL_MS = 4000;
// Rate card range; the backend refuses anything outside it.
const MIN = 500;
const MAX = 5000;

type Txn = { transactionId: string; amount: number; status: string; customerMobile?: string; bankRRN?: string; payerName?: string; accountNumber?: string; message?: string; createdAt?: string };
type Qr = { transactionId: string; qrCode?: string; qrImage?: string; amount: number; expiresAt: number };

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
            setQr({ transactionId: d.transactionId, qrCode: d.qrCode || undefined, qrImage: d.qrImage || undefined, amount: d.amount, expiresAt: Date.now() + d.expiresIn * 1000 });
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
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">UPI Cash Withdrawal</h1>
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
                        <div className="flex flex-col items-center gap-4 text-center">
                            <p className="text-sm text-muted-foreground">Ask the customer to scan and pay</p>
                            <p className="text-3xl font-bold tabular-nums">₹{qr.amount.toLocaleString('en-IN')}</p>
                            <div className={`rounded-2xl bg-white p-4 ${secondsLeft ? '' : 'opacity-30'}`}>
                                {qr.qrImage ? (
                                    <img src={qr.qrImage} alt="UPI payment QR code" width={320} height={320} className="h-auto w-full max-w-[320px] object-contain" />
                                ) : qr.qrCode ? (
                                    <QRCodeSVG value={qr.qrCode} size={320} className="h-auto w-full max-w-[320px]" />
                                ) : null}
                            </div>
                            <p className="text-sm font-medium">
                                {secondsLeft
                                    ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} · waiting for payment…`
                                    : 'QR expired. If the customer already paid, check the status.'}
                            </p>
                            <p className="text-xs font-semibold text-amber-600">Do not give cash until this screen shows success.</p>
                            <div className="flex gap-2">
                                <button onClick={() => checkStatus(qr.transactionId)} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" />Check status</button>
                                <button onClick={reset} className="rounded-xl px-4 py-2 text-sm text-muted-foreground">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={start} className="flex flex-col gap-4">
                            <label className="flex flex-col gap-1.5 text-sm font-medium">
                                <span className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" />Amount</span>
                                <input required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 500" className={INPUT} />
                                <span className={`text-xs font-normal ${amountError ? 'text-red-600' : 'text-muted-foreground'}`}>{amountError || `₹${MIN} – ₹${MAX.toLocaleString('en-IN')}`}</span>
                            </label>
                            <label className="flex flex-col gap-1.5 text-sm font-medium">
                                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Customer Mobile</span>
                                <input required inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className={INPUT} />
                                {mobileError && <span className="text-xs font-normal text-red-600">{mobileError}</span>}
                            </label>
                            <PrimaryCta disabled={busy || !valid} className="text-sm font-semibold">
                                <QrCode className="h-4 w-4" />{busy ? <Busy text="Generating…" /> : 'Generate QR'}
                            </PrimaryCta>
                        </form>
                    )}
                </section>
            </div>
        </div>
    );
};

export default UpiCashWithdrawal;
