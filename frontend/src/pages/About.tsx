import React from 'react';
import { Link } from 'react-router-dom';
import {
    Banknote,
    Building2,
    CreditCard,
    FileCode,
    FileText,
    Fingerprint,
    Headset,
    Layers,
    Lock,
    Mail,
    MapPin,
    Phone,
    Receipt,
    Scale,
    Send,
    ShieldCheck,
    Users,
    Zap,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, H1, H2, LEAD, SECTION, WRAP } from '@/components/landing/ui';
import './landing.css';

/** Only a badge that states availability is shown; the rest were marketing labels. */
const STATUS_BADGES = new Set(['Coming Soon', 'Upcoming']);

const SERVICES_LIST = [
    {
        id: '01',
        title: 'PAN Card Services',
        desc: 'New PAN card applications (NSDL), corrections and reprints on the portal. Free for registered partners and retailers.',
        price: 'Actual Cost: ₹500 + GST (Free for Retailers)',
        icon: FileText,
        badge: 'Live',
    },
    {
        id: '02',
        title: 'AEPS Cash Withdrawal',
        desc: 'Aadhaar Enabled Payment System allowing instant cash withdrawals via fingerprint verification for any Indian bank customer.',
        price: 'Actual Cost: ₹500 + GST (Free for Retailers)',
        icon: Fingerprint,
        badge: 'High Volume',
    },
    {
        id: '03',
        title: 'AEPS Cash Deposit',
        desc: 'Aadhaar Enabled Payment System cash deposit through customer biometric self-account verification.',
        price: 'Actual Cost: ₹500 + GST (Coming Soon)',
        icon: Banknote,
        badge: 'Coming Soon',
    },
    {
        id: '04',
        title: 'Micro ATM Service',
        desc: 'Debit card cash withdrawal using portable Micro-ATM device at retailer counters.',
        price: 'Actual Cost: ₹500 + GST (Free for Retailers)',
        icon: CreditCard,
        badge: 'Live',
    },
    {
        id: '05',
        title: 'Domestic Money Transfer (DMT)',
        desc: 'Instant 24x7 fund transfers to any bank account across India with instant wallet ledger updates.',
        price: 'Actual Cost: ₹500 + GST (Free for Retailers)',
        icon: Send,
        badge: 'Popular',
    },
    {
        id: '06',
        title: 'Courier Services Facilities',
        desc: 'Integrated parcel dispatch and courier booking facility directly from retailer shop portals.',
        price: 'Actual Cost: ₹500 + GST (Live Very Soon)',
        icon: Layers,
        badge: 'Upcoming',
    },
    {
        id: '07',
        title: 'Digital Savings & Current Accounts',
        desc: 'Zero Balance account opening for Airtel Payments Bank & Kotak 811 (₹2,500 Funding) digital accounts.',
        price: 'Actual Cost: ₹1000 + GST (Free for Retailers)',
        icon: Building2,
        badge: 'Digital Accounts',
    },
    {
        id: '08',
        title: 'BBPS & Mobile / DTH Recharges',
        desc: 'Bharat Bill Payment System covering electricity, water, gas, broadband, FASTag, LIC, and prepaid recharges.',
        price: 'Free of Cost for Partners/Retailers',
        icon: Receipt,
        badge: 'BBPS Certified',
    },
    {
        id: '09',
        title: 'Merchant Onboarding & e-KYC',
        desc: 'Complete merchant onboarding and full biometric e-KYC with bank account verification charge of ₹10 only.',
        price: '₹10 Only',
        icon: ShieldCheck,
        badge: 'Instant KYC',
    },
    {
        id: '10',
        title: 'Loan Lead Generation',
        desc: 'Instant lead generation for Personal Loans, Instant Loans, and Business Loans with attractive payouts.',
        price: 'Actual Cost: ₹1000+ (Free for Retailers)',
        icon: Zap,
        badge: 'High Commission',
    },
    {
        id: '11',
        title: 'Credit Card Lead Generation',
        desc: 'Apply for Bajaj Credit Cards and Lifetime Free credit cards for walk-in customers.',
        price: 'Actual Cost: ₹1000+ (Free for Retailers)',
        icon: CreditCard,
        badge: 'Lead Payouts',
    },
    {
        id: '12',
        title: 'Taxation & Regulatory Services',
        desc: 'ITR Registration & Filing, GST Registration & Filing, PF, ESI, FSSAI License, IEC Registration, e-Way Bill.',
        price: 'Actual Cost: ₹5000+ (Free / Discounted)',
        icon: FileCode,
        badge: 'CA & Tax Suite',
    },
];

const VALUES = [
    {
        icon: ShieldCheck,
        title: 'Financial Inclusion',
        desc: 'Bringing banking, digital payments, and financial credit access to every corner of India, empowering rural and semi-urban shopkeepers.',
    },
    {
        icon: Zap,
        title: 'Instant Wallet Settlement',
        desc: 'Every transaction earnings and commission are credited instantly to your wallet with zero hidden deductions or monthly targets.',
    },
    {
        icon: Lock,
        title: 'Bank-Grade Security',
        desc: 'Built on licensed NPCI and banking partner rails with 256-bit SSL encryption, strict biometric validation, and zero biometric storage.',
    },
    {
        icon: Headset,
        title: 'Dedicated Retailer Support',
        desc: 'Human support care available Monday to Saturday (9:00 AM to 10:00 PM) plus 24x7 WhatsApp assistance.',
    },
];

const ICON = 'size-[18px] shrink-0 text-[var(--lp-muted)]';

const About: React.FC = () => {
    return (
        <div className="landing-page relative overflow-x-clip">
            <LandingNav />

            <header className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} py-16 sm:py-24`}>
                    <p className="lp-eyebrow">Shahparpay Solutions Private Limited</p>
                    <h1 className={`${H1} mt-3 max-w-3xl`}>Banking, bills and document services for every shop counter</h1>
                    <p className={`${LEAD} mt-5 max-w-3xl`}>
                        At Shahparpay Solutions Pvt Ltd, we equip retailers, distributors and businesses with banking,
                        recharge, bill payment, tax and loan services — all through one dashboard.
                    </p>
                </div>
            </header>

            {/* Mission, platform and the official record */}
            <section className={`${SECTION} lp-band`}>
                <div className={`${WRAP} space-y-4`}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className={`${CARD} p-6 sm:p-8`}>
                            <Users aria-hidden strokeWidth={1.5} className={ICON} />
                            <h2 className="mt-5 text-xl font-medium text-[var(--lp-fg)]">Our mission</h2>
                            <p className={`${BODY} mt-3`}>
                                With a vision to bridge the digital gap and enable financial inclusion across India, we are
                                committed to delivering instant transactions, transparent reporting, and dedicated support.
                                Whether you're a local store owner or a large distributor, Shahparpay Solutions Pvt Ltd helps you
                                serve your customers better and earn more on every transaction.
                            </p>
                        </div>
                        <div className={`${CARD} p-6 sm:p-8`}>
                            <ShieldCheck aria-hidden strokeWidth={1.5} className={ICON} />
                            <h2 className="mt-5 text-xl font-medium text-[var(--lp-fg)]">Our platform</h2>
                            <p className={`${BODY} mt-3`}>
                                Join thousands of trusted partners and grow your digital service business with us.
                            </p>
                        </div>
                    </div>

                    {/* Kept word for word: the company's official About Us record. */}
                    <div className={`${CARD} p-6 sm:p-8`}>
                        <div className="flex items-center gap-2">
                            <FileText aria-hidden strokeWidth={1.5} className={ICON} />
                            <h2 className="text-lg font-medium text-[var(--lp-fg)]">Official document record</h2>
                        </div>
                        <hr className="lp-tear my-5" />
                        <div className={`${BODY} max-w-4xl space-y-3`}>
                            <p className="text-[var(--lp-fg)]">About Us</p>
                            <p>
                                At Shahparpay Solutions Pvt Ltd, we empower retailers, distributors, and businesses with robust, secure, and scalable fintech solutions. Our platform offers a comprehensive suite of services including AEPS (Aadhaar Enabled Payment System), Cash Withdrawal, Cash deposit, Micro ATM Service, Domestic Money Transfer (DMT), Mobile &amp; DTH Recharge, and BBPS (Bharat Bill Payment System), PAN Card Service, Account opening service, Credit Card Lead Generation, Loan Lead Generation, Income tax Returns Filing, GST Registration and GST Filing, FSSAI License Service, — all through a user-friendly dashboard.
                            </p>
                            <p>
                                With a vision to bridge the digital gap and enable financial inclusion across India, we are committed to delivering instant transactions, transparent reporting, and 24/7 support. Whether you're a local store owner or a large distributor, Shahparpay Solutions Pvt Ltd helps you serve your customers better and earn more on every transaction.
                            </p>
                            <p>Join thousands of trusted partners and grow your digital service business with us.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className={SECTION}>
                <div className={WRAP}>
                    <h2 className={H2}>Why partner with Shahparpay</h2>
                    <p className={`${LEAD} mt-4`}>Built for trust, speed, and real earnings for every shop owner.</p>
                    <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                        {VALUES.map((val) => (
                            <div key={val.title} className="border-t border-[var(--lp-border-strong)] pt-5">
                                <val.icon aria-hidden strokeWidth={1.5} className={ICON} />
                                <h3 className="mt-4 text-base font-medium text-[var(--lp-fg)]">{val.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-fg-2)]">{val.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Products and services */}
            <section className={`${SECTION} lp-band`}>
                <div className={WRAP}>
                    <p className="lp-eyebrow">Complete product and service portfolio</p>
                    <h2 className={`${H2} mt-3`}>Everything you can offer at your counter</h2>
                    <p className={`${LEAD} mt-4`}>Turn your retail store into a complete digital banking and financial services hub.</p>

                    <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {SERVICES_LIST.map((srv) => (
                            <div key={srv.id} className={`${CARD} flex flex-col p-6`}>
                                <div className="flex items-center justify-between">
                                    <srv.icon aria-hidden strokeWidth={1.5} className={ICON} />
                                    <span className="lp-figure text-xs text-[var(--lp-muted)]">{srv.id}</span>
                                </div>
                                <h3 className="mt-5 text-lg font-medium text-[var(--lp-fg)]">{srv.title}</h3>
                                {STATUS_BADGES.has(srv.badge) && <p className="mt-1 text-sm text-[var(--lp-accent-ink)]">{srv.badge}</p>}
                                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-fg-2)]">{srv.desc}</p>
                                <hr className="lp-tear mb-4 mt-auto pt-5" />
                                <p className="text-sm text-[var(--lp-fg)]">{srv.price}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Support and head office */}
            <section className={SECTION}>
                <div className={`${WRAP} grid grid-cols-1 items-center gap-12 lg:grid-cols-12`}>
                    <div className="lg:col-span-7">
                        <p className="lp-eyebrow">Partner and retailer support</p>
                        <h2 className={`${H2} mt-3`}>We are here to support your business</h2>
                        <p className={`${LEAD} mt-4`}>
                            Our dedicated support team is available Monday to Saturday (9:00 AM to 10:00 PM) for operational guidance,
                            transaction queries, and instant resolution.
                        </p>

                        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className={`${CARD} flex items-start gap-3 p-5`}>
                                <Phone aria-hidden strokeWidth={1.5} className={`${ICON} mt-0.5`} />
                                <div>
                                    <p className="text-sm text-[var(--lp-muted)]">Support care line</p>
                                    <a href="tel:+918240039776" className="lp-figure text-[15px] text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">+91 8240039776</a>
                                </div>
                            </div>
                            <div className={`${CARD} flex items-start gap-3 p-5`}>
                                <Mail aria-hidden strokeWidth={1.5} className={`${ICON} mt-0.5`} />
                                <div>
                                    <p className="text-sm text-[var(--lp-muted)]">Support email</p>
                                    <a href="mailto:shahparpay@gmail.com" className="text-[15px] text-[var(--lp-fg)] hover:text-[var(--lp-accent-ink)]">shahparpay@gmail.com</a>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/login" className={BTN_PRIMARY}>Get started</Link>
                            <Link to="/contact" className={BTN_SECONDARY}>Contact us</Link>
                        </div>
                    </div>

                    <div className={`${CARD} p-6 sm:p-8 lg:col-span-5`}>
                        <h3 className="text-lg font-medium text-[var(--lp-fg)]">Head office address</h3>
                        <p className="mt-1 text-sm text-[var(--lp-muted)]">Registered office and jurisdiction</p>
                        <hr className="lp-tear my-5" />
                        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
                            <div className="flex items-start gap-3">
                                <MapPin aria-hidden strokeWidth={1.5} className={`${ICON} mt-1`} />
                                <span>
                                    <span className="text-[var(--lp-fg)]">Shahparpay Solutions Private Limited</span><br />
                                    4/1 Victoria Lane, Telinipara, Bhadreswar,<br />
                                    Hooghly, West Bengal - 712125
                                </span>
                            </div>
                            <div className="flex items-start gap-3">
                                <Scale aria-hidden strokeWidth={1.5} className={`${ICON} mt-1`} />
                                <span>Dispute jurisdiction area: Kolkata High Court</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default About;
