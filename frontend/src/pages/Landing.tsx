import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ArrowUpRight,
    Award,
    Banknote,
    Building,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Code2,
    Copy,
    CreditCard,
    ExternalLink,
    FileCode,
    FileText,
    Fingerprint,
    Globe,
    Headset,
    HelpCircle,
    Layers,
    Lock,
    Mail,
    MapPin,
    Menu,
    MessageCircle,
    Moon,
    Phone,
    QrCode,
    Receipt,
    RefreshCw,
    Send,
    Shield,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    Sparkles,
    Star,
    Sun,
    Terminal,
    TrendingUp,
    Users,
    Wallet,
    X,
    Zap
} from 'lucide-react';
import { useTheme } from 'next-themes';
import logo from '../assets/logo.png';
import whiteLogo from '../assets/shahparpay-white-logo.png';
import './landing.css';
import MacbookScrollDemo from '@/components/macbook-scroll-demo';

// --- DATA STRUCTURES FOR CASHFREE-MATCHED MEGA MENUS ---
const PRODUCT_MENU_CATEGORIES = [
    {
        title: 'BANKING SERVICES',
        items: [
            {
                title: 'AEPS Cash Withdrawal',
                desc: 'Aadhaar and fingerprint, no card needed',
                icon: Fingerprint,
                link: '#products'
            },
            {
                title: 'Balance & Mini Statement',
                desc: 'Instant account balance for any customer',
                icon: FileText,
                link: '#products'
            },
            {
                title: 'Micro ATM',
                desc: 'Debit card withdrawal at your counter',
                icon: CreditCard,
                link: '#products'
            },
            {
                title: 'Money Transfer (DMT)',
                desc: 'Cash in hand to any bank account',
                icon: Send,
                link: '#products'
            },
            {
                title: 'UPI QR Collection',
                desc: 'Your own QR, money lands in your wallet',
                icon: QrCode,
                link: '#products'
            },
            {
                title: 'Aadhaar Pay',
                desc: 'Customers pay you by fingerprint',
                icon: Shield,
                link: '#products'
            },
            {
                title: 'Daily Settlement',
                desc: 'Move earnings to your bank account',
                icon: Zap,
                link: '#products'
            },
            {
                title: 'Payout to Bank',
                desc: 'Send money out 24x7, including holidays',
                icon: Banknote,
                link: '#products'
            }
        ]
    },
    {
        title: 'BILLS & RECHARGE',
        items: [
            {
                title: 'Mobile & DTH Recharge',
                desc: 'Every prepaid operator and DTH provider',
                icon: RefreshCw,
                link: '#payouts'
            },
            {
                title: 'BBPS Bill Payments',
                desc: 'Electricity, water, gas, broadband, LPG',
                icon: Receipt,
                link: '#payouts'
            },
            {
                title: 'FASTag Recharge',
                desc: 'Top up FASTag for walk-in customers',
                icon: Zap,
                link: '#payouts'
            },
            {
                title: 'Insurance Premium',
                desc: 'Collect LIC and general insurance premiums',
                icon: ShieldCheck,
                link: '#payouts'
            },
            {
                title: 'Credit Card Bills',
                desc: 'Pay any bank credit card bill over BBPS',
                icon: CreditCard,
                link: '#payouts'
            }
        ]
    },
    {
        title: 'DOCUMENTS & EARNINGS',
        items: [
            {
                title: 'PAN Card Services',
                desc: 'New PAN, corrections and reprints',
                icon: FileText,
                link: '#identity'
            },
            {
                title: 'ITR Filing',
                desc: 'File income tax returns for your customers',
                icon: FileCode,
                link: '#identity'
            },
            {
                title: 'Lead Generation',
                desc: 'Earn on loan and insurance referrals',
                icon: Building,
                link: '#identity'
            },
            {
                title: 'Wallet & Reports',
                desc: 'Every transaction and commission, itemised',
                icon: Layers,
                link: '#identity'
            }
        ]
    }
];

const MEGA_FEATURED_CARDS = [
    {
        tag: 'MOST USED',
        title: 'AEPS Banking',
        desc: 'Cash withdrawal, balance and mini statement on a fingerprint',
        badge: 'Popular',
        gradient: 'from-emerald-500/20 to-teal-500/20'
    },
    {
        tag: 'EVERYDAY FOOTFALL',
        title: 'Bills & Recharge',
        desc: 'The reason customers come back to your shop every month',
        badge: 'High volume',
        gradient: 'from-emerald-600/20 to-green-400/20'
    },
    {
        tag: 'HIGHER TICKET',
        title: 'PAN & ITR',
        desc: 'Document services that earn more per customer',
        badge: 'Good margin',
        gradient: 'from-teal-600/20 to-cyan-500/20'
    }
];

const RESOURCE_MENU_ITEMS = [
    {
        title: 'Getting Started',
        desc: 'Documents, KYC and going live',
        icon: Code2
    },
    {
        title: 'Commission Rates',
        desc: 'What you earn on every service',
        icon: Terminal
    },
    {
        title: 'Guides & Training',
        desc: 'Step-by-step help for each service',
        icon: FileCode
    },
    {
        title: 'Device Support',
        desc: 'Supported fingerprint scanners and Micro ATMs',
        icon: ExternalLink
    }
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
                transform: visible ? 'translateY(0px)' : 'translateY(18px)',
                transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

const Logo = ({ className = 'h-11' }: { className?: string }) => (
    <div className="flex items-center gap-2.5">
        <img
            src={logo}
            alt="Shahparpay Solutions"
            className={`${className} w-auto object-contain`}
            onError={(e) => {
                e.currentTarget.style.display = 'none';
            }}
        />
    </div>
);

const FAQ_DATA = {
    support: [
        {
            q: "How much can I actually earn from this?",
            a: "You earn a commission on every transaction — AEPS withdrawals, money transfers, recharges, bill payments, PAN applications and ITR filings each carry their own rate. Your dashboard shows the exact commission on every transaction, and the full rate card is shared before you sign up."
        },
        {
            q: "How do I get my earnings out?",
            a: "Commissions land in your wallet as each transaction completes. Settle to your own bank account from the dashboard whenever you like — there is no minimum holding period and no waiting for month-end."
        },
        {
            q: "What if a transaction fails but the customer's money is debited?",
            a: "Raise a ticket from the Support section with the transaction ID. Failed AEPS and DMT transactions are reconciled automatically against the bank, and refunds are credited back once the bank confirms. You can track the status of every dispute in your reports."
        },
        {
            q: "Is there someone I can call when I am stuck at the counter?",
            a: "Yes. Call 033 68200828 during business hours, message us on WhatsApp, or raise a ticket from inside the dashboard. Most counter issues are resolved on the same call."
        },
        {
            q: "Do I need to be a registered business to join?",
            a: "No. Individual shop owners can sign up. You need your own PAN and Aadhaar, a bank account in your name, and a shop or counter where you serve customers."
        },
        {
            q: "Can I offer these services from more than one shop?",
            a: "Each counter needs its own retailer login, because commissions, reports and settlements are tracked per retailer. If you run several outlets, ask about a distributor account instead — it lets you manage all of them from one place."
        },
        {
            q: "Is there a mobile app?",
            a: "Yes. The Android app covers the same services as the web dashboard, so you can complete transactions and check your wallet without being at the computer."
        }
    ],
    getting_started: [
        {
            q: "What documents do I need to sign up?",
            a: "Your PAN card, Aadhaar card, a cancelled cheque or bank passbook page, a photograph, and a photo of your shop. If your shop is registered, keep the GST or Udyam certificate handy as well."
        },
        {
            q: "How long before I can start taking transactions?",
            a: "Basic services such as recharge and bill payments open as soon as your account is verified. AEPS takes longer because the bank runs its own Aadhaar KYC on you first — that step is done through a fingerprint scanner and is usually cleared within a working day."
        },
        {
            q: "Is there a joining fee?",
            a: "Signing up is free. You only need working balance in your wallet to start transacting, and a fingerprint scanner if you plan to offer AEPS."
        },
        {
            q: "How do I put money into my wallet?",
            a: "Top up by UPI or netbanking from the Add Money page, or raise a fund request to your distributor and upload the payment receipt. Approved top-ups reflect in your wallet immediately."
        }
    ],
    integration: [
        {
            q: "Which fingerprint scanner do I need for AEPS?",
            a: "Any RD-service certified scanner works — Mantra MFS100, Morpho MSO 1300 E3, Startek FM220U and Evolute are the ones our retailers use most. The device must be registered and its RD service installed before your first AEPS transaction."
        },
        {
            q: "Can I use AEPS from my phone?",
            a: "Yes, with an OTG-compatible scanner connected to an Android phone, using the app. Most retailers keep a laptop or desktop at the counter for higher daily volumes."
        },
        {
            q: "What do I need for Micro ATM?",
            a: "A Micro ATM device, which reads the customer's debit card and PIN. It is a separate device from the fingerprint scanner and is usually arranged through your distributor."
        },
        {
            q: "Do I need a fast internet connection?",
            a: "An ordinary broadband or 4G connection is enough. AEPS and DMT are small requests — what matters is that the connection is steady, since a drop mid-transaction means waiting for reconciliation."
        }
    ],
    security: [
        {
            q: "Is the customer's Aadhaar data safe?",
            a: "Fingerprints are captured by the certified RD service on your device and encrypted before they ever leave it. Neither you nor we can see or store the biometric. Aadhaar numbers are masked everywhere in the dashboard and in reports."
        },
        {
            q: "Who actually moves the money?",
            a: "Transactions run over NPCI rails — AEPS, IMPS and BBPS — through our licensed banking partners. Shahparpay is the platform you work on; the settlement itself sits with the bank and the network."
        },
        {
            q: "What happens if someone gets into my account?",
            a: "Logins are protected by a password and an OTP on your registered mobile, and AEPS additionally requires your own fingerprint for the daily authentication the bank mandates. If you suspect anything, call support and your account is frozen immediately."
        },
        {
            q: "Can I see a record of everything I have done?",
            a: "Yes. Every service has its own report, and the wallet ledger shows every credit and debit with the running balance. Reports can be filtered by date and exported."
        }
    ]
};

const Landing: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<'products' | 'developers' | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();

    // Active Tab State
    const [bentoTab, setBentoTab] = useState<'collect' | 'global' | 'identity' | 'ai' | 'disburse'>('collect');
    const [faqCategory, setFaqCategory] = useState<'support' | 'getting_started' | 'integration' | 'security'>('support');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div id="top" className="landing-page relative overflow-x-clip bg-white text-slate-900">
            {/* ---------------------------------------------------------- NAVBAR (EXACT CASHFREE TOP MATCH) */}
            <nav
                className={`sticky top-0 z-50 transition-all duration-200 ${
                    scrolled ? 'bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm' : 'bg-white border-b border-slate-100'
                }`}
            >
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-3.5 sm:py-4">
                    <Link to="/" aria-label="Shahparpay home" className="shrink-0">
                        <Logo className="h-8 sm:h-10" />
                    </Link>

                    {/* Desktop Navigation Links */}
                    <div className="hidden items-center gap-2 lg:flex">
                        {/* PRODUCTS DROPDOWN */}
                        <div
                            className="relative"
                            onMouseEnter={() => setActiveDropdown('products')}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <button className="text-slate-600 hover:text-black inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                                Products
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'products' ? 'rotate-180 text-[#008c46]' : ''}`} />
                            </button>

                            {activeDropdown === 'products' && (
                                <div className="absolute left-0 top-full pt-2 w-[920px] -translate-x-16 z-50 mega-menu-content">
                                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl grid grid-cols-12 gap-6">
                                        <div className="col-span-8 grid grid-cols-3 gap-6">
                                            {PRODUCT_MENU_CATEGORIES.map((cat) => (
                                                <div key={cat.title} className="space-y-3">
                                                    <h4 className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                                                        {cat.title}
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {cat.items.map((item) => (
                                                            <a
                                                                key={item.title}
                                                                href={item.link}
                                                                onClick={() => setActiveDropdown(null)}
                                                                className="mega-menu-item-link group flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                                                            >
                                                                <div className="lp-icon-tile shrink-0 w-7 h-7 rounded-lg">
                                                                    <item.icon className="mega-icon h-3.5 w-3.5" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-slate-900 group-hover:text-[#008c46] transition-colors">
                                                                        {item.title}
                                                                    </div>
                                                                    <p className="text-[0.7rem] text-slate-500 line-clamp-1 mt-0.5">
                                                                        {item.desc}
                                                                    </p>
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Right Side Featured Product Cards */}
                                        <div className="col-span-4 border-l border-slate-100 pl-6 space-y-3">
                                            <p className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase">
                                                FEATURED SOLUTIONS
                                            </p>
                                            {MEGA_FEATURED_CARDS.map((card) => (
                                                <a
                                                    key={card.title}
                                                    href="#services"
                                                    onClick={() => setActiveDropdown(null)}
                                                    className={`block p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-[#008c46] transition-all group`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[0.6rem] font-bold tracking-wider uppercase text-[#008c46]">
                                                            {card.tag}
                                                        </span>
                                                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-[#008c46] text-white">
                                                            {card.badge}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-extrabold text-slate-900 group-hover:text-[#008c46] transition-colors">
                                                        {card.title}
                                                    </div>
                                                    <p className="text-[0.7rem] text-slate-500 mt-0.5">
                                                        {card.desc}
                                                    </p>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* DEVELOPERS DROPDOWN */}
                        <div
                            className="relative"
                            onMouseEnter={() => setActiveDropdown('developers')}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <button className="text-slate-600 hover:text-black inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                                Help
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'developers' ? 'rotate-180 text-[#008c46]' : ''}`} />
                            </button>

                            {activeDropdown === 'developers' && (
                                <div className="absolute left-0 top-full pt-2 w-[520px] -translate-x-16 z-50 mega-menu-content">
                                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xl space-y-3">
                                        <div className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                                            HELP &amp; RESOURCES
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {RESOURCE_MENU_ITEMS.map((item) => (
                                                <a
                                                    key={item.title}
                                                    href="#developers"
                                                    onClick={() => setActiveDropdown(null)}
                                                    className="mega-menu-item-link group flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="lp-icon-tile shrink-0 w-8 h-8 rounded-lg">
                                                        <item.icon className="mega-icon h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900 group-hover:text-[#008c46] transition-colors">
                                                            {item.title}
                                                        </div>
                                                        <p className="text-[0.7rem] text-slate-500 mt-0.5">
                                                            {item.desc}
                                                        </p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <a href="#services" className="text-slate-600 hover:text-black rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                            Commission
                        </a>
                        <a href="#calculator" className="text-slate-600 hover:text-black rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                            Resources
                        </a>
                    </div>

                    {/* Right Side Action Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            to="/login"
                            className="hidden sm:inline-flex bg-[#18181b] hover:bg-black text-white rounded-full px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm"
                        >
                            Sign Up for Free*
                        </Link>
                        <Link
                            to="/login"
                            className="bg-white border border-[#18181b] text-[#18181b] hover:bg-slate-50 rounded-full px-4 sm:px-6 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold transition-all"
                        >
                            Sign In
                        </Link>

                        <button
                            className="lg:hidden p-2 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Drawer */}
                {menuOpen && (
                    <div className="border-t border-slate-200 px-6 py-6 lg:hidden space-y-5 shadow-2xl bg-white animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Navigation</p>
                            <a href="#services" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                                Products &amp; Services
                            </a>
                            <a href="#developers" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                                Help &amp; Resources
                            </a>
                            <a href="#services" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                                Pricing
                            </a>
                            <a href="#contact" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                                Contact &amp; Support
                            </a>
                        </div>
                        <div className="pt-2 flex flex-col gap-2.5">
                            <Link to="/login" onClick={() => setMenuOpen(false)} className="bg-[#18181b] hover:bg-black text-white text-center py-3 rounded-full text-sm font-bold shadow-sm">
                                Sign Up for Free*
                            </Link>
                            <Link to="/login" onClick={() => setMenuOpen(false)} className="bg-white border border-slate-900 text-slate-900 text-center py-3 rounded-full text-sm font-bold">
                                Sign In
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* --------------------------------------------------------- HERO SECTION (FULL SCREEN MATCH) */}
            <section className="relative z-10 w-full min-h-0 lg:min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 px-4 sm:px-6 overflow-hidden bg-white">
                {/* Background MP4 Video framing the content */}
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none flex justify-center items-end z-0">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full max-w-[1440px] h-full object-cover object-bottom opacity-90 sm:opacity-95"
                    >
                        <source
                            src="https://cashfreelogo.cashfree.com/website/hero/Homepage_Hero_Cashfree%20revamp_v4%20Mp4.mp4"
                            type="video/mp4"
                        />
                        Your browser does not support the video tag.
                    </video>
                </div>

                {/* Centered Hero Header Text & Offer Card sitting OVER top of background video */}
                <div className="relative z-10 mx-auto max-w-5xl text-center flex flex-col items-center justify-center w-full">
                    {/* Eyebrow Pill Badge */}
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-3 sm:mb-4 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Digital banking services for your shop</span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.12] sm:leading-[1.08] max-w-4xl text-center mx-auto">
                        Turn Your Shop Into A Banking Point For Your Neighbourhood
                    </h1>

                    {/* Soft Lime/Yellow Offer Card matching screenshot */}
                    <div
                        className="my-4 sm:my-8 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-2xl w-full border border-lime-300/80 shadow-md text-center relative overflow-hidden mx-auto flex flex-col items-center justify-center backdrop-blur-xs"
                        style={{
                            background: 'linear-gradient(180deg, rgba(228, 250, 173, 0.94) 0%, rgba(254, 248, 184, 0.94) 100%)'
                        }}
                    >
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 text-slate-900">
                            <span className="text-4xl sm:text-6xl font-black tracking-tight text-[#00502b]">
                                ₹0
                            </span>
                            <span className="text-xs sm:text-xl font-extrabold text-[#00502b] ml-0.5 sm:ml-1">
                                to join. You earn a commission on every transaction.
                            </span>
                        </div>

                        <div className="w-full h-px bg-slate-900/10 my-3.5 sm:my-5" />

                        {/* 3 Checkmark Features */}
                        <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-3 sm:gap-x-6 text-[0.7rem] sm:text-sm font-bold text-slate-800 text-center w-full">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-slate-700 text-slate-800 flex items-center justify-center text-[0.55rem] sm:text-[0.6rem] font-black shrink-0">✓</span> Settle to your bank daily
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-slate-700 text-slate-800 flex items-center justify-center text-[0.55rem] sm:text-[0.6rem] font-black shrink-0">✓</span> Commission on every service
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons matching Cashfree screenshot */}
                    <div className="flex flex-row items-center justify-center gap-2.5 sm:gap-4 relative z-20 mx-auto w-full sm:w-auto">
                        <Link
                            to="/login"
                            className="bg-[#18181b] hover:bg-black text-white font-bold px-4 sm:px-7 py-3 rounded-full text-xs sm:text-base inline-flex items-center justify-center gap-2 sm:gap-3 shadow-md transition-transform hover:scale-[1.01] flex-1 sm:flex-initial"
                        >
                            <span>Become a Retailer</span>
                            <span className="bg-[#a3e635] text-black w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center font-black text-xs sm:text-sm">
                                ↗
                            </span>
                        </Link>
                        <a
                            href="#contact"
                            className="bg-white border border-[#18181b] text-[#18181b] hover:bg-slate-50 font-bold px-4 sm:px-7 py-3 rounded-full text-xs sm:text-base text-center transition-colors shadow-sm flex-1 sm:flex-initial"
                        >
                            Talk to Us
                        </a>
                    </div>

                    {/* Trust Badges Bar */}
                    <div className="pt-4 sm:pt-6 flex flex-wrap items-center justify-center gap-y-1.5 gap-x-4 sm:gap-x-6 text-[0.68rem] sm:text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.2"><ShieldCheck className="w-3.5 h-3.5 text-[#008c46]" /> Aadhaar data never stored</span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="flex items-center gap-1.2"><Zap className="w-3.5 h-3.5 text-[#008c46]" /> Runs on NPCI rails</span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="flex items-center gap-1.2"><CheckCircle2 className="w-3.5 h-3.5 text-[#008c46]" /> Retailers across West Bengal</span>
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------- DASHBOARD ON A LAPTOP (SCROLL-DRIVEN) */}
            <MacbookScrollDemo />

            {/* FLOATING CASHFREE-STYLE GREEN CHAT BUBBLE BUTTON IN BOTTOM RIGHT */}
            <a
                href="#contact"
                aria-label="Open support chat"
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#008c46] hover:bg-[#007339] text-white rounded-full flex items-center justify-center shadow-2xl z-50 transition-transform hover:scale-105"
            >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
            </a>



            {/* --------------------------------------------------- THE WHOLE PAYMENTS STACK, ON ONE PLATFORM ---------------- */}
            <section className="relative py-28 px-6 bg-white overflow-hidden select-none">
                {/* Official Cashfree Platform Background Image Asset & Soft Emerald Ambient Glow */}
                <img
                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a9462804c0231fefd408efe_platform-bg-p-1600.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-95"
                />

                <div className="mx-auto max-w-7xl relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[600px]">
                        {/* Left Column Floating Tiles */}
                        <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-between gap-14">
                            {/* Top Left: Live Analytics Chart Card (Matching Cashfree exact green lime box) */}
                            <div className="bg-[#ccf788] border border-lime-300 rounded-3xl p-4 shadow-lg w-full max-w-xs transform -rotate-2 hover:rotate-0 transition-transform">
                                <div className="bg-white rounded-2xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between text-[0.65rem] font-bold text-slate-500 mb-1">
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> • Live Payment Transactions
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">2,847</span>
                                        <span className="text-[0.6rem] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                            ↑ 3.5% VS LAST WEEK
                                        </span>
                                    </div>
                                    {/* Dual Wave Mountain Chart Graphic */}
                                    <svg className="w-full h-12 overflow-visible" viewBox="0 0 200 45">
                                        <defs>
                                            <linearGradient id="walletChartGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0,35 Q40,10 80,28 T160,12 T200,30 L200,45 L0,45 Z" fill="url(#walletChartGrad)" />
                                        <path d="M0,35 Q40,10 80,28 T160,12 T200,30" fill="none" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
                                        <circle cx="160" cy="12" r="4.5" fill="#047857" className="animate-ping" />
                                        <circle cx="160" cy="12" r="3.5" fill="#a3e635" />
                                    </svg>
                                </div>
                            </div>

                            {/* Bottom Left: Assisted Onboarding Support Card (Exact Cashfree Support Photo) */}
                            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl w-full max-w-xs h-64 transform rotate-1 hover:rotate-0 transition-transform group">
                                <img
                                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"
                                    alt="Support Specialist"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-white/80 text-xs shadow-lg">
                                    <p className="font-bold text-slate-800 text-[0.7rem]">Welcome onboard</p>
                                    <div className="flex items-center justify-between mt-1 text-emerald-700 font-extrabold text-[0.7rem]">
                                        <span>Start assisted setup</span>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Center Column Title & Disbursal Card */}
                        <div className="lg:col-span-4 flex flex-col items-center text-center justify-center space-y-12">
                            {/* Centered H2 Title */}
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08] max-w-md">
                                Every service your customers ask for, on one login.
                            </h2>

                            {/* Bottom Center: Instant Disbursal & Global Remittance Card */}
                            <div className="bg-[#00381e] text-white p-5 rounded-3xl shadow-2xl w-full max-w-xs border border-emerald-800/60">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-9 h-9 rounded-full bg-emerald-700 border border-emerald-500 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                                        AV
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-extrabold text-white">Abhishek Verma</p>
                                        <p className="text-[0.6rem] text-emerald-300">Retailer KYC verified</p>
                                    </div>
                                    <span className="ml-auto text-sm font-black text-emerald-400">₹11,000.00</span>
                                </div>
                                <div className="bg-[#002715] p-2.5 rounded-2xl flex items-center justify-between text-xs border border-emerald-800/60">
                                    <div className="flex items-center gap-1.5 font-extrabold text-[0.7rem] text-white">
                                        <span>🇮🇳 INR</span>
                                        <span className="text-emerald-400">⇄</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <span>🇺🇸</span>
                                        <span>🇬🇧</span>
                                        <span>🇧🇷</span>
                                        <span>🇹🇭</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column Floating Tiles */}
                        <div className="lg:col-span-4 flex flex-col items-center lg:items-start justify-between gap-14">
                            {/* Top Right: Merchant Photo Card with Floating Glass Payment Logos */}
                            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl w-full max-w-xs h-64 transform rotate-2 hover:rotate-0 transition-transform group">
                                <img
                                    src="https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=600&q=80"
                                    alt="Retailer serving a customer"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
                                {/* Floating Payment Badges Glass Overlay */}
                                <div className="absolute inset-3 flex items-end">
                                    <div className="bg-white/85 backdrop-blur-md p-2 rounded-2xl border border-white/90 w-full grid grid-cols-4 gap-1.5 text-center shadow-lg">
                                        <span className="text-[0.55rem] font-bold py-1 bg-purple-100 text-purple-800 rounded">PhonePe</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-blue-100 text-blue-800 rounded">GPay</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-emerald-100 text-emerald-800 rounded">UPI</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-amber-100 text-amber-900 rounded">RuPay</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-indigo-100 text-indigo-800 rounded">Visa</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-slate-100 text-slate-800 rounded">Paytm</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-rose-100 text-rose-800 rounded">Master</span>
                                        <span className="text-[0.55rem] font-bold py-1 bg-[#008c46] text-white rounded">AEPS</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Right: "No Hidden Charges" Sky Blue Card */}
                            <div className="bg-[#0284c7] text-white rounded-3xl p-6 shadow-xl w-full max-w-xs text-center border border-sky-300 relative transform -rotate-1 hover:rotate-0 transition-transform">
                                <h4 className="text-2xl font-black tracking-tight mb-2">No Hidden</h4>
                                <div className="my-2 mx-auto w-32 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 p-1.5 flex items-center justify-center">
                                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-lime-300 via-emerald-300 to-emerald-400 flex items-center justify-center text-slate-900 font-extrabold text-xs shadow-inner">
                                        ₹0 to join
                                    </div>
                                </div>
                                <h4 className="text-2xl font-black tracking-tight mt-2">Charges</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* -------------------------------------------------- EVERY WAY YOUR CUSTOMER WANTS TO PAY (CASHFREE BENTO GRID) */}
            <section className="w-full bg-[#f8fafc] py-20 px-4 sm:px-6 lg:px-8 border-y border-slate-100">
                <div className="mx-auto max-w-7xl">
                    {/* Centered Main Title */}
                    <div className="text-center max-w-4xl mx-auto mb-14">
                        <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                            Cash withdrawal, money transfer, bills, recharge. All from your counter.
                        </h2>
                    </div>

                    {/* Bento Grid (2 Cards) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
                        {/* LEFT BENTO CARD: Shahparpay Checkout */}
                        <div className="relative rounded-[32px] bg-gradient-to-br from-[#bae6fd] via-[#7dd3fc] to-[#38bdf8] p-8 sm:p-10 overflow-hidden flex flex-col justify-between shadow-xl min-h-[480px] border border-sky-200 group">
                            {/* Top Text */}
                            <div className="relative z-10 max-w-sm pr-12">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                    AEPS Cash Withdrawal
                                </h3>
                                <p className="mt-3 text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
                                    Your customer puts a finger on the scanner and walks out with cash. No card, no passbook, no trip to a bank branch. You earn on every withdrawal.
                                </p>
                            </div>

                            {/* Top Right Arrow Circle Button */}
                            <a
                                href="#products"
                                aria-label="Explore AEPS cash withdrawal"
                                className="absolute top-8 right-8 z-20 w-11 h-11 rounded-full bg-[#18181b] text-white flex items-center justify-center hover:bg-black transition-all duration-200 hover:scale-110 shadow-lg"
                            >
                                <ArrowUpRight className="w-5 h-5" />
                            </a>

                            {/* Floating Pill Badge: Faster Checkout */}
                            <div className="absolute left-8 bottom-36 z-20 hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-[#008c46] text-white text-xs font-extrabold shadow-xl border border-emerald-400/40">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                    <ShoppingCart className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span>Cash paid out</span>
                            </div>

                            {/* Floating Dark Glass Badge: Conversion Rate */}
                            <div className="absolute left-8 bottom-8 z-20 bg-[#18181b]/95 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-white/10 w-56 backdrop-blur-md">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Commission earned today
                                </div>
                                <div className="mt-1 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-white tracking-tight flex items-center gap-1">
                                        <span className="text-emerald-400 text-lg">↑</span> ₹1,240
                                    </span>
                                </div>
                                {/* Wave chart graphic */}
                                <div className="mt-2 h-8 w-full">
                                    <svg className="w-full h-full text-emerald-400" viewBox="0 0 100 30" fill="none">
                                        <path
                                            d="M0 25 Q 15 28, 30 18 T 60 15 T 80 8 T 100 5 L 100 30 L 0 30 Z"
                                            fill="url(#greenWaveGrad)"
                                            opacity="0.3"
                                        />
                                        <path
                                            d="M0 25 Q 15 28, 30 18 T 60 15 T 80 8 T 100 5"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            fill="none"
                                        />
                                        <defs>
                                            <linearGradient id="greenWaveGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </div>

                            {/* Center/Right Phone Mockup */}
                            <div className="relative mt-8 lg:mt-0 flex justify-end items-end -mr-6 -mb-10 sm:-mr-8 sm:-mb-12 pointer-events-none">
                                <div className="relative w-64 sm:w-72 rounded-[36px] bg-[#18181b] p-3 shadow-2xl border-4 border-slate-800 transform rotate-[-3deg] group-hover:rotate-0 transition-transform duration-500">
                                    {/* Dynamic Island / Notch */}
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-30" />

                                    {/* Phone Screen UI */}
                                    <div className="bg-slate-50 rounded-[28px] overflow-hidden pt-6 pb-4 px-3.5 space-y-2.5 border border-slate-200">
                                        {/* URL Bar */}
                                        <div className="bg-slate-200/80 text-slate-700 rounded-full px-3 py-1 text-[10px] text-center font-semibold flex items-center justify-center gap-1 mx-auto max-w-[150px]">
                                            <Lock className="w-2.5 h-2.5 text-slate-500" />
                                            <span>shahparpay.in</span>
                                        </div>

                                        {/* Merchant Store Header */}
                                        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs">☕</span>
                                                    <span className="text-xs font-bold text-slate-900">Sunita Devi</span>
                                                </div>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold inline-block mt-0.5 border border-emerald-200">
                                                    Aadhaar verified
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400">Withdrawing</span>
                                                <div className="text-sm font-black text-slate-900">₹2,000</div>
                                            </div>
                                        </div>

                                        {/* Coupon Card */}
                                        <div className="bg-[#008c46] text-white rounded-xl p-2.5 flex items-center justify-between text-xs shadow-sm">
                                            <div>
                                                <div className="font-black text-xs">Your commission ₹14</div>
                                                <div className="text-[9px] text-emerald-100">Credited to wallet</div>
                                            </div>
                                            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                                Paid
                                            </span>
                                        </div>

                                        {/* Product Item */}
                                        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-sm flex items-center gap-2">
                                            <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center text-sm font-bold">
                                                🥣
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-bold text-slate-900">Mobile recharge</p>
                                                <p className="text-[9px] text-slate-500">₹239 / 28 days</p>
                                            </div>
                                            <button className="bg-[#008c46] text-white text-[9px] font-bold px-2.5 py-1 rounded">
                                                PAY
                                            </button>
                                        </div>

                                        {/* Payment Methods */}
                                        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-sm space-y-1.5">
                                            <p className="text-[9px] font-bold text-slate-400">Bank chosen automatically</p>
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 py-1 border-b border-slate-100">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span>State Bank of India</span>
                                                </div>
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 py-1 border-b border-slate-100">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                                    <span>Bank of Baroda</span>
                                                </div>
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 py-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <span>Punjab National Bank</span>
                                                </div>
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT BENTO CARD: Payment Gateway */}
                        <div className="relative rounded-[32px] bg-gradient-to-br from-[#e0f2fe] via-[#f0fdf4] to-[#dcfce7] p-8 sm:p-10 overflow-hidden flex flex-col justify-between shadow-xl min-h-[480px] border border-emerald-200 group">
                            {/* Top Text */}
                            <div className="relative z-10 max-w-md pr-6">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                    Money Transfer & Bills
                                </h3>
                                <p className="mt-3 text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
                                    Send cash to any bank account over IMPS, pay an electricity or gas bill, recharge a phone or a FASTag. The errands that bring the same customers back to your shop every month.
                                </p>
                            </div>

                            {/* Floating Payment Method Glass Pills Grid */}
                            <div className="mt-10 sm:mt-12 grid grid-cols-2 sm:grid-cols-3 gap-3.5 relative z-10">
                                {/* VISA */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <span className="font-black text-blue-900 tracking-tighter text-base italic">VISA</span>
                                </div>

                                {/* Cards */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center gap-2.5 font-bold text-slate-800 text-sm group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-[#008c46] text-white flex items-center justify-center shadow-sm">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <span>Cards</span>
                                </div>

                                {/* Paytm */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <span className="font-black text-sky-600 tracking-tight text-sm">pay<span className="text-blue-900">tm</span></span>
                                </div>

                                {/* RuPay */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <span className="font-black text-slate-800 tracking-tight text-sm">
                                        RuPay<span className="text-orange-500 font-extrabold ml-0.5">❯</span>
                                    </span>
                                </div>

                                {/* Wallets */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center gap-2.5 font-bold text-slate-800 text-sm group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <span>Wallets</span>
                                </div>

                                {/* GPay */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <span className="font-extrabold text-slate-700 text-sm flex items-center gap-1">
                                        <span className="text-blue-500">G</span>
                                        <span className="text-red-500">P</span>
                                        <span className="text-amber-500">a</span>
                                        <span className="text-green-500">y</span>
                                    </span>
                                </div>

                                {/* Net Banking */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center gap-2.5 font-bold text-slate-800 text-sm group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-[#008c46] text-white flex items-center justify-center shadow-sm">
                                        <Building className="w-4 h-4" />
                                    </div>
                                    <span>Net Banking</span>
                                </div>

                                {/* Mastercard */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <div className="flex items-center -space-x-2">
                                        <div className="w-5 h-5 rounded-full bg-red-500 opacity-90" />
                                        <div className="w-5 h-5 rounded-full bg-amber-400 opacity-90" />
                                    </div>
                                </div>

                                {/* PhonePe */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                        पे
                                    </div>
                                </div>

                                {/* Pay Later */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center gap-2.5 font-bold text-slate-800 text-sm group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-[#008c46] text-white flex items-center justify-center shadow-sm">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <span>Pay Later</span>
                                </div>

                                {/* BHIM / Indian Flag */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center justify-center group-hover:scale-105 transition-all">
                                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-800">
                                        <span className="w-3.5 h-3.5 rounded-sm bg-gradient-to-b from-orange-500 via-white to-green-600 border border-slate-300 inline-block shadow-xs" />
                                        <span>BHIM</span>
                                    </div>
                                </div>

                                {/* EMIs */}
                                <div className="bg-white/85 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border border-white/90 flex items-center gap-2.5 font-bold text-slate-800 text-sm group-hover:scale-105 transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-[#008c46] text-white flex items-center justify-center shadow-sm">
                                        <Receipt className="w-4 h-4" />
                                    </div>
                                    <span>EMIs</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bento Grid Row 2: Payment Forms (no-code) & Instant Settlements */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch mt-8">
                        {/* LEFT CARD: Payment Forms (no-code) */}
                        <div className="relative rounded-[32px] bg-[#f8fafc] p-8 sm:p-10 overflow-hidden flex flex-col justify-between shadow-xl min-h-[480px] border border-slate-200/80 group">
                            {/* Top Text */}
                            <div className="relative z-10 max-w-sm pr-12">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                    PAN Card & ITR Filing
                                </h3>
                                <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                                    Apply for a new PAN card, file a correction, or file an income tax return for a customer. Higher value work than a recharge, and nobody in the area is offering it.
                                </p>
                            </div>

                            {/* Top Right Arrow Circle Button */}
                            <a
                                href="#products"
                                aria-label="Explore PAN and ITR services"
                                className="absolute top-8 right-8 z-20 w-11 h-11 rounded-full bg-[#18181b] text-white flex items-center justify-center hover:bg-black transition-all duration-200 hover:scale-110 shadow-lg"
                            >
                                <ArrowUpRight className="w-5 h-5" />
                            </a>

                            {/* Form Mockup Container & Gold Pillar Accent */}
                            <div className="relative mt-8 lg:mt-0 flex items-end justify-between">
                                {/* Form Mockup Card */}
                                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 sm:p-5 text-slate-900 max-w-md w-full transform -rotate-1 group-hover:rotate-0 transition-transform duration-500 z-10">
                                    {/* Form Header Banner */}
                                    <div className="bg-gradient-to-r from-lime-200 via-emerald-200 to-teal-200 rounded-xl p-3.5 text-center relative overflow-hidden mb-3 border border-emerald-200/60">
                                        <span className="absolute top-2 right-2 text-[8px] font-bold text-slate-600 bg-white/70 px-1.5 py-0.5 rounded">
                                            Powered by Shahparpay
                                        </span>
                                        <div className="flex items-center justify-center gap-1.5 pt-1">
                                            <div className="w-6 h-6 rounded-full bg-[#008c46] text-white flex items-center justify-center text-xs font-black">
                                                🍃
                                            </div>
                                            <span className="text-base font-extrabold text-slate-900 tracking-tight">TrueHelp</span>
                                        </div>
                                    </div>

                                    {/* Form Content Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                        {/* Left Column Placeholders */}
                                        <div className="space-y-2 text-[10px]">
                                            <div>
                                                <p className="font-bold text-slate-800">About</p>
                                                <div className="h-1.5 bg-slate-200 rounded w-full mt-1" />
                                                <div className="h-1.5 bg-slate-100 rounded w-4/5 mt-1" />
                                            </div>
                                            <div className="pt-2">
                                                <p className="font-bold text-slate-800">Tax Exemption Details</p>
                                                <div className="h-1.5 bg-slate-200 rounded w-full mt-1" />
                                                <div className="h-1.5 bg-slate-100 rounded w-3/4 mt-1" />
                                            </div>
                                        </div>

                                        {/* Right Column Fields */}
                                        <div className="space-y-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-800 block">Phone Number</label>
                                                <div className="bg-slate-100/90 rounded-lg p-2 text-[10px] font-semibold text-slate-700 border border-slate-200 flex items-center gap-1 mt-0.5">
                                                    <span className="text-slate-500">+91</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>9876 5432 10</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-800 block">Name</label>
                                                <div className="bg-slate-100/90 rounded-lg p-2 text-[10px] font-semibold text-slate-800 border border-slate-200 mt-0.5">
                                                    Samar Ahuja
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-800 block">Donation amount</label>
                                                <div className="bg-slate-100/90 rounded-lg p-2 text-[10px] font-extrabold text-slate-900 border border-slate-200 flex items-center gap-1 mt-0.5">
                                                    <span className="text-slate-400 font-bold">₹</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>1,500</span>
                                                </div>
                                            </div>

                                            <button className="bg-[#008c46] hover:bg-[#007339] text-white font-extrabold py-2 px-3 rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-1.5 w-full transition-colors mt-2">
                                                <span>Proceed to Pay</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Gold Trophy Accent Graphic */}
                                <div className="hidden sm:flex flex-col items-center justify-center ml-4 opacity-90">
                                    <div className="w-20 h-32 rounded-3xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 shadow-xl border-2 border-amber-200/80 flex flex-col items-center justify-center p-2 transform rotate-6">
                                        <div className="w-12 h-12 rounded-full bg-amber-100/60 border border-amber-200 flex items-center justify-center text-xl shadow-inner">
                                            🏆
                                        </div>
                                        <div className="w-10 h-2 bg-amber-600/40 rounded-full mt-2" />
                                        <div className="w-8 h-2 bg-amber-600/40 rounded-full mt-1" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT CARD: Instant Settlements */}
                        <div className="relative rounded-[32px] bg-[#f8fafc] p-8 sm:p-10 overflow-hidden flex flex-col justify-between shadow-xl min-h-[480px] border border-slate-200/80 group">
                            {/* Top Text */}
                            <div className="relative z-10 max-w-md pr-12">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                    Daily Settlement
                                </h3>
                                <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                                    Move the day's earnings from your wallet to your own bank account, on your schedule. <a href="#products" className="underline font-bold text-slate-900 hover:text-[#008c46]">Learn more</a>
                                </p>
                            </div>

                            {/* Top Right Arrow Circle Button */}
                            <a
                                href="#products"
                                aria-label="Learn more about daily settlement"
                                className="absolute top-8 right-8 z-20 w-11 h-11 rounded-full bg-[#18181b] text-white flex items-center justify-center hover:bg-black transition-all duration-200 hover:scale-110 shadow-lg"
                            >
                                <ArrowUpRight className="w-5 h-5" />
                            </a>

                            {/* Settlement Graphic Showcase */}
                            <div className="relative mt-8 lg:mt-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                                {/* Dark Green Receipt Card */}
                                <div className="bg-gradient-to-br from-[#1b3a2b] via-[#122b1f] to-[#0c1f16] text-white p-5 rounded-2xl shadow-2xl border border-emerald-800/80 w-full sm:w-64 transform -rotate-2 group-hover:rotate-0 transition-transform duration-500 z-10">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>Settled to your bank</span>
                                    </div>
                                    <div className="text-3xl font-black text-white tracking-tight my-2">
                                        ₹2,450
                                    </div>
                                    <div className="text-[10px] text-emerald-200/70 font-medium mb-4">
                                        29 Nov 2026 • 02:16 PM
                                    </div>
                                    <div className="pt-2 border-t border-emerald-800/60 flex items-center gap-1.5 text-[11px] font-bold text-emerald-100">
                                        <span>🏛️</span>
                                        <span>Your account •••• 4771</span>
                                    </div>
                                </div>

                                {/* Stack of Settlement Status Pills */}
                                <div className="space-y-2.5 w-full sm:w-auto z-20">
                                    {/* Pill 1 */}
                                    <div className="bg-white text-slate-900 p-3 rounded-2xl shadow-md border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-bold hover:scale-105 transition-all">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">💸</span>
                                            <div>
                                                <p className="text-slate-900 font-extrabold text-xs">₹2,450</p>
                                                <p className="text-[9px] text-slate-400 font-medium">AEPS withdrawal</p>
                                            </div>
                                        </div>
                                        <span className="bg-[#008c46] text-white px-2.5 py-1 rounded-full text-[9px] font-extrabold shadow-sm">
                                            Settled in 4 mins
                                        </span>
                                    </div>

                                    {/* Pill 2 */}
                                    <div className="bg-white text-slate-900 p-3 rounded-2xl shadow-md border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-bold hover:scale-105 transition-all transform sm:translate-x-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🌐</span>
                                            <div>
                                                <p className="text-slate-900 font-extrabold text-xs">$1,800</p>
                                                <p className="text-[9px] text-slate-400 font-medium">Cross-border</p>
                                            </div>
                                        </div>
                                        <span className="bg-[#008c46] text-white px-2.5 py-1 rounded-full text-[9px] font-extrabold shadow-sm">
                                            Settled in 22 mins
                                        </span>
                                    </div>

                                    {/* Pill 3 */}
                                    <div className="bg-white text-slate-900 p-3 rounded-2xl shadow-md border border-slate-200/80 flex items-center justify-between gap-3 text-xs font-bold hover:scale-105 transition-all transform sm:translate-x-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🔄</span>
                                            <div>
                                                <p className="text-slate-900 font-extrabold text-xs">₹899</p>
                                                <p className="text-[9px] text-slate-400 font-medium">To UPI •••• 7712</p>
                                            </div>
                                        </div>
                                        <span className="bg-[#008c46] text-white px-2.5 py-1 rounded-full text-[9px] font-extrabold shadow-sm">
                                            Settled in 11 mins
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Interactive Pill Navigation Tab Bar */}
                    <div className="mt-12 flex justify-center">
                        <div className="bg-white rounded-full p-1.5 shadow-xl border border-slate-200/90 inline-flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto">
                            <button
                                onClick={() => setBentoTab('collect')}
                                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    bentoTab === 'collect'
                                        ? 'bg-[#00a859] text-white shadow-md'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                Banking
                            </button>
                            <button
                                onClick={() => setBentoTab('global')}
                                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    bentoTab === 'global'
                                        ? 'bg-[#00a859] text-white shadow-md'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                Bills & Recharge
                            </button>
                            <button
                                onClick={() => setBentoTab('identity')}
                                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    bentoTab === 'identity'
                                        ? 'bg-[#00a859] text-white shadow-md'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                Documents
                            </button>
                            <button
                                onClick={() => setBentoTab('ai')}
                                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    bentoTab === 'ai'
                                        ? 'bg-[#00a859] text-white shadow-md'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                Earnings
                            </button>
                            <button
                                onClick={() => setBentoTab('disburse')}
                                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    bentoTab === 'disburse'
                                        ? 'bg-[#00a859] text-white shadow-md'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                Payouts
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* -------------------------------------------------- GO GLOBAL, BOTH WAYS SECTION */}
            <section className="relative w-full py-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white border-b border-slate-100">
                {/* Background Image asset with green radial contour lines */}
                <img
                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a94336d185276914cb559d0_go-global-bg.webp"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                />

                {/* Soft Subtle Green Glow on Far Left & Right Edges Only */}
                <div className="absolute top-0 bottom-0 left-0 w-72 bg-gradient-to-r from-emerald-300/10 via-emerald-100/5 to-transparent pointer-events-none z-0" />
                <div className="absolute top-0 bottom-0 right-0 w-72 bg-gradient-to-l from-emerald-300/10 via-emerald-100/5 to-transparent pointer-events-none z-0" />

                <div className="mx-auto max-w-7xl relative z-10">
                    {/* Section Title */}
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                            Two more reasons they walk in.
                        </h2>
                    </div>

                    {/* Two Phone Cards Grid (Compact & Small) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start max-w-4xl lg:max-w-5xl mx-auto">
                        {/* LEFT COLUMN: International Payment Gateway */}
                        <div className="flex flex-col items-center text-center space-y-6 group">
                            {/* Official Image Asset 1: IPG */}
                            <div className="w-full flex justify-center">
                                <img
                                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a9a6b3d5840c0321cae2e62_4322444dda0a1a831988285622c076a6_IPG-1.webp"
                                    alt="BBPS bill payments"
                                    className="w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[340px] h-auto object-contain"
                                />
                            </div>

                            {/* Description & Link */}
                            <div className="max-w-sm space-y-2.5">
                                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                                    BBPS Bill Payments
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                                    Electricity, water, gas, broadband, LPG, FASTag, insurance premiums and credit card bills — all on the Bharat BillPay network, with an instant receipt for the customer.
                                </p>
                                <a
                                    href="#products"
                                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#008c46] hover:text-[#006e37] transition-colors group-hover:translate-x-1 duration-200 pt-1"
                                >
                                    <span>Know More</span>
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sell into India */}
                        <div className="flex flex-col items-center text-center space-y-6 group">
                            {/* Official Image Asset 2: Imports / Sell into India */}
                            <div className="w-full flex justify-center">
                                <img
                                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a93f884e4d791d307c3ae4b_828c5caa8cbe5480e59d6489339c4a03_imports.png"
                                    alt="Mobile and DTH recharge"
                                    className="w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[340px] h-auto object-contain"
                                />
                            </div>

                            {/* Description & Link */}
                            <div className="max-w-sm space-y-2.5">
                                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                                    Mobile & DTH Recharge
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                                    Every prepaid operator and DTH provider, with current plans listed in the dashboard so you are not hunting for a pack while a customer waits. Small tickets, steady footfall, commission on each one.
                                </p>
                                <a
                                    href="#products"
                                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#008c46] hover:text-[#006e37] transition-colors group-hover:translate-x-1 duration-200 pt-1"
                                >
                                    <span>Know More</span>
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* -------------------------------------------------- PAYMENTS, BUILT FOR AI SECTION */}
            <section className="relative w-full py-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white border-b border-slate-100">
                <div className="mx-auto max-w-7xl relative z-10">
                    {/* Section Header */}
                    <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                        <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                            Know exactly what you earned
                        </h2>
                        <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto">
                            Every transaction, every commission and every settlement is on record, so the day's takings are never a guess.
                        </p>
                    </div>

                    {/* 3-Column Container Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center max-w-6xl mx-auto">
                        {/* Left Column: Eyebrow + Shahparpay Here Title */}
                        <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
                            <span className="inline-block bg-[#fef08a]/80 text-[#854d0e] font-extrabold text-[11px] tracking-wider uppercase px-3.5 py-1 rounded-full border border-amber-300/60 shadow-xs">
                                WALLET & REPORTS
                            </span>
                            <h3 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                                Your ledger, live
                            </h3>
                            <a
                                href="#products"
                                className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-[#008c46] hover:text-[#006e37] transition-colors group pt-2"
                            >
                                <span>See what you can track</span>
                                <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>

                        {/* Center Column: Phone Mockup Video (Slim & Perfect Fit) */}
                        <div className="lg:col-span-4 flex justify-center">
                            <div className="relative w-[250px] sm:w-[270px] rounded-[42px] bg-black p-2 shadow-2xl border-2 border-slate-800/80 overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                                {/* Dynamic Island Notch */}
                                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30 border border-slate-900" />

                                {/* Video Player (Perfect Native Fit) */}
                                <div className="rounded-[34px] overflow-hidden bg-black relative flex items-center justify-center">
                                    <video
                                        src="https://thunderclap-assets.s3.ap-south-1.amazonaws.com/Cashfree+Assets/Section+Animations/Cashfree+Here/cashfree-here.webm"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-auto object-contain rounded-[34px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Description Text & Claude Decorator */}
                        <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 relative">
                            {/* Claude Decorator WebP Asset */}
                            <img
                                src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a973f940a72752aad8f92a4_claude.webp"
                                alt=""
                                className="w-32 sm:w-40 h-auto opacity-80 pointer-events-none mb-1 lg:-mt-10"
                            />

                            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                                One wallet across every service, with a running balance and a line for each credit and debit. Separate reports for AEPS, money transfer, recharge, bills, PAN and ITR, filterable by date and exportable whenever your accountant asks.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* -------------------------------------------------- BUILD PAYMENTS TO MATCH CTA BANNER SECTION */}
            <section className="w-full bg-[#0b1411] py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="relative rounded-[36px] bg-gradient-to-r from-[#007038] via-[#008c46] to-[#009e4f] p-8 sm:p-12 lg:p-16 overflow-hidden shadow-2xl border border-emerald-700/60">
                        {/* Grid Layout: Left Content, Right Image Asset */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
                            {/* Left Column Content */}
                            <div className="lg:col-span-7 space-y-6 text-left">
                                <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold text-white tracking-tight leading-[1.12] max-w-xl">
                                    Your shop is already busy. Give people one more reason to come in.
                                </h2>

                                {/* CTA Buttons */}
                                <div className="flex items-center gap-4 flex-wrap pt-2">
                                    <Link
                                        to="/register"
                                        className="bg-[#18181b] hover:bg-black text-white pl-6 pr-2 py-2.5 rounded-full font-extrabold text-sm shadow-2xl flex items-center gap-3 transition-all hover:scale-105 group"
                                    >
                                        <span>Become a Retailer</span>
                                        <div className="w-8 h-8 rounded-full bg-[#ccf788] text-slate-900 flex items-center justify-center font-black group-hover:rotate-45 transition-transform">
                                            ↗
                                        </div>
                                    </Link>

                                    <a
                                        href="#developers"
                                        className="border border-white/80 hover:bg-white/10 text-white px-6 py-3 rounded-full font-bold text-sm transition-all shadow-md"
                                    >
                                        Talk to Us
                                    </a>
                                </div>

                                {/* Offer Subtext */}
                                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium max-w-lg leading-relaxed pt-2">
                                    Nothing to pay to join and nothing to pay monthly. You keep a commission on every transaction, and you settle your wallet to your own bank account whenever you want.
                                </p>

                                {/* Certifications Row */}
                                <div className="pt-4 border-t border-emerald-600/40 flex items-center gap-3 text-xs font-bold text-emerald-100 flex-wrap">
                                    <span>AEPS</span>
                                    <span className="text-emerald-300/60">■</span>
                                    <span>Micro ATM</span>
                                    <span className="text-emerald-300/60">■</span>
                                    <span>BBPS</span>
                                    <span className="text-emerald-300/60">■</span>
                                    <span>DMT</span>
                                    <span className="text-emerald-300/60">■</span>
                                    <span>PAN &amp; ITR</span>
                                </div>
                            </div>

                            {/* Right Column: Official 3D Graphic Asset */}
                            <div className="lg:col-span-5 flex justify-center lg:justify-end">
                                <img
                                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6aa43a038982095797f7dd58_fac8573131811123344e92997762f76d_home-cta-img.webp"
                                    alt="Build payments to match"
                                    className="w-full max-w-md lg:max-w-lg h-auto object-contain transform lg:scale-110 drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Floating WhatsApp Action Button */}
            <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#00a859] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200 border-2 border-white cursor-pointer"
            >
                <MessageCircle className="w-7 h-7 fill-current" />
            </a>



            {/* --------------------------------------------------- FREQUENTLY ASKED QUESTIONS (CASHFREE MATCH) */}
            <section 
                id="faq" 
                className="relative py-20 sm:py-28 px-4 sm:px-6 overflow-hidden bg-white select-none bg-cover bg-center"
                style={{
                    backgroundImage: "url('https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a69ce5408c89730990868d8_865afa08fb2d072c7efed594006c6ffc_faq-bg-gradient.webp')"
                }}
            >
                {/* Official Cashfree FAQ Background Gradient Texture */}
                <img
                    src="https://cdn.prod.website-files.com/6a60525e5f4d2e4f1faed952/6a69ce5408c89730990868d8_865afa08fb2d072c7efed594006c6ffc_faq-bg-gradient.webp"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none opacity-100 select-none z-0"
                />

                <div className="relative z-10 max-w-5xl mx-auto space-y-8 sm:space-y-10">
                    {/* Centered Heading */}
                    <div className="text-center space-y-3">
                        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
                            Frequently <span className="text-[#008c46]">asked questions</span>
                        </h2>
                        <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto">
                            Earnings, onboarding, devices and security — the things retailers ask before they sign up.
                        </p>
                    </div>

                    {/* Category Pill Tabs */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-3xl mx-auto">
                        <button
                            type="button"
                            onClick={() => { setFaqCategory('getting_started'); setOpenFaqIndex(0); }}
                            className={`px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                faqCategory === 'getting_started'
                                    ? 'bg-[#ccf788] text-slate-900 border border-[#a3e635] shadow-xs scale-[1.02]'
                                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80'
                            }`}
                        >
                            Getting Started
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFaqCategory('integration'); setOpenFaqIndex(0); }}
                            className={`px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                faqCategory === 'integration'
                                    ? 'bg-[#ccf788] text-slate-900 border border-[#a3e635] shadow-xs scale-[1.02]'
                                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80'
                            }`}
                        >
                            Devices &amp; Setup
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFaqCategory('security'); setOpenFaqIndex(0); }}
                            className={`px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                faqCategory === 'security'
                                    ? 'bg-[#ccf788] text-slate-900 border border-[#a3e635] shadow-xs scale-[1.02]'
                                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80'
                            }`}
                        >
                            Safety &amp; Trust
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFaqCategory('support'); setOpenFaqIndex(0); }}
                            className={`px-4 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                faqCategory === 'support'
                                    ? 'bg-[#ccf788] text-slate-900 border border-[#a3e635] shadow-xs scale-[1.02]'
                                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80'
                            }`}
                        >
                            Earnings &amp; Support
                        </button>
                    </div>

                    {/* FAQ Items Grid (2 Column Responsive Layout matching Cashfree screenshot) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2">
                        {FAQ_DATA[faqCategory].map((item, index) => {
                            const isOpen = openFaqIndex === index;
                            return (
                                <div
                                    key={index}
                                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                    className={`bg-white/90 backdrop-blur-md rounded-2xl border p-5 sm:p-6 transition-all duration-200 shadow-2xs cursor-pointer ${
                                        isOpen ? 'border-emerald-400/90 shadow-md bg-white' : 'border-slate-200/80 hover:border-emerald-300/80'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                            {item.q}
                                        </h3>
                                        <div
                                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-base shrink-0 transition-transform ${
                                                isOpen ? 'bg-[#008c46] text-white rotate-45' : 'bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            +
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed animate-in fade-in duration-200">
                                            {item.a}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Floating WhatsApp Action Button */}
            <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#00a859] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200 border-2 border-white cursor-pointer"
            >
                <MessageCircle className="w-7 h-7 fill-current" />
            </a>

            {/* -------------------------------------------------------- FOOTER WITH GIANT BRAND LOGO BANNER */}
            <footer id="contact" className="scroll-mt-20 bg-[#0c120e] text-slate-300 border-t border-slate-800 relative z-10 overflow-hidden">
                <div className="mx-auto w-full max-w-7xl px-6 py-16">
                    {/* Top 4 Navigation Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                        {/* Column 1: Brand Info */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-3">
                                <img src={whiteLogo} alt="Shahparpay Logo" className="h-9 w-auto object-contain" />
                                <span className="text-xl font-extrabold text-white tracking-tight">Shahparpay</span>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                                Shahparpay Solutions Private Limited equips shop owners across India to offer banking, bill payment and document services to their customers, and to earn on every transaction.
                            </p>
                            <div className="pt-2 text-xs font-semibold text-[#a3e635] flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Services delivered over NPCI rails through licensed banking partners
                            </div>
                        </div>

                        {/* Column 2: Products */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Banking Services</h4>
                            <ul className="space-y-2 text-xs font-medium text-slate-400">
                                <li><a href="#products" className="hover:text-white transition-colors">AEPS Cash Withdrawal</a></li>
                                <li><a href="#products" className="hover:text-white transition-colors">Balance &amp; Mini Statement</a></li>
                                <li><a href="#products" className="hover:text-white transition-colors">Micro ATM</a></li>
                                <li><a href="#products" className="hover:text-white transition-colors">Money Transfer (DMT)</a></li>
                                <li><a href="#products" className="hover:text-white transition-colors">UPI QR Collection</a></li>
                                <li><a href="#products" className="hover:text-white transition-colors">Aadhaar Pay</a></li>
                            </ul>
                        </div>

                        {/* Column 3: Payouts & Verification */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Bills &amp; Documents</h4>
                            <ul className="space-y-2 text-xs font-medium text-slate-400">
                                <li><a href="#payouts" className="hover:text-white transition-colors">Mobile &amp; DTH Recharge</a></li>
                                <li><a href="#payouts" className="hover:text-white transition-colors">BBPS Bill Payments</a></li>
                                <li><a href="#payouts" className="hover:text-white transition-colors">FASTag Recharge</a></li>
                                <li><a href="#identity" className="hover:text-white transition-colors">PAN Card Services</a></li>
                                <li><a href="#identity" className="hover:text-white transition-colors">ITR Filing</a></li>
                                <li><a href="#identity" className="hover:text-white transition-colors">Lead Generation</a></li>
                            </ul>
                        </div>

                        {/* Column 4: Official Contact */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Official Contact</h4>
                            <ul className="space-y-3 text-xs text-slate-400 font-medium">
                                <li className="flex items-center gap-2.5">
                                    <Phone className="h-4 w-4 text-[#a3e635] shrink-0" />
                                    <a href="tel:03368200828" className="hover:text-white transition-colors font-bold">033 68200828</a>
                                </li>
                                <li className="flex items-center gap-2.5">
                                    <Mail className="h-4 w-4 text-[#a3e635] shrink-0" />
                                    <a href="mailto:shahparpay@gmail.com" className="hover:text-white transition-colors">shahparpay@gmail.com</a>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <MapPin className="h-4 w-4 text-[#a3e635] shrink-0 mt-0.5" />
                                    <span>4/1 Victoria Lane, Telinipara, Bhadreswar, Hooghly, West Bengal - 712125</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* GIANT FULL-WIDTH BRAND LOGO BANNER (MATCHING CASHFREE FOOTER SCREENSHOT) */}
                    <div className="w-full pt-12 sm:pt-16 pb-8 border-t border-slate-800/80 my-8 sm:my-12 flex items-center justify-center overflow-hidden">
                        <div className="w-full flex items-center justify-center gap-2 sm:gap-4 md:gap-2 select-none group cursor-pointer">
                            {/* <img
                                src={whiteLogo}
                                alt="Shahparpay"
                                className="h-[8.5vw] max-h-40 min-h-10 w-auto object-contain transition-transform group-hover:scale-105 duration-300 shrink-0"
                            /> */}
                            <h2 className="text-[11.5vw] sm:text-[13vw] xl:text-[13.5vw] font-black text-white tracking-tighter leading-none text-center transition-colors group-hover:text-[#ccf788] whitespace-nowrap">
                                Shahparpay
                            </h2>
                        </div>
                    </div>

                    {/* BOTTOM BAR WITH SOCIAL ICONS AND COPYRIGHT */}
                    <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400 font-medium">
                        {/* Social Links Row */}
                        <div className="flex items-center gap-3">
                            <a href="#contact" aria-label="WhatsApp Support" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                                <MessageCircle className="w-4 h-4" />
                            </a>
                            <a href="#contact" aria-label="Email Support" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                                <Mail className="w-4 h-4" />
                            </a>
                            <a href="#contact" aria-label="Official Phone" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                                <Phone className="w-4 h-4" />
                            </a>
                            <a href="#contact" aria-label="Location" className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-[#008c46] hover:text-white text-slate-300 transition-all flex items-center justify-center">
                                <Globe className="w-4 h-4" />
                            </a>
                        </div>

                        {/* Copyright & Legal Links */}
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-6 text-slate-400 text-xs font-semibold">
                            <a href="#top" className="hover:text-white transition-colors">Term</a>
                            <span>•</span>
                            <span>© {new Date().getFullYear()} Shahparpay Solutions Private Limited</span>
                            <span>•</span>
                            <a href="#top" className="hover:text-white transition-colors">Privacy</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
