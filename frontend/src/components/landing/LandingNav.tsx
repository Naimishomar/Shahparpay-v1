import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    X,
    Banknote,
    Building,
    ChevronDown,
    CreditCard,
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
    Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import '../../pages/landing.css';
import { WRAP } from './ui';

const PRODUCT_MENU_CATEGORIES = [
    {
        title: 'Banking services',
        items: [
            { title: 'AEPS Cash Withdrawal', desc: 'Aadhaar and fingerprint, no card needed', icon: Fingerprint },
            { title: 'Balance & Mini Statement', desc: 'Instant account balance for any customer', icon: FileText },
            { title: 'Micro ATM', desc: 'Debit card withdrawal at your counter', icon: CreditCard },
            { title: 'Money Transfer (DMT)', desc: 'Cash in hand to any bank account', icon: Send },
            { title: 'UPI QR Collection', desc: 'Your own QR, money lands in your wallet', icon: QrCode },
            { title: 'Aadhaar Pay', desc: 'Customers pay you by fingerprint', icon: Shield },
            { title: 'Daily Settlement', desc: 'Move earnings to your bank account', icon: Zap },
            { title: 'Payout to Bank', desc: 'Send money out 24x7, including holidays', icon: Banknote },
        ],
    },
    {
        title: 'Bills and recharge',
        items: [
            { title: 'Mobile & DTH Recharge', desc: 'Every prepaid operator and DTH provider', icon: RefreshCw },
            { title: 'BBPS Bill Payments', desc: 'Electricity, water, gas, broadband, LPG', icon: Receipt },
            { title: 'FASTag Recharge', desc: 'Top up FASTag for walk-in customers', icon: Zap },
            { title: 'Insurance Premium', desc: 'Collect LIC and general insurance premiums', icon: ShieldCheck },
            { title: 'Credit Card Bills', desc: 'Pay any bank credit card bill over BBPS', icon: CreditCard },
        ],
    },
    {
        title: 'Documents and earnings',
        items: [
            { title: 'PAN Card Services', desc: 'New PAN, corrections and reprints', icon: FileText },
            { title: 'ITR Filing', desc: 'File income tax returns for your customers', icon: FileCode },
            { title: 'Lead Generation', desc: 'Earn on loan and insurance referrals', icon: Building },
            { title: 'Wallet & Reports', desc: 'Every transaction and commission, itemised', icon: Layers },
        ],
    },
];

const NAV_LINKS = [
    { to: '/commission', label: 'Commission' },
    { to: '/contact', label: 'Contact us' },
    { to: '/about', label: 'About us' },
];

const LINK = 'rounded-lg px-3 py-2 text-[15px] text-[var(--lp-fg-2)] transition-colors hover:text-[var(--lp-fg)]';

/**
 * The public site's top bar. Shared by every public page so the landing page and
 * the contact page cannot drift apart. It owns its own menu state, so a page
 * only has to render it.
 */
const LandingNav: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [productsOpen, setProductsOpen] = useState(false);
    const { token } = useAuth();

    // Every service in the menu opens the app. Signed in, "/" hands off to the
    // dashboard (see LandingRoute); signed out, there is nothing to show them,
    // so they go straight to the login screen.
    const appHref = token ? '/' : '/login';

    return (
        <nav className="sticky top-0 z-50 border-b border-[var(--lp-border)] bg-[var(--lp-bg)]">
            <div className={`${WRAP} flex h-16 items-center justify-between gap-6`}>
                <Link to="/" aria-label="Shahparpay home" className="shrink-0">
                    <img src={logo} alt="Shahparpay" className="h-8 w-auto object-contain sm:h-9" />
                </Link>

                <div className="hidden items-center gap-1 lg:flex">
                    <div className="relative" onMouseEnter={() => setProductsOpen(true)} onMouseLeave={() => setProductsOpen(false)}>
                        <button
                            type="button"
                            aria-expanded={productsOpen}
                            onClick={() => setProductsOpen((o) => !o)}
                            className={`${LINK} inline-flex items-center gap-1`}
                        >
                            Products
                            <ChevronDown aria-hidden strokeWidth={1.5} className={`size-4 transition-transform duration-150 ${productsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {productsOpen && (
                            <div className="mega-menu-content absolute left-1/2 top-full z-50 w-[760px] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2">
                                <div className="grid grid-cols-3 gap-6 rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)] p-5 shadow-[var(--lp-shadow-md)]">
                                    {PRODUCT_MENU_CATEGORIES.map((cat) => (
                                        <div key={cat.title}>
                                            <p className="px-2 pb-2 text-sm text-[var(--lp-muted)]">{cat.title}</p>
                                            <div className="space-y-0.5">
                                                {cat.items.map((item) => (
                                                    <Link key={item.title} to={appHref} onClick={() => setProductsOpen(false)} className="mega-menu-item-link">
                                                        <item.icon aria-hidden strokeWidth={1.5} className="mega-icon mt-0.5 size-4 shrink-0 text-[var(--lp-muted)]" />
                                                        <div>
                                                            <div className="text-sm text-[var(--lp-fg)]">{item.title}</div>
                                                            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--lp-muted)]">{item.desc}</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {NAV_LINKS.map((l) => (
                        <Link key={l.to} to={l.to} className={LINK}>{l.label}</Link>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <Link to="/login" className="lp-btn-primary inline-flex h-10 items-center px-4 text-sm">
                        Sign in
                    </Link>
                    <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-lg text-[var(--lp-fg)] transition-colors hover:bg-[var(--lp-surface)] lg:hidden"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                    >
                        {menuOpen ? <X aria-hidden strokeWidth={1.5} className="size-5" /> : <Menu aria-hidden strokeWidth={1.5} className="size-5" />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="mega-menu-content border-t border-[var(--lp-border)] bg-[var(--lp-bg)] px-4 py-4 sm:px-6 lg:hidden">
                    {[{ to: appHref, label: 'Products and services' }, ...NAV_LINKS].map((l) => (
                        <Link
                            key={l.label}
                            to={l.to}
                            onClick={() => setMenuOpen(false)}
                            className="flex h-12 items-center border-b border-[var(--lp-border)] text-base text-[var(--lp-fg)] last:border-0"
                        >
                            {l.label}
                        </Link>
                    ))}
                </div>
            )}
        </nav>
    );
};

export default LandingNav;
