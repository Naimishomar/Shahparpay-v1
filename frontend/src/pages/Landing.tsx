import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Banknote,
    Building,
    Check,
    CreditCard,
    FileText,
    Fingerprint,
    Headset,
    Mail,
    MapPin,
    Menu,
    Moon,
    Phone,
    Receipt,
    ShieldCheck,
    Smartphone,
    Sun,
    TrendingUp,
    Users,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import logo from '../assets/logo.png';
import './landing.css';

const STATS = [
    { value: '10,000+', label: 'Agents registered' },
    { value: '99.9%', label: 'Platform uptime' },
    { value: '₹500Cr+', label: 'Processed monthly' },
    { value: '25+', label: 'Services available' },
];

const SERVICES = [
    { title: 'AEPS Services', desc: 'Cash withdrawal, deposit, balance enquiry and mini statement.', icon: Fingerprint },
    { title: 'Money Transfer', desc: 'IMPS, NEFT and DMT transfers to any bank account instantly.', icon: Banknote },
    { title: 'Mobile Recharge', desc: 'Prepaid, postpaid and data plans for all telecom operators.', icon: Smartphone },
    { title: 'Bills & Insurance', desc: 'Electricity, gas, water, DTH, LIC and loan repayments.', icon: Receipt },
    { title: 'PAN Card', desc: 'NSDL and UTI PAN card application services.', icon: CreditCard },
    { title: 'ITR Filing', desc: 'Quick and secure income tax return filing for your customers.', icon: FileText },
    { title: 'Lead Generation', desc: 'Credit cards, loans and more — earn on every successful lead.', icon: Users },
    { title: 'UPI & Wallet', desc: 'UPI payments and digital wallet services for daily needs.', icon: Wallet },
];

const ABOUT = [
    { title: 'Trusted and secure', desc: 'Every transaction is secure, reliable and instantly reconciled with your settlement.', icon: ShieldCheck },
    { title: 'Pan-India network', desc: 'A growing network of retailers and distributors serving customers nationwide.', icon: Building },
    { title: 'Dedicated support', desc: 'Our support team is available seven days a week to help you and your customers.', icon: Headset },
];

const COMMISSIONS = [
    { title: 'AEPS', desc: 'Earn on every Aadhaar-enabled transaction — withdrawal, deposit, enquiry and AadhaarPay.', icon: Fingerprint },
    { title: 'Money Transfer', desc: 'Commission on every IMPS, NEFT and DMT transfer you process.', icon: TrendingUp },
    { title: 'Recharge & Bills', desc: 'Earn on prepaid, postpaid, DTH, FASTag recharges and all bill payments.', icon: Smartphone },
];

/** Factual: these are the services the platform actually runs, not partner claims. */
const MARQUEE = ['AEPS', 'DMT', 'BBPS', 'Recharge', 'PAN Card', 'ITR Filing', 'UPI', 'MATM', 'AadhaarPay', 'Lead Generation'];

const HERO_POINTS = ['No setup fee', 'Same-day onboarding', 'Commission on every service'];

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0px)' : 'translateY(16px)',
                transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

const Logo = ({ className = 'h-9' }: { className?: string }) => (
    <img
        src={logo}
        alt="Shahparpay Solutions Private Limited"
        className={`${className} w-auto object-contain dark:invert`}
        onError={(e) => (e.currentTarget.style.display = 'none')}
    />
);

const Landing: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navLinks = [
        { label: 'Services', href: '#services' },
        { label: 'Why us', href: '#about' },
        { label: 'Commission', href: '#commission' },
        { label: 'Contact', href: '#contact' },
    ];

    return (
        <div id="top" className="landing-page">
            {/* ---------------------------------------------------------- NAV */}
            <nav
                className={`sticky top-0 z-50 transition-colors duration-200 ${
                    scrolled ? 'backdrop-blur-md border-b' : 'border-b border-transparent'
                }`}
                style={{
                    backgroundColor: scrolled ? 'color-mix(in srgb, var(--lp-bg) 88%, transparent)' : 'transparent',
                    borderColor: scrolled ? 'var(--lp-border)' : 'transparent',
                }}
            >
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
                    <Link to="/" aria-label="Shahparpay home">
                        <Logo />
                    </Link>

                    <div className="hidden items-center gap-1 md:flex">
                        {navLinks.map((l) => (
                            <a
                                key={l.label}
                                href={l.href}
                                className="lp-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-[var(--lp-fg)]"
                            >
                                {l.label}
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                            aria-label="Toggle theme"
                            className="relative h-9 w-9 rounded-lg border transition-colors"
                            style={{ borderColor: 'var(--lp-border)' }}
                        >
                            <Sun className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        </button>
                        <Link to="/login" className="lp-btn-secondary hidden px-4 py-2 text-sm sm:inline-flex">
                            Log in
                        </Link>
                        <Link to="/login" className="lp-btn-primary px-4 py-2 text-sm">
                            Get started
                        </Link>
                        <button
                            className="md:hidden"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {menuOpen && (
                    <div className="border-t px-6 py-3 md:hidden" style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-bg)' }}>
                        {navLinks.map((l) => (
                            <a
                                key={l.label}
                                href={l.href}
                                onClick={() => setMenuOpen(false)}
                                className="lp-muted block rounded-lg px-2 py-2.5 text-sm font-medium"
                            >
                                {l.label}
                            </a>
                        ))}
                    </div>
                )}
            </nav>

            {/* --------------------------------------------------------- HERO */}
            <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-16 text-center sm:pt-24">
                <span className="lp-eyebrow">
                    <Zap className="h-3.5 w-3.5" />
                    One platform, every banking service
                </span>

                <h1 className="lp-display mt-6 text-[2.75rem] sm:text-6xl lg:text-7xl">
                    Banking services for
                    <br className="hidden sm:block" /> every neighbourhood.
                </h1>

                <p className="lp-muted mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
                    AEPS, money transfer, recharge, bill payments, PAN and ITR — run them all from a single
                    account. Built for retailers, distributors and agents across India.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link to="/login" className="lp-btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto">
                        Get started <ArrowRight className="h-4 w-4" />
                    </Link>
                    <a href="#services" className="lp-btn-secondary inline-flex w-full items-center justify-center px-6 py-3 sm:w-auto">
                        Explore services
                    </a>
                </div>

                <ul className="lp-muted mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                    {HERO_POINTS.map((point) => (
                        <li key={point} className="flex items-center gap-1.5">
                            <Check className="h-4 w-4" style={{ color: 'var(--lp-accent)' }} />
                            {point}
                        </li>
                    ))}
                </ul>
            </section>

            {/* --------------------------------------------------- SERVICE BAR */}
            <div className="lp-band py-5">
                <div className="lp-marquee mx-auto max-w-7xl">
                    {[0, 1].map((copy) => (
                        <div className="lp-marquee__track" key={copy} aria-hidden={copy === 1}>
                            {MARQUEE.map((item) => (
                                <span key={item} className="lp-muted whitespace-nowrap text-sm font-semibold tracking-wide">
                                    {item}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* ----------------------------------------------------- SERVICES */}
            <section id="services" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-20 sm:py-24">
                <Reveal>
                    <div className="max-w-2xl">
                        <span className="lp-eyebrow">Services</span>
                        <h2 className="lp-heading mt-4 text-3xl sm:text-4xl">Everything your counter needs</h2>
                        <p className="lp-muted mt-3 text-base leading-relaxed">
                            Twenty-five services on one login, one wallet and one settlement — no separate
                            portals to reconcile at the end of the day.
                        </p>
                    </div>
                </Reveal>

                <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {SERVICES.map((s, i) => (
                        <Reveal key={s.title} delay={(i % 4) * 0.06}>
                            <div className="lp-card h-full p-6">
                                <div className="lp-icon-tile">
                                    <s.icon className="h-5 w-5" />
                                </div>
                                <h3 className="lp-heading mt-4 text-base">{s.title}</h3>
                                <p className="lp-muted mt-2 text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* -------------------------------------------------------- ABOUT */}
            <section id="about" className="lp-band scroll-mt-20 py-20 sm:py-24">
                <div className="mx-auto w-full max-w-7xl px-6">
                    <Reveal>
                        <div className="max-w-2xl">
                            <span className="lp-eyebrow">Why Shahparpay</span>
                            <h2 className="lp-heading mt-4 text-3xl sm:text-4xl">Built to be relied on</h2>
                        </div>
                    </Reveal>

                    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {ABOUT.map((a, i) => (
                            <Reveal key={a.title} delay={i * 0.08}>
                                <div className="lp-card h-full p-7">
                                    <div className="lp-icon-tile">
                                        <a.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="lp-heading mt-4 text-lg">{a.title}</h3>
                                    <p className="lp-muted mt-2 text-sm leading-relaxed">{a.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------------- STATS */}
            <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-24">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
                    {STATS.map((s, i) => (
                        <Reveal key={s.label} delay={i * 0.06}>
                            <div>
                                <div className="lp-display text-4xl sm:text-5xl" style={{ color: 'var(--lp-accent)' }}>
                                    {s.value}
                                </div>
                                <div className="lp-muted mt-2 text-sm font-medium">{s.label}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ---------------------------------------------------- COMMISSION */}
            <section id="commission" className="lp-band scroll-mt-20 py-20 sm:py-24">
                <div className="mx-auto w-full max-w-7xl px-6">
                    <Reveal>
                        <div className="max-w-2xl">
                            <span className="lp-eyebrow">Commission</span>
                            <h2 className="lp-heading mt-4 text-3xl sm:text-4xl">Earn on every transaction</h2>
                            <p className="lp-muted mt-3 text-base leading-relaxed">
                                Commission is credited to your wallet as each transaction settles — nothing to
                                claim, nothing to chase.
                            </p>
                        </div>
                    </Reveal>

                    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {COMMISSIONS.map((c, i) => (
                            <Reveal key={c.title} delay={i * 0.08}>
                                <div className="lp-card h-full p-7">
                                    <div className="lp-icon-tile">
                                        <c.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="lp-heading mt-4 text-lg">{c.title}</h3>
                                    <p className="lp-muted mt-2 text-sm leading-relaxed">{c.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ----------------------------------------------------------- CTA */}
            <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-24">
                <Reveal>
                    <div
                        className="rounded-3xl px-8 py-14 text-center sm:px-16"
                        style={{ background: 'var(--lp-fg)', color: 'var(--lp-bg)' }}
                    >
                        <h2 className="lp-display text-3xl sm:text-5xl">Start earning today</h2>
                        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed opacity-70">
                            Open a retailer account and start serving your customers the same day.
                        </p>
                        <Link
                            to="/login"
                            className="mt-8 inline-flex items-center gap-2 rounded-[0.625rem] px-7 py-3 font-semibold transition-opacity hover:opacity-88"
                            style={{ background: 'var(--lp-bg)', color: 'var(--lp-fg)' }}
                        >
                            Get started <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </Reveal>
            </section>

            {/* -------------------------------------------------------- FOOTER */}
            <footer id="contact" className="scroll-mt-20 border-t" style={{ borderColor: 'var(--lp-border)' }}>
                <div className="mx-auto w-full max-w-7xl px-6 py-14">
                    <div className="grid grid-cols-2 gap-10 lg:grid-cols-5">
                        <div className="col-span-2">
                            <Logo className="h-10" />
                            <p className="lp-muted mt-4 max-w-xs text-sm leading-relaxed">
                                Making digital payments easier for retailers and agents across India.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold">Services</h4>
                            <ul className="mt-4 space-y-2.5 text-sm">
                                {['AEPS', 'Money Transfer', 'Recharge', 'Bill Payments'].map((item) => (
                                    <li key={item}>
                                        <a href="#services" className="lp-muted transition-colors hover:text-[var(--lp-fg)]">
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold">Company</h4>
                            <ul className="mt-4 space-y-2.5 text-sm">
                                <li><a href="#about" className="lp-muted transition-colors hover:text-[var(--lp-fg)]">Why us</a></li>
                                <li><a href="#commission" className="lp-muted transition-colors hover:text-[var(--lp-fg)]">Commission</a></li>
                                <li><a href="#contact" className="lp-muted transition-colors hover:text-[var(--lp-fg)]">Contact</a></li>
                                <li><Link to="/login" className="lp-muted transition-colors hover:text-[var(--lp-fg)]">Log in</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold">Contact</h4>
                            <ul className="lp-muted mt-4 space-y-3 text-sm">
                                <li className="flex items-center gap-2.5">
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <a href="tel:03368200828" className="transition-colors hover:text-[var(--lp-fg)]">033 68200828</a>
                                </li>
                                <li className="flex items-center gap-2.5">
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <a href="mailto:shahparpay@gmail.com" className="transition-colors hover:text-[var(--lp-fg)]">
                                        shahparpay@gmail.com
                                    </a>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, WB 712125</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div
                        className="lp-muted mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-xs sm:flex-row"
                        style={{ borderColor: 'var(--lp-border)' }}
                    >
                        <p>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd. All rights reserved.</p>
                        <div className="flex items-center gap-5">
                            <a href="#top" className="transition-colors hover:text-[var(--lp-fg)]">Terms &amp; Conditions</a>
                            <a href="#top" className="transition-colors hover:text-[var(--lp-fg)]">Privacy Policy</a>
                            <a href="#top" className="transition-colors hover:text-[var(--lp-fg)]">Refund Policy</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
