import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import '../../pages/landing.css';
import LandingNav from './LandingNav';
import LandingFooter from './LandingFooter';
import { WRAP } from './ui';

/** Every legal document, in the order a retailer meets them. */
const DOCS = [
    { to: '/terms', label: 'Terms and conditions' },
    { to: '/retailer-terms', label: 'Retailer terms' },
    { to: '/aeps-terms', label: 'AEPS terms' },
    { to: '/aeps-permission', label: 'AEPS declaration' },
    { to: '/refund-policy', label: 'Refund policy' },
    { to: '/privacy-policy', label: 'Privacy policy' },
];

/**
 * The shell every legal page shares: a plain document header, the list of
 * documents beside the text, and a way to reach the grievance desk. The page
 * supplies the document itself; its wording is the legal record and is not
 * edited here.
 */
export default function LegalLayout({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
    const { pathname } = useLocation();
    return (
        <div className="landing-page relative overflow-x-clip">
            <LandingNav />

            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} py-12 sm:py-16`}>
                    <p className="lp-eyebrow">{eyebrow}</p>
                    <h1 className="lp-serif mt-3 max-w-4xl text-balance text-[44px] leading-[1.02] text-[var(--lp-fg)] sm:text-[60px]">{title}</h1>
                    {lead && <p className="mt-5 max-w-3xl text-base leading-relaxed text-[var(--lp-fg-2)] sm:text-lg">{lead}</p>}
                </div>
            </header>

            <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-10 py-12 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16`}>
                <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                    <p className="text-sm text-[var(--lp-muted)]">Legal documents</p>
                    <nav aria-label="Legal documents" className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                        {DOCS.map((d) => {
                            const on = pathname === d.to;
                            return (
                                <Link
                                    key={d.to}
                                    to={d.to}
                                    aria-current={on ? 'page' : undefined}
                                    className={`flex h-10 flex-none items-center whitespace-nowrap rounded-lg px-3 text-[15px] transition-colors ${
                                        on ? 'bg-[var(--lp-surface)] text-[var(--lp-fg)]' : 'text-[var(--lp-fg-2)] hover:text-[var(--lp-fg)]'
                                    }`}
                                >
                                    {d.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="mt-8 hidden border-t border-[var(--lp-border)] pt-6 text-sm lg:block">
                        <p className="text-[var(--lp-muted)]">Questions or a grievance</p>
                        <a href="mailto:shahparpay@gmail.com" className="mt-3 flex items-center gap-2 text-[var(--lp-fg-2)] hover:text-[var(--lp-fg)]">
                            <Mail aria-hidden strokeWidth={1.5} className="size-4 text-[var(--lp-muted)]" /> shahparpay@gmail.com
                        </a>
                        <a href="tel:+918240039776" className="mt-2 flex items-center gap-2 text-[var(--lp-fg-2)] hover:text-[var(--lp-fg)]">
                            <Phone aria-hidden strokeWidth={1.5} className="size-4 text-[var(--lp-muted)]" /> <span className="lp-figure">+91 8240039776</span>
                        </a>
                    </div>
                </aside>

                <main className="lp-doc min-w-0 max-w-4xl space-y-8">{children}</main>
            </div>

            <LandingFooter />
        </div>
    );
}
