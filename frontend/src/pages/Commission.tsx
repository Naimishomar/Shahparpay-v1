import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Banknote, Fingerprint, Loader2, Receipt, RefreshCw, Tv } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

type Slab = { label: string; sample: number; earns: number };
type Operator = { name: string; percent: number };
type Biller = { name: string; kind: 'flat' | 'percent'; value: number };

type Rates = {
    aeps: { withdrawal: Slab[]; deposit: Slab[]; tdsPercent: number };
    prepaid: Operator[];
    dth: Operator[];
    bbps: Biller[];
    onRequest: string[];
};

const rupees = (value: number) =>
    `₹${value.toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const Card: React.FC<{
    icon: React.ElementType;
    title: string;
    note?: string;
    children: React.ReactNode;
}> = ({ icon: Icon, title, note, children }) => (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
        <div className="flex items-start gap-3">
            <div className="lp-icon-tile shrink-0 w-9 h-9 rounded-xl">
                <Icon className="mega-icon h-4.5 w-4.5" />
            </div>
            <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
                {note && <p className="text-[0.8rem] text-slate-500 mt-0.5 leading-relaxed">{note}</p>}
            </div>
        </div>
        <div className="mt-5">{children}</div>
    </div>
);

const RateRow: React.FC<{ left: string; right: string; muted?: boolean }> = ({ left, right, muted }) => (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
        <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{left}</span>
        <span
            className={`text-sm font-extrabold tabular-nums shrink-0 ${
                muted ? 'text-slate-400' : 'text-[#008c46]'
            }`}
        >
            {right}
        </span>
    </div>
);

const Commission: React.FC = () => {
    const [rates, setRates] = useState<Rates | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/commission`);
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok || !data?.success) throw new Error();
                setRates(data.data);
            } catch {
                if (!cancelled) setError('Could not load the rate card. Please try again shortly.');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900">
            <LandingNav />

            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Banknote className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>The same rates that credit your wallet</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        What you <span className="text-[#008c46]">earn</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
                        Commission is credited to your wallet as each transaction completes. No monthly
                        target, no minimum, and nothing held back until month end.
                    </p>
                </div>
            </section>

            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-7xl">
                    {error && (
                        <p
                            role="alert"
                            className="mb-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
                        >
                            {error}
                        </p>
                    )}

                    {!rates && !error && (
                        <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-semibold">Loading the rate card…</span>
                        </div>
                    )}

                    {rates && (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card
                                    icon={Fingerprint}
                                    title="AEPS cash withdrawal"
                                    note={`Shown per transaction. ${rates.aeps.tdsPercent}% TDS is deducted before the commission reaches your wallet.`}
                                >
                                    {rates.aeps.withdrawal.map((slab) => (
                                        <RateRow
                                            key={slab.label}
                                            left={slab.label}
                                            right={slab.earns ? `${rupees(slab.earns)} on ${rupees(slab.sample)}` : 'No commission'}
                                            muted={!slab.earns}
                                        />
                                    ))}
                                </Card>

                                <Card
                                    icon={Banknote}
                                    title="AEPS cash deposit"
                                    note="Flat commission per transaction. No TDS or GST is deducted."
                                >
                                    {rates.aeps.deposit.map((slab) => (
                                        <RateRow
                                            key={slab.label}
                                            left={slab.label}
                                            right={slab.earns ? rupees(slab.earns) : 'No commission'}
                                            muted={!slab.earns}
                                        />
                                    ))}
                                </Card>

                                <Card
                                    icon={RefreshCw}
                                    title="Mobile recharge"
                                    note="Percentage of the recharge amount, credited in full to your wallet."
                                >
                                    {rates.prepaid.map((op) => (
                                        <RateRow key={op.name} left={op.name} right={`${op.percent}%`} />
                                    ))}
                                </Card>

                                <Card icon={Tv} title="DTH recharge" note="Percentage of the recharge amount.">
                                    {rates.dth.map((op) => (
                                        <RateRow key={op.name} left={op.name} right={`${op.percent}%`} />
                                    ))}
                                </Card>

                                <Card
                                    icon={Receipt}
                                    title="BBPS bill payments"
                                    note="Flat commission per bill, except where a percentage is shown."
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                                        {rates.bbps.map((biller) => (
                                            <RateRow
                                                key={biller.name}
                                                left={biller.name}
                                                right={
                                                    biller.kind === 'flat'
                                                        ? rupees(biller.value)
                                                        : `${biller.value}%`
                                                }
                                            />
                                        ))}
                                    </div>
                                </Card>

                                <Card
                                    icon={AlertCircle}
                                    title="Rates on request"
                                    note="These services are live on the platform, but the rate depends on your volume. Ask us and we will share the card."
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {rates.onRequest.map((service) => (
                                            <span
                                                key={service}
                                                className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5"
                                            >
                                                {service}
                                            </span>
                                        ))}
                                    </div>
                                    <Link
                                        to="/contact"
                                        className="mt-5 inline-flex items-center justify-center gap-2.5 bg-[#18181b] hover:bg-black text-white font-bold pl-5 pr-2 py-2 rounded-full text-sm shadow-md transition-all hover:scale-[1.01] group"
                                    >
                                        <span>Ask for a rate card</span>
                                        <span className="w-6 h-6 rounded-full bg-[#a3e635] text-black flex items-center justify-center font-black text-xs group-hover:rotate-45 transition-transform">
                                            ↗
                                        </span>
                                    </Link>
                                </Card>
                            </div>

                            <p className="mt-8 text-xs text-slate-500 leading-relaxed max-w-3xl">
                                Rates are per successful transaction and may change with the banking and
                                biller networks we run on. Your dashboard shows the exact commission booked
                                against every transaction, which is always the figure that counts.
                            </p>
                        </>
                    )}
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default Commission;
