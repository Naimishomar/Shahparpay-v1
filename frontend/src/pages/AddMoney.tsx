import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { QrCode, RefreshCw, CheckCircle2, Clock, XCircle, Zap, Inbox, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

/**
 * Self-service wallet top-up.
 *
 * The retailer enters an amount, scans the QR with any UPI app, and the main
 * wallet is credited once Razorpay confirms the payment. The page polls for
 * that confirmation rather than asking the retailer whether they paid: the
 * backend only ever credits what Razorpay reports as captured.
 */

type Topup = {
  transactionId: string;
  /** Razorpay's hosted QR poster; the API returns no raw UPI string. */
  qrImage: string;
  amount: number;
  expiresAt: string;
};

type HistoryRow = {
  _id: string;
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
};

const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const statusStyles: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  SUCCESS: { icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' },
  PENDING: { icon: Clock, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' },
  FAILED: { icon: XCircle, className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20' },
};

const AddMoney = () => {
  const { token } = useAuth();
  const api = import.meta.env.VITE_BACKEND_URL;

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [topup, setTopup] = useState<Topup | null>(null);
  const [status, setStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED'>('PENDING');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${api}/api/topup/history`);
      if (res.data.success) setHistory(res.data.data);
    } catch {
      // The history table is not worth a toast: the QR still works without it.
    }
  };

  useEffect(() => {
    if (token) fetchHistory();
  }, [token]);

  // Stop polling when the page goes away, or a closed tab keeps hitting the API.
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startPolling = (transactionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${api}/api/topup/status/${transactionId}`);
        const next = res.data?.data?.status;
        if (next && next !== 'PENDING') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus(next);
          fetchHistory();
          if (next === 'SUCCESS') {
            toast.success(`₹${res.data.data.amount} added to your main wallet`);
          } else {
            toast.error('The payment did not go through.');
          }
        }
      } catch {
        // A dropped poll is not a failed payment — the webhook still settles it.
      }
    }, 4000);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value < 100) return toast.error('Enter an amount of ₹100 or more');

    setLoading(true);
    try {
      const res = await axios.post(`${api}/api/topup/qr`, { amount: value });
      if (res.data.success) {
        setTopup(res.data.data);
        setStatus('PENDING');
        startPolling(res.data.data.transactionId);
      } else {
        toast.error(res.data.message || 'Could not generate the QR');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not generate the QR');
    }
    setLoading(false);
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setTopup(null);
    setAmount('');
    setStatus('PENDING');
    fetchHistory();
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <QrCode className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Add Money</h1>
                            <p className="text-sm text-muted-foreground">Pay by UPI and your main wallet is credited instantly — no deposit slip, no approval.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start lg:self-auto rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Instant credit</span>
                    </div>
                </div>
            </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Amount stays on screen next to the QR: a retailer paying ₹5,000
            should be able to see what they asked for without dismissing the
            code. The fields lock while a QR is live because editing them
            changes nothing — the QR is already minted for a fixed amount. */}
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleGenerate} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="topup-amount">
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
                <input
                  id="topup-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                  min={100}
                  max={100000}
                  disabled={!!topup}
                  className={`${INPUT} pl-10 py-3.5 text-2xl font-bold tabular-nums disabled:opacity-60`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum ₹100, maximum ₹1,00,000 per payment.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  disabled={!!topup}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-all disabled:opacity-50 ${amount === String(value) ? `${ACTIVE_BUTTON} border-transparent` : 'bg-background hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  ₹{value.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {topup ? (
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
              >
                {status === 'PENDING' ? 'Cancel and start over' : 'Add more money'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold disabled:opacity-60 ${ACTIVE_BUTTON}`}
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
                {loading ? 'Generating…' : 'Generate UPI QR'}
              </button>
            )}

            <ul className="grid gap-2 border-t pt-5 text-xs text-muted-foreground sm:grid-cols-3">
              {[
                ['1', 'Enter an amount'],
                ['2', 'Scan with any UPI app'],
                ['3', 'Wallet credited on confirmation'],
              ].map(([n, text]) => (
                <li key={n} className="flex items-center gap-2 rounded-xl border bg-background/50 px-3 py-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold">{n}</span>
                  {text}
                </li>
              ))}
            </ul>
          </form>
        </section>

        {/* The QR panel keeps its height whether or not a code is showing, so
            generating one does not shove the page around. */}
        <section className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border bg-card p-6 text-center shadow-sm">
          {!topup ? (
            <div className="text-muted-foreground">
              <div className={`mx-auto inline-flex rounded-2xl p-4 ${SILVER_TILE}`}>
                <QrCode className="h-9 w-9" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Your UPI QR will appear here</p>
              <p className="mt-1 text-xs">Enter an amount and generate it</p>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-5 text-white shadow-lg dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl dark:bg-white/40" />
                <p className="relative text-xs uppercase tracking-wider opacity-70">Scan with any UPI app to pay</p>
                <p className="relative mt-1 text-3xl font-bold tabular-nums">₹{topup.amount.toLocaleString('en-IN')}</p>
                <div className="relative mx-auto mt-4 w-fit rounded-xl bg-white p-3 shadow-md">
                  <img src={topup.qrImage} alt="UPI QR" className="w-56 h-auto" />
                </div>
                <p className="relative mt-3 font-mono text-[11px] opacity-60">Ref {topup.transactionId}</p>
              </div>

              {status === 'PENDING' && (
                <p className="flex items-center justify-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Waiting for payment…
                </p>
              )}
              {status === 'SUCCESS' && (
                <p className="flex items-center justify-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" /> Added to your main wallet
                </p>
              )}
              {status === 'FAILED' && (
                <p className="flex items-center justify-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/20">
                  <XCircle className="h-4 w-4" /> Payment failed
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recent top-ups</h2>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2 opacity-60" />
            <p className="text-sm">No top-ups yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {history.slice(0, 15).map((row) => {
              const style = statusStyles[row.status] ?? statusStyles.PENDING;
              const Icon = style.icon;
              return (
                <div key={row._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`rounded-xl p-2 ${SILVER_TILE}`}>
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">₹{row.amount.toLocaleString('en-IN')}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · <span className="font-mono">{row.transactionId}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.className}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {row.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AddMoney;
