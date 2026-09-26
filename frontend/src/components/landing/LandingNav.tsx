import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    X,
    Banknote,
    Building,
    ChevronDown,
    Code2,
    CreditCard,
    ExternalLink,
    FileCode,
    FileText,
    Fingerprint,
    Layers,
    Menu,
    QrCode,
    Receipt,
    RefreshCw,
    Send,
    Shield,
    ShieldCheck,
    Terminal,
    Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import '../../pages/landing.css';

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
        icon: Code2,
        link: '/about'
    },
    {
        title: 'Commission Rates',
        desc: 'What you earn on every service',
        icon: Terminal,
        link: '/commission'
    },
    {
        title: 'Guides & Training',
        desc: 'Step-by-step help for each service',
        icon: FileCode,
        link: '/contact'
    },
    {
        title: 'Device Support',
        desc: 'Supported fingerprint scanners and Micro ATMs',
        icon: ExternalLink,
        link: '/contact'
    }
];

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

/**
 * The public site's top bar. Shared by every public page so the landing page and
 * the contact page cannot drift apart. It owns its own menu and scroll state, so
 * a page only has to render it.
 */
const LandingNav: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<'products' | 'developers' | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const { token } = useAuth();

    // Every service in the menu opens the app. Signed in, "/" hands off to the
    // dashboard (see LandingRoute); signed out, there is nothing to show them,
    // so they go straight to the login screen.
    const appHref = token ? '/' : '/login';

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
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
            <div className="hidden items-center gap-2 xl:flex">
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
                        <div className="absolute left-0 top-full pt-2 w-[920px] max-w-[calc(100vw-2rem)] -translate-x-16 z-50 mega-menu-content">
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl grid grid-cols-12 gap-6">
                                <div className="col-span-8 grid grid-cols-3 gap-6">
                                    {PRODUCT_MENU_CATEGORIES.map((cat) => (
                                        <div key={cat.title} className="space-y-3">
                                            <h4 className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                                                {cat.title}
                                            </h4>
                                            <div className="space-y-1">
                                                {cat.items.map((item) => (
                                                    <Link
                                                        key={item.title}
                                                        to={appHref}
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
                                                    </Link>
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
                                        <Link
                                            key={card.title}
                                            to={appHref}
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
                                        </Link>
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
                        <div className="absolute left-0 top-full pt-2 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-16 z-50 mega-menu-content">
                            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xl space-y-3">
                                <div className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 pb-2">
                                    HELP &amp; RESOURCES
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {RESOURCE_MENU_ITEMS.map((item) => (
                                        <Link
                                            key={item.title}
                                            to={item.link}
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
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <Link to="/commission" className="text-slate-600 hover:text-black rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                    Commission
                </Link>
                <Link to="/contact" className="text-slate-600 hover:text-black rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                    Contact Us
                </Link>
                <Link to="/about" className="text-slate-600 hover:text-black rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors">
                    About Us
                </Link>
            </div>

            {/* Right Side Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
                <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 sm:gap-2.5 bg-[#18181b] hover:bg-black text-white rounded-full pl-4 sm:pl-5 pr-1.5 sm:pr-2 py-1.5 sm:py-2 text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-[1.01] group"
                >
                    <span>Sign In</span>
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#a3e635] text-black flex items-center justify-center font-black text-[0.6rem] sm:text-xs group-hover:rotate-45 transition-transform">
                        ↗
                    </span>
                </Link>

                <button
                    className="xl:hidden p-2 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                >
                    {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
            <div className="border-t border-slate-200 px-6 py-6 xl:hidden space-y-5 shadow-2xl bg-white animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Navigation</p>
                    <Link to={appHref} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                        Products &amp; Services
                    </Link>
                    <Link to="/contact" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                        Contact Us
                    </Link>
                    <Link to="/commission" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                        Commission Rates
                    </Link>
                    <Link to="/about" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                        About Us
                    </Link>
                    <Link to="/contact" onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm font-bold text-slate-900 border-b border-slate-100">
                        Contact &amp; Details
                    </Link>
                </div>
                <div className="pt-2 flex flex-col gap-2.5">
                    <Link
                        to="/login"
                        onClick={() => setMenuOpen(false)}
                        className="inline-flex items-center justify-center gap-2.5 bg-[#18181b] hover:bg-black text-white py-2.5 rounded-full text-sm font-bold shadow-md transition-all group"
                    >
                        <span>Sign In</span>
                        <span className="w-6 h-6 rounded-full bg-[#a3e635] text-black flex items-center justify-center font-black text-xs group-hover:rotate-45 transition-transform">
                            ↗
                        </span>
                    </Link>
                </div>
            </div>
        )}
    </nav>
    );
};

export default LandingNav;
