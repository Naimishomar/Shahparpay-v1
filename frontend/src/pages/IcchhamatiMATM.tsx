import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, Clock, CreditCard, Loader2, RefreshCcw, Usb, Bluetooth, XCircle, Banknote, Wallet, Check, Inbox, PlugZap } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { CARD, INPUT, LABEL, SECONDARY_BUTTON, SILVER_TILE, inr } from '../components/distributor/shared';
import { useLocationContext } from '../context/LocationContext';
import PrimaryCta, { Busy } from '../components/PrimaryCta';
import { TitleText } from '../components/BlurText';

/* eslint-disable @typescript-eslint/no-explicit-any */

const API = `${import.meta.env.VITE_BACKEND_URL}/api/matm`;
// Icchhamati's (Fingpay) MATM driver, installed on the retailer's PC. It reads
// the card; our backend only signs its requests and records its results.
const DRIVER = 'http://localhost:8680/matmweb';
const TXN = { CW: 2, BE: 1 } as const;
type TxnType = keyof typeof TXN;
// Quick amounts, all inside the ₹1 – ₹10,000 the form checks.
const QUICK = [500, 1000, 2000, 5000, 10000];
const RING = { type: 'spring', bounce: 0.18, duration: 0.45 } as const;

/** A numbered step: dot, title, hint, then its fields; a thin rail joins it to the next. */
const Step = ({ n, title, hint, last = false, children }: { n: number; title: string; hint?: string; last?: boolean; children: React.ReactNode }) => (
    <div className="relative pl-10">
        {!last && <span aria-hidden className="absolute left-[13px] top-8 bottom-[-1.25rem] w-px bg-border" />}
        <span aria-hidden className="absolute left-0 top-0 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">{n}</span>
        <p className="text-sm font-semibold leading-7">{title}</p>
        <p className="-mt-0.5 mb-3 text-xs text-muted-foreground">{hint}</p>
        {children}
    </div>
);

const STATUS: Record<string, { cls: string; icon: any }> = {
    SUCCESS: { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    PROCESSING: { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: Clock },
    PENDING: { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: Clock },
    FAILED: { cls: 'bg-red-500/10 text-red-700 dark:text-red-400', icon: XCircle },
};

/** Our backend's envelope, refusals included. */
const post = async (path: string, body: any) => {
    try {
        return (await axios.post(`${API}${path}`, body)).data;
    } catch (error: any) {
        return error?.response?.data || { success: false, message: 'Network error. Please try again.' };
    }
};

const IcchhamatiMATM = () => {
    const { location } = useLocationContext();
    const [driverToken, setDriverToken] = useState<string | null>(null);
    const [login, setLogin] = useState<'pending' | 'ok' | 'failed'>('pending');
    const [mode, setMode] = useState<'0' | '1'>('0');
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [txn, setTxn] = useState<TxnType>('CW');
    const [mobile, setMobile] = useState('');
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [result, setResult] = useState<{ status: string; message: string; data: any } | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    const loadHistory = () => axios.get(`${API}/history`).then((r) => setHistory(r.data?.data || [])).catch(() => {});

    /** Hands the driver its encrypted login; the driver answers with a session token. */
    const finishSignIn = async (config: any) => {
        if (!config.success) {
            toast.error(config.message || 'Micro ATM login failed');
            return setLogin('failed');
        }
        try {
            const res = await axios.post(`${DRIVER}/Login`, config.data, { headers: { 'Content-Type': 'text/plain' } });
            if (res.data?.status && res.data?.token) {
                setDriverToken(res.data.token);
                setLogin('ok');
            } else {
                toast.error(res.data?.message || 'Micro ATM login failed');
                setLogin('failed');
            }
        } catch {
            setLogin('failed');
        }
    };
    const fetchLogin = () => post('/config', { type: 'login' });

    useEffect(() => {
        fetchLogin().then(finishSignIn);
        axios.get(`${API}/history`).then((r) => setHistory(r.data?.data || [])).catch(() => {});
    }, []);
    const retrySignIn = () => {
        setLogin('pending');
        fetchLogin().then(finishSignIn);
    };

    const connect = async () => {
        setBusy(true);
        try {
            const res = await axios.get(`${DRIVER}/ConnectDevice`, { headers: { token: driverToken, mode } });
            setConnected(Boolean(res.data?.status));
            if (res.data?.status) toast.success(res.data?.message || 'Device connected');
            else toast.error(res.data?.message || 'Device connection failed');
        } catch {
            toast.error('Could not reach the Micro ATM driver. Is it running?');
        } finally {
            setBusy(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^[6-9]\d{9}$/.test(mobile)) return toast.error('Enter the customer’s 10-digit mobile number.');
        if (txn === 'CW' && !(Number(amount) >= 1 && Number(amount) <= 10000)) return toast.error('Amount must be between ₹1 and ₹10,000.');
        setBusy(true);
        setResult(null);
        try {
            const config = await post('/config', {
                type: 'doTransaction',
                txnType: TXN[txn],
                mobile,
                amount: txn === 'CW' ? Number(amount) : undefined,
                remarks,
                latitude: location?.latitude,
                longitude: location?.longitude,
            });
            if (!config.success) return toast.error(config.message || 'Could not start the transaction');

            const driver = (await axios.post(`${DRIVER}/DoTransaction`, config.data, { headers: { 'Content-Type': 'text/plain', token: driverToken } })).data;
            if (!driver?.status || !driver?.data) {
                setResult({ status: 'FAILED', message: driver?.message || 'Transaction failed on the device.', data: driver?.data || {} });
                return;
            }

            // Whatever the card said, the result is recorded; only the backend decides about money.
            const recorded = await post('/request', { mobile, data: driver.data });
            setResult({ status: recorded.status || (recorded.success ? 'SUCCESS' : 'FAILED'), message: recorded.message || driver.message, data: driver.data });
            if (recorded.success) {
                setMobile('');
                setAmount('');
                setRemarks('');
            }
            loadHistory();
        } catch {
            toast.error('The Micro ATM driver did not answer. Check the device and the transaction report before retrying.');
        } finally {
            setBusy(false);
        }
    };

    // Where the retailer is: driver sign-in, then the device, then the transaction.
    const stage = login !== 'ok' ? 0 : !connected ? 1 : 2;
    const STAGES = ['Driver sign-in', 'Connect device', 'Transaction'];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><CreditCard className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="Micro ATM" /></h1>
                            <p className="text-sm text-muted-foreground">Card cash withdrawal and balance enquiry</p>
                        </div>
                    </div>
                    {/* Progress through the three stages. */}
                    <ol aria-label="Progress" className="flex items-center gap-2">
                        {STAGES.map((label, i) => (
                            <li key={label} className="flex items-center gap-2">
                                <span
                                    aria-current={i === stage ? 'step' : undefined}
                                    className={cn('grid size-6 place-items-center rounded-full text-[11px] font-bold transition-colors',
                                        i < stage ? 'bg-emerald-500 text-white' : i === stage ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}
                                >
                                    {i < stage ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                                </span>
                                <span className={cn('whitespace-nowrap text-xs font-medium', i === stage ? 'text-foreground' : 'hidden text-muted-foreground sm:inline')}>{label}</span>
                                {i < STAGES.length - 1 && <span aria-hidden className={cn('h-px w-5 sm:w-8', i < stage ? 'bg-emerald-500' : 'bg-border')} />}
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {login !== 'ok' ? (
                <section className={`${CARD} flex flex-col items-center py-10 text-center`}>
                    {login === 'pending' ? (
                        <>
                            <span className={`grid size-14 place-items-center rounded-2xl ${SILVER_TILE}`}><Loader2 className="h-6 w-6 animate-spin" /></span>
                            <p className="mt-4 font-semibold">Signing in to the Micro ATM driver…</p>
                        </>
                    ) : (
                        <>
                            <span className="grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400"><PlugZap className="h-6 w-6" /></span>
                            <p className="mt-4 font-semibold">Micro ATM driver not reachable</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Install and start the Micro ATM driver on this computer, complete AEPS registration if you have not, then try again.</p>
                            <button onClick={retrySignIn} className={`${SECONDARY_BUTTON} mt-5`}><RefreshCcw size={16} /> Retry</button>
                        </>
                    )}
                </section>
            ) : !connected ? (
                <section className={`${CARD} mx-auto w-full max-w-2xl`}>
                    <h2 className="text-lg font-semibold">Connect the device</h2>
                    <p className="mb-5 text-sm text-muted-foreground">How is the Micro ATM attached to this computer?</p>
                    <div role="radiogroup" aria-label="Connection" className="grid gap-3 sm:grid-cols-2">
                        {([['0', 'USB', 'Cable to this computer', Usb], ['1', 'Bluetooth', 'Paired wirelessly', Bluetooth]] as const).map(([value, label, hint, Icon]) => {
                            const on = mode === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    onClick={() => setMode(value)}
                                    className={cn('relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98]', on ? 'border-transparent bg-background' : 'bg-background/50 hover:-translate-y-0.5 hover:shadow-md')}
                                >
                                    {on && <motion.span layoutId="matm-mode" aria-hidden transition={RING} className="absolute inset-0 rounded-xl ring-2 ring-primary" />}
                                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', on ? 'btn-primary' : SILVER_TILE)}><Icon className="h-5 w-5" /></span>
                                    <span>
                                        <span className="block text-sm font-semibold">{label}</span>
                                        <span className="block text-xs text-muted-foreground">{hint}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <PrimaryCta type="button" onClick={connect} disabled={busy} className="mt-6 w-full font-semibold">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} {busy ? <Busy text="Connecting…" /> : `Connect by ${mode === '0' ? 'USB' : 'Bluetooth'}`}
                    </PrimaryCta>
                </section>
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <form onSubmit={submit} className={`${CARD} flex flex-col gap-5`}>
                        <Step n={1} title="Transaction" hint="What the customer wants to do">
                            <div role="radiogroup" aria-label="Transaction" className="grid gap-3 sm:grid-cols-2">
                                {([['CW', 'Cash withdrawal', 'Up to ₹10,000', Banknote], ['BE', 'Balance enquiry', 'No money moves', Wallet]] as const).map(([key, label, hint, Icon]) => {
                                    const on = txn === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            role="radio"
                                            aria-checked={on}
                                            onClick={() => setTxn(key)}
                                            className={cn('relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]', on ? 'border-transparent bg-background' : 'bg-background/50 hover:-translate-y-0.5 hover:shadow-md')}
                                        >
                                            {on && <motion.span layoutId="matm-txn" aria-hidden transition={RING} className="absolute inset-0 rounded-xl ring-2 ring-primary" />}
                                            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', on ? 'btn-primary' : SILVER_TILE)}><Icon className="h-5 w-5" /></span>
                                            <span>
                                                <span className="block text-sm font-semibold">{label}</span>
                                                <span className="block text-xs text-muted-foreground">{hint}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Step>

                        <Step n={2} title="Customer" hint={txn === 'CW' ? 'Their mobile and the amount to withdraw' : 'Their mobile number'} last>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className={cn('space-y-1.5', txn !== 'CW' && 'sm:col-span-2')}>
                                    <label htmlFor="matm-mobile" className="text-sm font-medium">Customer mobile <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">+91</span>
                                        <input id="matm-mobile" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit mobile" className={cn(INPUT, 'h-12 pl-12 text-base font-semibold tracking-wider tabular-nums')} />
                                    </div>
                                </div>
                                {txn === 'CW' && (
                                    <div className="space-y-1.5">
                                        <label htmlFor="matm-amount" className="text-sm font-medium">Amount <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">₹</span>
                                            <input id="matm-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="Up to 10,000" className={cn(INPUT, 'h-12 pl-9 text-xl font-bold tabular-nums')} />
                                        </div>
                                    </div>
                                )}
                                {txn === 'CW' && (
                                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                                        {QUICK.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setAmount(String(v))}
                                                aria-pressed={Number(amount) === v}
                                                className={cn('rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-all active:scale-95', Number(amount) === v ? 'btn-primary border-transparent' : 'bg-background hover:bg-black/5 dark:hover:bg-white/5')}
                                            >
                                                ₹{v.toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label htmlFor="matm-remarks" className="text-sm font-medium">Remarks <span className="font-normal text-muted-foreground">(optional)</span></label>
                                    <input id="matm-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={cn(INPUT, 'h-11')} />
                                </div>
                            </div>
                        </Step>

                        <PrimaryCta disabled={busy} className="w-full font-semibold">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} {busy ? <Busy text="Follow the device…" /> : 'Start — insert or swipe the card'}
                        </PrimaryCta>
                    </form>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                        <section className={CARD}>
                            <p className={`${LABEL} mb-4`}>Result</p>
                            {!result ? (
                                <ol className="space-y-3 text-sm">
                                    {['Enter the details and press Start.', 'Insert or swipe the card and follow the device.', 'The card’s result appears here.'].map((t, i) => (
                                        <li key={t} className="flex items-start gap-3">
                                            <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${SILVER_TILE}`}>{i + 1}</span>
                                            <span className="pt-0.5 text-muted-foreground">{t}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    {(() => {
                                        const s = STATUS[result.status] || STATUS.PENDING;
                                        const Icon = s.icon;
                                        return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}><Icon className="h-3.5 w-3.5" />{result.status}</span>;
                                    })()}
                                    <p className="font-semibold">{result.message}</p>
                                    <dl className="space-y-2 border-t pt-3 text-sm">
                                        {[
                                            ['Amount', result.data.transactionAmount ? inr.format(Number(result.data.transactionAmount)) : null],
                                            ['Account balance', result.data.balanceAmount !== undefined ? inr.format(Number(result.data.balanceAmount)) : null],
                                            ['Card', [result.data.cardType, result.data.cardNumber].filter(Boolean).join(' ')],
                                            ['Bank', result.data.bankName],
                                            ['Bank RRN', result.data.bankRRN],
                                            ['Transaction ID', result.data.fpTransactionId],
                                        ].filter(([, v]) => v).map(([k, v]) => (
                                            <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right font-medium tabular-nums">{v}</dd></div>
                                        ))}
                                    </dl>
                                </div>
                            )}
                        </section>
                        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                            <span className="size-2 rounded-full bg-emerald-500" /> Device connected by {mode === '0' ? 'USB' : 'Bluetooth'}
                        </p>
                    </aside>
                </div>
            )}

            <section className={CARD}>
                <p className={`${LABEL} mb-4`}>Recent Micro ATM transactions</p>
                {history.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                        <Inbox className="mb-2 h-8 w-8 opacity-60" />
                        <p className="text-sm">No Micro ATM transactions yet.</p>
                    </div>
                ) : (
                    <ul className="stage-list divide-y">
                        {history.map((row) => {
                            const s = STATUS[row.status] || STATUS.PENDING;
                            const Icon = s.icon;
                            return (
                                <li key={row._id || row.transactionId} className="flex items-center gap-3 py-3">
                                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><CreditCard className="h-4 w-4" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{row.metadata?.transactionType || 'Micro ATM'}</span>
                                        <span className="block text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                                    </span>
                                    <span className="text-right">
                                        <span className="block text-sm font-semibold tabular-nums">{inr.format(row.amount || 0)}</span>
                                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}><Icon className="h-3 w-3" />{row.status}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default IcchhamatiMATM;
