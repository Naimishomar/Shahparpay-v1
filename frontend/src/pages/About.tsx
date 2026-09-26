import React from 'react';
import { Link } from 'react-router-dom';
import {
    Award,
    Banknote,
    Building2,
    CheckCircle2,
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
    QrCode,
    Receipt,
    RefreshCw,
    Send,
    Shield,
    ShieldCheck,
    Sparkles,
    Users,
    Zap,
} from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import './landing.css';

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

const About: React.FC = () => {
    return (
        <div className="landing-page relative overflow-x-clip bg-white text-slate-900 font-sans">
            <LandingNav />

            {/* ------------------------------------------------------------- HERO HEADER */}
            <section className="relative w-full border-b border-slate-100 bg-gradient-to-b from-[#f7fee7]/80 via-[#ecfccb]/30 to-white px-4 sm:px-6 py-14 sm:py-20">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 sm:px-4 py-1.5 rounded-full text-[0.7rem] sm:text-xs font-bold mb-4 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-[#008c46]" />
                        <span>Shahparpay Solutions Private Limited</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                        Empowering Retailers with <span className="text-[#008c46]">Next-Gen Fintech</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-lg text-slate-600 font-medium leading-relaxed max-w-3xl mx-auto">
                        At Shahparpay Solutions Pvt Ltd, we empower retailers, distributors, and businesses with robust,
                        secure, and scalable fintech solutions. Our platform offers a comprehensive suite of banking,
                        recharge, bill payment, tax, and loan services — all through one seamless, user-friendly dashboard.
                    </p>
                </div>
            </section>

            {/* ------------------------------------------------------------- MISSION & VISION */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-7xl space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center mb-5">
                                <Users className="h-6 w-6 text-[#008c46]" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Our Mission</h2>
                            <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                                With a vision to bridge the digital gap and enable financial inclusion across India, we are
                                committed to delivering instant transactions, transparent reporting, and dedicated support.
                                Whether you're a local store owner or a large distributor, Shahparpay Solutions Pvt Ltd helps you
                                serve your customers better and earn more on every transaction.
                            </p>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center mb-5">
                                <Award className="h-6 w-6 text-[#008c46]" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Our Platform</h2>
                            <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                                Shahparpay Solutions Private Limited is registered under Ministry of Electronics &amp; Information
                                Technology guidelines and compliant with RBI PPI and NPCI payment security standards. Join thousands of
                                trusted partners and grow your digital service business with us.
                            </p>
                        </div>
                    </div>

                    {/* VERBATIM DOCUMENT COPY CARD */}
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <FileText className="w-5 h-5 text-[#008c46]" />
                            <h3 className="text-lg font-extrabold text-slate-900">Official Document Record (ABOUT US SHAHPARPAY)</h3>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 font-mono">
                            <p className="font-bold text-slate-900">About Us</p>
                            <p>
                                At Shahparpay Solutions Pvt Ltd, we empower retailers, distributors, and businesses with robust, secure, and scalable fintech solutions. Our platform offers a comprehensive suite of services including AEPS (Aadhaar Enabled Payment System), Cash Withdrawal, Cash deposit, Micro ATM Service, Domestic Money Transfer (DMT), Mobile &amp; DTH Recharge, and BBPS (Bharat Bill Payment System), PAN Card Service, Account opening service, Credit Card Lead Generation, Loan Lead Generation, Income tax Returns Filing, GST Registration and GST Filing, FSSAI License Service, — all through a user-friendly dashboard.
                            </p>
                            <p>
                                With a vision to bridge the digital gap and enable financial inclusion across India, we are committed to delivering instant transactions, transparent reporting, and 24/7 support. Whether you're a local store owner or a large distributor, Shahparpay Solutions Pvt Ltd helps you serve your customers better and earn more on every transaction.
                            </p>
                            <p>
                                Join thousands of trusted partners and grow your digital service business with us.
                            </p>
                        </div>
                    </div>

                    {/* CORE VALUES */}
                    <div>
                        <div className="text-center max-w-2xl mx-auto mb-10">
                            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                                Why Partner With <span className="text-[#008c46]">Shahparpay</span>
                            </h2>
                            <p className="mt-2 text-slate-600 text-sm">
                                Built for trust, speed, and real earnings for every shop owner.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {VALUES.map((val) => (
                                <div key={val.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center mb-4">
                                        <val.icon className="h-5 w-5 text-[#008c46]" />
                                    </div>
                                    <h3 className="text-base font-extrabold text-slate-900">{val.title}</h3>
                                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">{val.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------------------- PRODUCTS & SERVICES GRID */}
            <section className="w-full bg-white px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 py-1.5 rounded-full text-xs font-bold mb-3">
                            <Layers className="w-3.5 h-3.5 text-[#008c46]" />
                            <span>Complete Product &amp; Service Portfolio</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                            Everything You Can Offer <span className="text-[#008c46]">At Your Counter</span>
                        </h2>
                        <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                            Turn your retail store into a complete digital banking and financial services hub.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SERVICES_LIST.map((srv) => (
                            <div key={srv.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center">
                                            <srv.icon className="h-5 w-5 text-[#008c46]" />
                                        </div>
                                        <span className="text-[0.65rem] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                            {srv.badge}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-extrabold text-slate-900">{srv.title}</h3>
                                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{srv.desc}</p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[0.72rem] font-bold text-[#008c46]">
                                    <span>{srv.price}</span>
                                    <span className="text-slate-400">#{srv.id}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------------------- SUPPORT & DIRECT CONTACT */}
            <section className="w-full bg-[#f8fafc] px-4 sm:px-6 py-14 sm:py-20 border-b border-slate-100">
                <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-7 space-y-6">
                        <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#008c46] border border-[#bbf7d0] px-3.5 py-1.5 rounded-full text-xs font-bold">
                            <Headset className="w-3.5 h-3.5 text-[#008c46]" />
                            <span>Partner / Retailer Support Facility</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            We Are Here To <span className="text-[#008c46]">Support Your Business</span>
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                            Our dedicated support team is available Monday to Saturday (9:00 AM to 10:00 PM) for operational guidance,
                            transaction queries, and instant resolution.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-start gap-3">
                                <Phone className="h-5 w-5 text-[#008c46] shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase">Support Care Line</div>
                                    <a href="tel:+918240039776" className="text-sm font-extrabold text-slate-900 hover:text-[#008c46]">+91 8240039776</a>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-start gap-3">
                                <Mail className="h-5 w-5 text-[#008c46] shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase">Support Email</div>
                                    <a href="mailto:shahparpay@gmail.com" className="text-sm font-extrabold text-slate-900 hover:text-[#008c46]">shahparpay@gmail.com</a>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 pt-2">
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2.5 bg-[#18181b] hover:bg-black text-white font-bold pl-6 pr-2 py-2.5 rounded-full text-sm shadow-md transition-all hover:scale-[1.01] group"
                            >
                                <span>Get Started Now</span>
                                <span className="w-7 h-7 rounded-full bg-[#a3e635] text-black flex items-center justify-center font-black text-sm group-hover:rotate-45 transition-transform">
                                    ↗
                                </span>
                            </Link>

                            <Link
                                to="/contact"
                                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 font-bold px-6 py-2.5 rounded-full text-sm border border-slate-300 shadow-xs transition-colors"
                            >
                                <span>Contact Us</span>
                            </Link>
                        </div>
                    </div>

                    <div className="lg:col-span-5 rounded-[28px] bg-[#00381e] text-white p-6 sm:p-8 shadow-xl border border-emerald-800/60">
                        <h3 className="text-xl font-extrabold text-white">Head Office Address</h3>
                        <p className="mt-2 text-xs text-emerald-200">Registered Office &amp; Jurisdiction</p>

                        <div className="mt-6 space-y-4 text-xs text-emerald-50 leading-relaxed">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-[#a3e635] shrink-0 mt-0.5" />
                                <span>
                                    <strong>Shahparpay Solutions Private Limited</strong><br />
                                    4/1 Victoria Lane, Telinipara, Bhadreswar,<br />
                                    Hooghly, West Bengal - 712125
                                </span>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t border-emerald-800/80">
                                <Shield className="h-4 w-4 text-[#a3e635] shrink-0" />
                                <span>Dispute Jurisdiction Area: Kolkata High Court</span>
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
