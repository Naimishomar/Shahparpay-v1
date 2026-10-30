import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, Clock, CreditCard, Loader2, RefreshCcw, Usb, Bluetooth, XCircle } from 'lucide-react';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE, inr } from '../components/distributor/shared';
import { useLocationContext } from '../context/LocationContext';

/* eslint-disable @typescript-eslint/no-explicit-any */

const API = `${import.meta.env.VITE_BACKEND_URL}/api/matm`;
// Icchhamati's (Fingpay) MATM driver, installed on the retailer's PC. It reads
// the card; our backend only signs its requests and records its results.
const DRIVER = 'http://localhost:8680/matmweb';
const TXN = { CW: 2, BE: 1 } as const;
type TxnType = keyof typeof TXN;

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

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex items-center gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><CreditCard className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Micro ATM</h1>
                        <p className="text-sm text-muted-foreground">Card cash withdrawal and balance enquiry</p>
                    </div>
                </div>
            </section>

            {login !== 'ok' ? (
                <section className={`${CARD} text-center`}>
                    {login === 'pending' ? (
                        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Signing in to the Micro ATM driver…</p>
                    ) : (
                        <>
                            <p className="font-semibold">Micro ATM driver not reachable</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Install and start the Micro ATM driver on this computer, complete AEPS registration if you have not, then try again.</p>
                            <button onClick={retrySignIn} className={`${SECONDARY_BUTTON} mt-4`}><RefreshCcw size={16} /> Retry</button>
                        </>
                    )}
                </section>
            ) : !connected ? (
                <section className={CARD}>
                    <p className={`${LABEL} mb-4`}>Connect the device</p>
                    <div className="mb-5 flex gap-3">
                        {([['0', 'USB', Usb], ['1', 'Bluetooth', Bluetooth]] as const).map(([value, label, Icon]) => (
                            <button key={value} onClick={() => setMode(value)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${mode === value ? 'btn-primary' : 'bg-background text-muted-foreground'}`}>
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={connect} disabled={busy} className={PRIMARY_BUTTON}>{busy && <Loader2 size={16} className="animate-spin" />} Connect device</button>
                </section>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                    <form onSubmit={submit} className={`${CARD} space-y-5`}>
                        <div className="flex gap-1 rounded-2xl border bg-background p-1.5 sm:w-max">
                            {([['CW', 'Cash withdrawal'], ['BE', 'Balance enquiry']] as const).map(([key, label]) => (
                                <button type="button" key={key} onClick={() => setTxn(key)} className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium sm:flex-none ${txn === key ? 'btn-primary' : 'text-muted-foreground'}`}>{label}</button>
                            ))}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1.5"><span className="text-sm font-medium">Customer mobile</span>
                                <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" className={INPUT} />
                            </label>
                            {txn === 'CW' && (
                                <label className="block space-y-1.5"><span className="text-sm font-medium">Amount</span>
                                    <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="Up to ₹10,000" className={INPUT} />
                                </label>
                            )}
                            <label className="block space-y-1.5 sm:col-span-2"><span className="text-sm font-medium">Remarks (optional)</span>
                                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={INPUT} />
                            </label>
                        </div>
                        <button disabled={busy} className={`${PRIMARY_BUTTON} w-full`}>
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} {busy ? 'Follow the device…' : 'Start — insert or swipe the card'}
                        </button>
                    </form>
                    <section className={CARD}>
                        <p className={`${LABEL} mb-4`}>Result</p>
                        {!result ? (
                            <p className="text-sm text-muted-foreground">The card’s result appears here.</p>
                        ) : (
                            <div className="space-y-3">
                                <p className="font-semibold">{result.message}</p>
                                <dl className="space-y-2 text-sm">
                                    {[
                                        ['Amount', result.data.transactionAmount ? inr.format(Number(result.data.transactionAmount)) : null],
                                        ['Account balance', result.data.balanceAmount !== undefined ? inr.format(Number(result.data.balanceAmount)) : null],
                                        ['Card', [result.data.cardType, result.data.cardNumber].filter(Boolean).join(' ')],
                                        ['Bank', result.data.bankName],
                                        ['Bank RRN', result.data.bankRRN],
                                        ['Transaction ID', result.data.fpTransactionId],
                                    ].filter(([, v]) => v).map(([k, v]) => (
                                        <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
                                    ))}
                                </dl>
                            </div>
                        )}
                    </section>
                </div>
            )}

            <section className={CARD}>
                <p className={`${LABEL} mb-4`}>Recent Micro ATM transactions</p>
                {history.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No Micro ATM transactions yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <tbody className="divide-y">
                                {history.map((row) => {
                                    const s = STATUS[row.status] || STATUS.PENDING;
                                    const Icon = s.icon;
                                    return (
                                        <tr key={row._id || row.transactionId}>
                                            <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{new Date(row.createdAt).toLocaleString('en-IN')}</td>
                                            <td className="py-3 pr-4">{row.metadata?.transactionType || '—'}</td>
                                            <td className="py-3 pr-4 font-medium tabular-nums">{inr.format(row.amount || 0)}</td>
                                            <td className="py-3"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${s.cls}`}><Icon className="h-3.5 w-3.5" />{row.status}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default IcchhamatiMATM;
