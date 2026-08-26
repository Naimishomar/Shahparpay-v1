import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Banknote,
    Building,
    CreditCard,
    FileText,
    Fingerprint,
    Headset,
    IndianRupee,
    Mail,
    MapPin,
    Menu,
    Moon,
    Phone,
    Receipt,
    ShieldCheck,
    Smartphone,
    Star,
    Sun,
    TrendingUp,
    Users,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import whiteLogo from '../assets/shahparpay-white-logo.png';
import './landing.css';

const STATS = [
    { value: '10,000+', label: 'Agents Registered' },
    { value: '99.9%', label: 'Platform Uptime' },
    { value: '₹500Cr+', label: '₹ Processed Monthly' },
    { value: '25+', label: 'Services Available' },
    { value: '7 Days', label: 'Support Available' },
    { value: '<1s', label: 'Avg. Response Time' },
];

const SERVICES = [
    { title: 'AEPS Services', desc: 'Cash withdrawal, deposit, balance enquiry & mini statement.', icon: Fingerprint },
    { title: 'Money Transfer', desc: 'IMPS, NEFT & DMT transfers to any bank account instantly.', icon: Banknote },
    { title: 'Mobile Recharge', desc: 'Prepaid, postpaid & data plans for all telecom operators.', icon: Smartphone },
    { title: 'Bills & Insurance', desc: 'Electricity, gas, water, DTH, LIC & loan repayments.', icon: Receipt },
    { title: 'PAN Card', desc: 'NSDL & UTI PAN card application services.', icon: CreditCard },
    { title: 'ITR Filing', desc: 'Quick and secure income tax return filing for your customers.', icon: FileText },
    { title: 'Lead Generation', desc: 'Credit cards, loans & more — earn per successful lead.', icon: Users },
    { title: 'UPI & Wallet', desc: 'UPI payments and digital wallet services for daily needs.', icon: Wallet },
];

const ABOUT = [
    { title: 'Trusted & Secure', desc: 'Every transaction is secure, reliable and instantly reconciled with your settlement.', icon: ShieldCheck },
    { title: 'Pan-India Network', desc: 'A growing network of retailers and distributors serving customers nationwide.', icon: Building },
    { title: 'Dedicated Support', desc: 'Our support team is available 7 days a week to help you and your customers.', icon: Headset },
];

const COMMISSIONS = [
    { title: 'AEPS', desc: 'Earn on every Aadhaar-enabled transaction — withdrawal, deposit, enquiry and AadhaarPay.', icon: Fingerprint },
    { title: 'Money Transfer', desc: 'Commission on every IMPS, NEFT and DMT transfer you process.', icon: TrendingUp },
    { title: 'Recharge & Bills', desc: 'Earn on prepaid, postpaid, DTH, FASTag recharges and all bill payments.', icon: Smartphone },
];

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
                transform: visible ? 'translateY(0px)' : 'translateY(20px)',
                transition: `opacity 0.7s ease, transform 0.7s ease ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

/* Animated twinkling starfield painted on a fixed full-screen canvas behind the content. */
function TwinkleField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== 'light';

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let width = 0;
        let height = 0;
        let raf = 0;
        let running = true;
        let particles: { x: number; y: number; r: number; speed: number; phase: number; base: number; amp: number }[] = [];
        const fill = isDark ? 'rgba(220, 232, 255,' : 'rgba(113, 113, 122,';
        const halo = isDark ? 'rgba(200, 214, 255,' : 'rgba(161, 161, 170,';

        const seed = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = Math.min(300, Math.max(120, Math.floor((width * height) / 6000)));
            particles = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 0.4 + Math.random() * 1.2,
                speed: 0.5 + Math.random() * 5,
                phase: Math.random() * Math.PI * 2,
                base: 0.12 + Math.random() * 0.28,
                amp: 0.25 + Math.random() * 0.4,
            }));
        };

        const draw = (now: number) => {
            ctx.clearRect(0, 0, width, height);
            const t = now / 1000;
            for (const p of particles) {
                const alpha = p.base + p.amp * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));
                if (p.r > 1.4) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
                    ctx.fillStyle = `${halo}${alpha * 0.18})`;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `${fill}${Math.min(1, alpha)})`;
                ctx.fill();
            }
        };

        const loop = (now: number) => {
            if (!running) return;
            draw(now);
            raf = requestAnimationFrame(loop);
        };

        const onVisibility = () => {
            running = !document.hidden;
            if (running && !prefersReduced) raf = requestAnimationFrame(loop);
            else if (running && prefersReduced) draw(performance.now());
        };

        const onResize = () => {
            seed();
            if (prefersReduced) draw(performance.now());
        };

        seed();
        if (prefersReduced) {
            draw(performance.now());
        } else {
            raf = requestAnimationFrame(loop);
        }
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('resize', onResize);
        };
    }, [isDark]);

    return <canvas ref={canvasRef} className="landing-canvas" aria-hidden="true" />;
}

const Landing = () => {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const { setTheme, resolvedTheme } = useTheme();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navLinks = [
        { label: 'Home', href: '#top' },
        { label: 'About', href: '#about' },
        { label: 'Services', href: '#services' },
        { label: 'Commission', href: '#commission' },
        { label: 'Contact', href: '#contact' },
    ];

    return (
        <div id="top" className="landing-page">
            {/* Twinkling particle background (patterned after vibelly.fun) */}
            <TwinkleField />

            <div className="relative z-10 flex flex-col min-h-screen">
            {/* NAV */}
            <nav
                className={`sticky top-0 z-50 transition-all duration-300 ${
                    scrolled ? 'bg-white/90 dark:bg-[#15171b]/90 backdrop-blur-md border-b border-black/5 dark:border-white/5' : ''
                }`}
            >
                <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full text-sm text-zinc-600 dark:text-zinc-400">
                <Link to="/" className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold tracking-tight">
                    <img src={whiteLogo} alt="ShahparPay Logo" className="w-11 h-11 object-contain brightness-0 dark:brightness-0 dark:invert" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <span className="text-2xl landing-serif font-black">ShahparPay</span>
                </Link>

                <div className="hidden md:flex items-center gap-2">
                    {navLinks.map((l) => (
                        <a
                            key={l.label}
                            href={l.href}
                            className="px-3 py-1.5 rounded-lg hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                        >
                            {l.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                        aria-label="Toggle theme"
                        className="relative p-2 rounded-full bg-zinc-200/60 dark:bg-white/5 border border-zinc-300 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <Sun className="h-5 w-5 text-zinc-700 dark:text-foreground transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        <Moon className="h-5 w-5 text-zinc-700 dark:text-foreground transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </button>
                    <Link
                        to="/login"
                        className="bg-zinc-900 text-white dark:bg-white dark:text-black px-5 py-2 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-white/80 dark:hover:text-black transition-colors text-[14px]"
                    >
                        Login
                    </Link>
                    <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
                </div>
            </nav>

            {menuOpen && (
                <div className="md:hidden bg-white/95 dark:bg-[#15171b]/95 backdrop-blur-md border-b border-black/5 dark:border-white/5 px-6 py-4 space-y-1">
                    {navLinks.map((l) => (
                        <a
                            key={l.label}
                            href={l.href}
                            onClick={() => setMenuOpen(false)}
                            className="block px-3 py-2 rounded-lg hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors text-zinc-600 dark:text-zinc-400"
                        >
                            {l.label}
                        </a>
                    ))}
                </div>
            )}

            {/* HERO */}
            <section className="relative flex flex-col items-center justify-center text-center px-6 min-h-screen max-w-4xl mx-auto w-full">
                <p className="text-[14px] md:text-[15px] tracking-[0.2em] text-zinc-600 dark:text-zinc-400 font-medium uppercase mb-4">
                    AePS · DMT · Recharge · Bills
                </p>
                <h1 className="landing-serif text-5xl sm:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.05] mb-5">
                    Next-Gen <br className="hidden sm:block" /> Financial Network.
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl leading-relaxed mx-auto">
                    The ultimate unified platform for AePS, DMT, Recharge and more. Secure, fast and reliable — designed for
                    retailers, distributors and agents across India.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Link
                        to="/login"
                        className="flex items-center justify-center w-full sm:w-48 gap-2 bg-zinc-900 text-white dark:bg-white dark:text-black px-6 py-2.5 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                    >
                        Get Started <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                        href="#services"
                        className="flex items-center justify-center w-full sm:w-48 gap-2 bg-zinc-100 text-zinc-900 border border-zinc-300 dark:bg-zinc-800/60 dark:text-white dark:border-zinc-700 px-6 py-2.5 rounded-md font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Explore Services
                    </a>
                </div>

                <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
                    </div>
                    <span>
                        <strong className="text-zinc-900 dark:text-white font-semibold">4.9/5</strong> rated by{' '}
                        <strong className="text-zinc-900 dark:text-white font-semibold">10,000+</strong> agents
                    </span>
                    <span className="hidden sm:inline text-zinc-400 dark:text-zinc-600">·</span>
                    <span>RBI-compliant · 100% secure</span>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {['AEPS', 'DMT', 'Recharge', 'BBPS', 'UPI', 'PAN Card', 'ITR Filing', 'Lead Generation'].map((s) => (
                        <span
                            key={s}
                            className="px-3 py-1 rounded-full border border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-300 hover:border-zinc-400 hover:text-zinc-900 dark:hover:border-white/30 dark:hover:text-white transition-colors"
                        >
                            {s}
                        </span>
                    ))}
                </div>
            </section>

            {/* STATS */}
            <Reveal>
                <section className="relative w-full max-w-6xl mx-auto px-6 pb-24">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {STATS.map((s) => (
                            <div
                                key={s.label}
                                className="rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900/40 px-4 py-6 text-center hover:border-zinc-300 dark:hover:border-white/20 transition-colors"
                            >
                                <div className="landing-georgia text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-white">{s.value}</div>
                                <div className="mt-2 text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wider font-medium">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </Reveal>

            {/* SERVICES */}
            <section id="services" className="relative w-full max-w-6xl mx-auto px-6 pb-24 scroll-mt-24">
                <Reveal>
                    <div className="text-center mb-12">
                        <h2 className="landing-serif text-4xl md:text-5xl font-normal text-center max-w-4xl mx-auto leading-tight mb-3">
                            Everything a Payments Business Needs
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-2xl mx-auto leading-relaxed">
                            From Aadhaar-enabled banking to money transfer, recharges and bill payments — one platform for all your services.
                        </p>
                    </div>
                </Reveal>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {SERVICES.map((svc, i) => (
                        <Reveal key={svc.title} delay={(i % 4) * 0.06}>
                            <div className="landing-card p-8 h-full">
                                <div className="landing-icon-tile mb-6 text-zinc-900 dark:text-white">
                                    <svc.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-3">{svc.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{svc.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* QUOTE */}
            <Reveal>
                <section className="px-6 pb-24 max-w-3xl mx-auto w-full">
                    <div className="bg-white text-black rounded-2xl p-10 text-center shadow-xl">
                        <p className="landing-georgia text-xl md:text-2xl font-medium leading-snug mb-5">
                            &ldquo;In a world of queues and paper forms, a fast and reliable payment network is not a convenience. It&rsquo;s how a business grows.&rdquo;
                        </p>
                        <p className="text-sm text-zinc-500 leading-relaxed max-w-xl mx-auto">
                            ShahparPay was built so every retailer, distributor and agent across India can offer secure digital financial
                            services — and earn from every single transaction.
                        </p>
                    </div>
                </section>
            </Reveal>

            {/* ABOUT */}
            <section id="about" className="relative w-full max-w-6xl mx-auto px-6 pb-24 scroll-mt-24">
                <Reveal>
                    <div className="text-center mb-12">
                        <h2 className="landing-serif text-4xl md:text-5xl font-normal max-w-4xl mx-auto leading-tight mb-3">
                            Built for Agents, Designed for Trust
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-2xl mx-auto leading-relaxed">
                            A complete digital payment and financial services platform for India.
                        </p>
                    </div>
                </Reveal>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {ABOUT.map((f, i) => (
                        <Reveal key={f.title} delay={i * 0.08}>
                            <div className="landing-card p-8 h-full">
                                <div className="landing-icon-tile mb-6 text-zinc-900 dark:text-white">
                                    <f.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* COMMISSION */}
            <section id="commission" className="relative w-full max-w-6xl mx-auto px-6 pb-24 scroll-mt-24">
                <Reveal>
                    <div className="text-center mb-12">
                        <h2 className="landing-serif text-4xl md:text-5xl font-normal max-w-4xl mx-auto leading-tight mb-3">
                            Earn Attractive Commissions
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-2xl mx-auto leading-relaxed">
                            Grow your income with every transaction you process.
                        </p>
                    </div>
                </Reveal>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {COMMISSIONS.map((c, i) => (
                        <Reveal key={c.title} delay={i * 0.08}>
                            <div className="landing-card p-8 h-full">
                                <div className="landing-icon-tile mb-6 text-zinc-900 dark:text-white">
                                    <c.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-3">{c.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{c.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <Reveal>
                <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
                    <div className="bg-white dark:bg-[#1A1C20] border border-zinc-200 dark:border-white/10 rounded-[2rem] p-10 md:p-16 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                        <p className="text-[13px] tracking-[0.2em] text-zinc-600 dark:text-zinc-400 font-medium uppercase mb-4">Instant Settlements</p>
                        <h2 className="landing-serif text-4xl md:text-5xl font-normal leading-tight mb-4">
                            Pay Directly to Customer&rsquo;s Bank Account
                        </h2>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            {['IMPS', 'NEFT', 'UPI'].map((m) => (
                                <span
                                    key={m}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-200 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/30 transition-colors"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    {m}
                                </span>
                            ))}
                        </div>
                        <div className="mt-8">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 bg-zinc-900 text-white dark:bg-white dark:text-black px-8 py-3 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-white/80 dark:hover:text-black transition-colors"
                            >
                                Get Started <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </section>
            </Reveal>

            {/* FOOTER */}
            <footer id="contact" className="w-full max-w-7xl mx-auto bg-white dark:bg-[#15171B] border border-zinc-200 dark:border-white/10 rounded-[2rem] py-12 px-8 lg:px-12 text-sm mb-6 scroll-mt-24 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <Link to="/" className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold tracking-tight">
                            <img src={whiteLogo} alt="ShahparPay Logo" className="w-10 h-10 object-contain brightness-0 dark:brightness-0 dark:invert" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            <span className="text-2xl landing-serif font-black">ShahparPay</span>
                        </Link>
                        <p className="text-zinc-500 leading-relaxed max-w-xs">
                            Making digital ideas &amp; payments easier for retailers and agents across India.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-zinc-900 dark:text-white font-semibold mb-2">Quick Links</h4>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#top">Home</a>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#about">About</a>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#services">Services</a>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#commission">Commission</a>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-zinc-900 dark:text-white font-semibold mb-2">Legal</h4>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#top">Terms &amp; Conditions</a>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#top">Privacy Policy</a>
                        <a className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" href="#top">Refund Policy</a>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-zinc-900 dark:text-white font-semibold mb-2">Contact</h4>
                        <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                            <Phone className="w-5 h-5 shrink-0 text-zinc-900 dark:text-white" />
                            <p>033 68200828</p>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                            <Mail className="w-5 h-5 shrink-0 text-zinc-900 dark:text-white" />
                            <p>shahparpay@gmail.com</p>
                        </div>
                        <div className="flex items-start gap-3 text-zinc-600 dark:text-zinc-400">
                            <MapPin className="w-5 h-5 shrink-0 text-zinc-900 dark:text-white mt-0.5" />
                            <p>4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, WB 712125</p>
                        </div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-zinc-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-500">
                    <p>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd. All rights reserved.</p>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5">
                            <IndianRupee className="w-3.5 h-3.5 text-zinc-500" />
                            RBI-Compliant
                        </span>
                    </div>
                </div>
            </footer>
            </div>
        </div>
    );
};

export default Landing;
