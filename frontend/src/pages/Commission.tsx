import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Banknote, CreditCard, Fingerprint, IdCard, Loader2, Receipt, RefreshCw, Tv, Users } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { ALERT_ERROR, BTN_SECONDARY, CARD, H1, LEAD, SECTION, WRAP } from '@/components/landing/ui';
import './landing.css';

type Slab = { label: string; sample: number; earns: number };
type Operator = { name: string; percent: number };
type Biller = { name: string; kind: 'flat' | 'percent'; value: number };

type Rates = {
    aeps: { withdrawal: Slab[]; deposit: Slab[]; tdsPercent: number };
    matm: Slab[];
    pan: { fee: number; earns: number };
    charges: { name: string; fee: number; plusGst: boolean }[];
    leads: { name: string; earns: number }[];
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
    className?: string;
    children: React.ReactNode;
}> = ({ icon: Icon, title, note, className = '', children }) => (
    <section className={`${CARD} p-6 sm:p-7 ${className}`}>
        <div className="flex items-start gap-3">
            <Icon aria-hidden strokeWidth={1.5} className="mt-1 size-[18px] shrink-0 text-[var(--lp-muted)]" />
            <div>
                <h2 className="text-lg font-medium text-[var(--lp-fg)]">{title}</h2>
                {note && <p className="mt-1 text-sm leading-relaxed text-[var(--lp-muted)]">{note}</p>}
            </div>
        </div>
        <hr className="lp-tear mt-5" />
        <div className="mt-1">{children}</div>
    </section>
);

/** One line of the rate card: the label, then the figure in mono like a receipt prints it. */
const RateRow: React.FC<{ left: string; right: string; muted?: boolean }> = ({ left, right, muted }) => (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-[var(--lp-border)] py-2 last:border-0">
        <span className="text-[15px] text-[var(--lp-fg-2)]">{left}</span>
        <span className={`lp-figure shrink-0 text-sm ${muted ? 'text-[var(--lp-muted)]' : 'text-[var(--lp-fg)]'}`}>{right}</span>
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
        <div className="landing-page relative overflow-x-clip">
            <LandingNav />

            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} py-16 sm:py-24`}>
                    <p className="lp-eyebrow">The same rates that credit your wallet</p>
                    <h1 className={`${H1} mt-3`}>What you earn</h1>
                    <p className={`${LEAD} mt-5 max-w-2xl`}>
                        Commission is credited to your wallet as each transaction completes. No monthly
                        target, no minimum, and nothing held back until month end.
                    </p>
                </div>
            </header>

            <section className={`${SECTION} lp-band !py-16 sm:!py-20`}>
                <div className={WRAP}>
                    {error && (
                        <p role="alert" className={`${ALERT_ERROR} mb-8`}>
                            {error}
                        </p>
                    )}

                    {!rates && !error && (
                        <div className="flex items-center justify-center gap-3 py-20 text-[var(--lp-muted)]">
                            <Loader2 aria-hidden strokeWidth={1.5} className="size-5 animate-spin" />
                            <span className="text-sm">Loading the rate card…</span>
                        </div>
                    )}

                    {rates && (
                        <>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                                    note={`Flat commission per transaction. ${rates.aeps.tdsPercent}% TDS is deducted.`}
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
                                    icon={CreditCard}
                                    title="Micro ATM cash withdrawal"
                                    note={`Shown per transaction. ${rates.aeps.tdsPercent}% TDS is deducted.`}
                                >
                                    {rates.matm.map((slab) => (
                                        <RateRow
                                            key={slab.label}
                                            left={slab.label}
                                            right={slab.earns ? `${rupees(slab.earns)} on ${rupees(slab.sample)}` : 'No commission'}
                                            muted={!slab.earns}
                                        />
                                    ))}
                                </Card>

                                <Card
                                    icon={RefreshCw}
                                    title="Mobile recharge"
                                    note={`Percentage of the recharge amount. ${rates.aeps.tdsPercent}% TDS is deducted.`}
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
                                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
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
                                    icon={IdCard}
                                    title="PAN card"
                                    note={`Per application or coupon. ${rates.aeps.tdsPercent}% TDS is deducted.`}
                                >
                                    <RateRow left={`Application at ${rupees(rates.pan.fee)}`} right={rupees(rates.pan.earns)} />
                                </Card>

                                <Card
                                    icon={Users}
                                    title="Lead generation"
                                    note={`Flat, once the lead is approved. ${rates.aeps.tdsPercent}% TDS is deducted.`}
                                >
                                    {rates.leads.map((lead) => (
                                        <RateRow key={lead.name} left={lead.name} right={rupees(lead.earns)} />
                                    ))}
                                </Card>

                                <Card
                                    icon={Banknote}
                                    title="Service charges"
                                    note="Debited from your wallet with the transaction and refunded if it fails."
                                >
                                    {rates.charges.map((c) => (
                                        <RateRow
                                            key={c.name}
                                            left={c.name}
                                            right={`${rupees(c.fee)}${c.plusGst ? ' + GST' : ''}`}
                                            muted
                                        />
                                    ))}
                                </Card>

                                <Card
                                    icon={AlertCircle}
                                    title="Rates on request"
                                    note="These services are live on the platform, but the rate depends on your volume. Ask us and we will share the card."
                                >
                                    <ul className="mt-4 flex flex-wrap gap-2">
                                        {rates.onRequest.map((service) => (
                                            <li key={service} className="rounded-md border border-[var(--lp-border)] px-2 py-1 text-sm text-[var(--lp-fg)]">
                                                {service}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link to="/contact" className={`${BTN_SECONDARY} mt-6`}>
                                        Ask for a rate card
                                    </Link>
                                </Card>
                            </div>

                            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--lp-muted)]">
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
