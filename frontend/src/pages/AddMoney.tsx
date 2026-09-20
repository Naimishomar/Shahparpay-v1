import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
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
  /** The raw `upi://pay?...` request, rendered here as a plain QR. */
  qrContent: string;
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

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const statusStyles: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  SUCCESS: { icon: CheckCircle2, className: 'text-green-600 bg-green-50' },
  PENDING: { icon: Clock, className: 'text-amber-600 bg-amber-50' },
  FAILED: { icon: XCircle, className: 'text-red-600 bg-red-50' },
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
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <QrCode className="h-6 w-6" /> Add Money
        </h1>
        <p className="text-sm text-muted-foreground">
          Pay by UPI and your main wallet is credited instantly — no deposit slip, no approval.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Amount stays on screen next to the QR: a retailer paying ₹5,000
            should be able to see what they asked for without dismissing the
            code. The fields lock while a QR is live because editing them
            changes nothing — the QR is already minted for a fixed amount. */}
        <div className="rounded-xl border bg-card p-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="topup-amount">
                Amount
              </label>
              <input
                id="topup-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min={100}
                max={100000}
                disabled={!!topup}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-lg disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-muted-foreground">
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
                  className="rounded-full border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  ₹{value.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {topup ? (
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium"
              >
                {status === 'PENDING' ? 'Cancel and start over' : 'Add more money'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
              >
                {loading ? 'Generating…' : 'Generate UPI QR'}
              </button>
            )}
          </form>
        </div>

        {/* The QR panel keeps its height whether or not a code is showing, so
            generating one does not shove the page around. */}
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border bg-card p-5 text-center">
          {!topup ? (
            <div className="text-muted-foreground">
              <QrCode className="mx-auto h-10 w-10 opacity-40" />
              <p className="mt-3 text-sm">Your UPI QR will appear here</p>
              <p className="mt-1 text-xs">Enter an amount and generate it</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan with any UPI app to pay ₹{topup.amount.toLocaleString('en-IN')}
              </p>
              {/* Rendered from the raw UPI request rather than Razorpay's
                  ready-made poster, so the code carries no branding but ours.
                  The white background and quiet zone are not decoration: a
                  scanner needs the light margin to find the code at all. */}
              <div className="mx-auto w-fit rounded-xl bg-white p-4">
                <QRCodeSVG value={topup.qrContent} size={240} level="M" marginSize={0} />
              </div>
              <p className="text-xs text-muted-foreground">Ref {topup.transactionId}</p>

              {status === 'PENDING' && (
                <p className="flex items-center justify-center gap-2 text-sm text-amber-600">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Waiting for payment…
                </p>
              )}
              {status === 'SUCCESS' && (
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Added to your main wallet
                </p>
              )}
              {status === 'FAILED' && (
                <p className="flex items-center justify-center gap-2 text-sm text-red-600">
                  <XCircle className="h-4 w-4" /> Payment failed
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-medium">Recent top-ups</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No top-ups yet.</p>
        ) : (
          <div className="divide-y">
            {history.slice(0, 15).map((row) => {
              const style = statusStyles[row.status] ?? statusStyles.PENDING;
              const Icon = style.icon;
              return (
                <div key={row._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">₹{row.amount.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString('en-IN')} · {row.transactionId}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${style.className}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {row.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddMoney;
