import React, { useState } from 'react';
import { CheckCircle2, Clock, Headset, Loader2, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

type Field = 'name' | 'mobile' | 'email' | 'city' | 'message';

const EMPTY: Record<Field, string> = { name: '', mobile: '', email: '', city: '', message: '' };

const INPUT_CLASS =
    'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-hidden transition-colors focus:border-[#008c46] focus:ring-2 focus:ring-[#008c46]/20';

const REASONS = [
    {
        icon: Headset,
        title: 'Becoming a retailer',
        desc: 'What you need to sign up, which devices work, and how soon you can start.',
    },
    {
        icon: Sparkles,
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
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900">
            <LandingNav />

            {/* ------------------------------------------------------------- HEADER BAND */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Headset className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>We answer in your language</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        Talk to <span className="text-[#008c46]">our team</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
                        Leave your details and we will call you back. No form-filling marathon — a name,
                        a number and what you need is enough.
                    </p>
                </div>
            </section>

            {/* ------------------------------------------------------------- FORM + SIDEBAR */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                    {/* Form card */}
                    <div className="lg:col-span-7 rounded-[28px] border border-slate-200 bg-white p-5 sm:p-8 lg:p-10 shadow-xl">
                        {sent ? (
                            <div className="py-12 text-center">
                                <div className="mx-auto w-16 h-16 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-[#008c46]" />
                                </div>
                                <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Message sent</h2>
                                <p className="mt-2 text-slate-600 max-w-sm mx-auto leading-relaxed">
                                    Thanks — we have your details and will get back to you shortly.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSent(false)}
                                    className="mt-7 bg-[#18181b] hover:bg-black text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">
                                            Your name <span className="text-rose-500">*</span>
                                        </span>
                                        <input
                                            value={form.name}
                                            onChange={set('name')}
                                            autoComplete="name"
                                            className={INPUT_CLASS}
                                            placeholder="Sunita Devi"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">
                                            Mobile number <span className="text-rose-500">*</span>
                                        </span>
                                        <input
                                            value={form.mobile}
                                            onChange={set('mobile')}
                                            inputMode="numeric"
                                            autoComplete="tel"
                                            maxLength={10}
                                            className={INPUT_CLASS}
                                            placeholder="9876543210"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">Email</span>
                                        <input
                                            value={form.email}
                                            onChange={set('email')}
                                            type="email"
                                            autoComplete="email"
                                            className={INPUT_CLASS}
                                            placeholder="you@example.com"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">City</span>
                                        <input
                                            value={form.city}
                                            onChange={set('city')}
                                            autoComplete="address-level2"
                                            className={INPUT_CLASS}
                                            placeholder="Hooghly"
                                        />
                                    </label>
                                </div>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        How can we help? <span className="text-rose-500">*</span>
                                    </span>
                                    <textarea
                                        value={form.message}
                                        onChange={set('message')}
                                        rows={5}
                                        maxLength={2000}
                                        className={`${INPUT_CLASS} resize-y py-3`}
                                        placeholder="Tell us what you need — which services you want to offer, or the problem you are facing."
                                    />
                                </label>

                                {error && (
                                    <p
                                        role="alert"
                                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
                                    >
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="inline-flex items-center justify-center gap-2.5 bg-[#18181b] hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold pl-6 pr-2 py-2.5 rounded-full text-sm shadow-md transition-all hover:scale-[1.01] group"
                                >
                                    {sending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="pr-4">Sending…</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Send message</span>
                                            <span className="w-7 h-7 rounded-full bg-[#a3e635] text-black flex items-center justify-center font-black text-sm group-hover:rotate-45 transition-transform">
                                                ↗
                                            </span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="rounded-[28px] bg-[#00381e] text-white p-6 sm:p-8 shadow-xl border border-emerald-800/60">
                            <h2 className="text-lg font-extrabold tracking-tight">Reach us directly</h2>
                            <div className="mt-6 space-y-5">
                                <a href="tel:+918240039776" className="flex items-start gap-3 group">
                                    <Phone className="h-4 w-4 text-[#a3e635] mt-0.5 shrink-0" />
                                    <span className="text-sm font-bold group-hover:text-[#a3e635] transition-colors">
                                        +91 8240039776
                                    </span>
                                </a>
                                <a href="mailto:shahparpay@gmail.com" className="flex items-start gap-3 group">
                                    <Mail className="h-4 w-4 text-[#a3e635] mt-0.5 shrink-0" />
                                    <span className="text-sm text-emerald-50 group-hover:text-[#a3e635] transition-colors break-all">
                                        shahparpay@gmail.com
                                    </span>
                                </a>
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-4 w-4 text-[#a3e635] mt-0.5 shrink-0" />
                                    <span className="text-sm text-emerald-50/90 leading-relaxed">
                                        4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal -
                                        712125
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                                What people ask us
                            </h2>
                            <div className="mt-5 space-y-5">
                                {REASONS.map((reason) => (
                                    <div key={reason.title} className="flex items-start gap-3">
                                        <div className="lp-icon-tile shrink-0 w-8 h-8 rounded-lg">
                                            <reason.icon className="mega-icon h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-extrabold text-slate-900">
                                                {reason.title}
                                            </p>
                                            <p className="text-[0.8rem] text-slate-500 leading-relaxed mt-0.5">
                                                {reason.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default Contact;
