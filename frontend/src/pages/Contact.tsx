import React, { useState } from 'react';
import { CheckCircle2, Clock, Headset, Loader2, Mail, MapPin, Phone, Percent } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { ALERT_ERROR, BTN_PRIMARY, BTN_SECONDARY, CARD, H1, INPUT, LABEL, LEAD, WRAP } from '@/components/landing/ui';
import './landing.css';

type Field = 'name' | 'mobile' | 'email' | 'city' | 'message';

const EMPTY: Record<Field, string> = { name: '', mobile: '', email: '', city: '', message: '' };

const REQ = <span className="text-[var(--lp-muted)]"> (required)</span>;

const REASONS = [
    {
        icon: Headset,
        title: 'Becoming a retailer',
        desc: 'What you need to sign up, which devices work, and how soon you can start.',
    },
    {
        icon: Percent,
        title: 'Commission rates',
        desc: 'What you earn on AEPS, money transfer, recharge, bills, PAN and ITR.',
    },
    {
        icon: Clock,
        title: 'A stuck transaction',
        desc: 'A withdrawal that did not complete, or money debited without a receipt.',
    },
];

const Contact: React.FC = () => {
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending) return;

        // Checked here for a quick answer, and again on the server, which is the
        // only side that actually decides.
        if (form.name.trim().length < 2) return setError('Please enter your name.');
        if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, '')))
            return setError('Please enter a valid 10-digit mobile number.');
        if (form.message.trim().length < 10)
            return setError('Please tell us a little more — at least 10 characters.');

        setSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.message || 'Could not send your message. Please try again.');
                return;
            }
            setSent(true);
            setForm(EMPTY);
        } catch {
            setError('Could not reach the server. Please check your connection and try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="landing-page relative overflow-x-clip">
            <LandingNav />

            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} py-16 sm:py-24`}>
                    <p className="lp-eyebrow"><Headset aria-hidden strokeWidth={1.5} className="size-4" /> We answer in your language</p>
                    <h1 className={`${H1} mt-3`}>Talk to our team</h1>
                    <p className={`${LEAD} mt-5 max-w-2xl`}>
                        Leave your details and we will call you back. No form-filling marathon — a name,
                        a number and what you need is enough.
                    </p>
                </div>
            </header>

            <section className="lp-band py-16 sm:py-20">
                <div className={`${WRAP} grid grid-cols-1 items-start gap-4 lg:grid-cols-12`}>
                    <div className={`${CARD} p-6 sm:p-8 lg:col-span-7 lg:p-10`}>
                        {sent ? (
                            <div className="py-12 text-center" role="status">
                                <CheckCircle2 aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-[var(--lp-positive)]" />
                                <h2 className="mt-5 text-2xl font-medium text-[var(--lp-fg)]">Message sent</h2>
                                <p className="mx-auto mt-2 max-w-sm leading-relaxed text-[var(--lp-fg-2)]">
                                    Thanks — we have your details and will get back to you shortly.
                                </p>
                                <button type="button" onClick={() => setSent(false)} className={`${BTN_SECONDARY} mt-8`}>
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate className="space-y-6">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <label className={LABEL}>
                                        Your name{REQ}
                                        <input value={form.name} onChange={set('name')} autoComplete="name" className={INPUT} placeholder="Sunita Devi" />
                                    </label>
                                    <label className={LABEL}>
                                        Mobile number{REQ}
                                        <input value={form.mobile} onChange={set('mobile')} inputMode="numeric" autoComplete="tel" maxLength={10} className={`${INPUT} lp-figure`} placeholder="9876543210" />
                                    </label>
                                    <label className={LABEL}>
                                        Email
                                        <input value={form.email} onChange={set('email')} type="email" autoComplete="email" className={INPUT} placeholder="you@example.com" />
                                    </label>
                                    <label className={LABEL}>
                                        City
                                        <input value={form.city} onChange={set('city')} autoComplete="address-level2" className={INPUT} placeholder="Hooghly" />
                                    </label>
                                </div>

                                <label className={LABEL}>
                                    How can we help?{REQ}
                                    <textarea
                                        value={form.message}
                                        onChange={set('message')}
                                        rows={5}
                                        maxLength={2000}
                                        className={`${INPUT} h-auto resize-y py-3`}
                                        placeholder="Which services you want to offer, or the problem you are facing"
                                    />
                                </label>

                                {error && <p role="alert" className={ALERT_ERROR}>{error}</p>}

                                <button type="submit" disabled={sending} className={BTN_PRIMARY}>
                                    {sending ? <><Loader2 aria-hidden strokeWidth={1.5} className="size-4 animate-spin" /> Sending…</> : 'Send message'}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="space-y-4 lg:col-span-5">
                        <div className={`${CARD} p-6 sm:p-8`}>
                            <h2 className="text-lg font-medium text-[var(--lp-fg)]">Reach us directly</h2>
                            <ul className="mt-5 space-y-4 text-[15px]">
                                <li className="flex items-start gap-3">
                                    <Phone aria-hidden strokeWidth={1.5} className="mt-0.5 size-[18px] shrink-0 text-[var(--lp-muted)]" />
                                    <a href="tel:+918240039776" className="lp-figure text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">+91 8240039776</a>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Mail aria-hidden strokeWidth={1.5} className="mt-0.5 size-[18px] shrink-0 text-[var(--lp-muted)]" />
                                    <a href="mailto:shahparpay@gmail.com" className="break-all text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">shahparpay@gmail.com</a>
                                </li>
                                <li className="flex items-start gap-3">
                                    <MapPin aria-hidden strokeWidth={1.5} className="mt-0.5 size-[18px] shrink-0 text-[var(--lp-muted)]" />
                                    <span className="leading-relaxed text-[var(--lp-fg-2)]">4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal - 712125</span>
                                </li>
                            </ul>
                        </div>

                        <div className={`${CARD} p-6 sm:p-8`}>
                            <h2 className="text-lg font-medium text-[var(--lp-fg)]">What people ask us</h2>
                            <ul className="mt-5 space-y-5">
                                {REASONS.map((reason) => (
                                    <li key={reason.title} className="flex items-start gap-3">
                                        <reason.icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-[18px] shrink-0 text-[var(--lp-muted)]" />
                                        <div>
                                            <p className="text-[15px] text-[var(--lp-fg)]">{reason.title}</p>
                                            <p className="mt-0.5 text-sm leading-relaxed text-[var(--lp-muted)]">{reason.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default Contact;
