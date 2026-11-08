import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Banknote,
    Car,
    CheckCircle2,
    CreditCard,
    Droplets,
    Fingerprint,
    Flame,
    Headset,
    HeartPulse,
    IdCard,
    Landmark,
    MessageCircle,
    Phone,
    Plus,
    Receipt,
    Send,
    ShieldCheck,
    Smartphone,
    Tv,
    Users,
    Wifi,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import './landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

/* Shared class strings, so equal things stay equal across sections. */
const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const SECTION = 'py-20 sm:py-28';
const H2 = 'text-3xl sm:text-4xl lg:text-[44px] font-medium tracking-[-0.02em] leading-[1.1] text-[var(--lp-fg)]';
const H3 = 'text-xl sm:text-2xl font-medium tracking-[-0.01em] text-[var(--lp-fg)]';
const LEAD = 'text-base sm:text-lg leading-relaxed text-[var(--lp-fg-2)]';
const BODY = 'text-[15px] leading-relaxed text-[var(--lp-fg-2)]';
const CARD = 'rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)]';
const BTN_PRIMARY = 'lp-btn-primary inline-flex h-12 items-center justify-center gap-2 px-5 text-base';
const BTN_SECONDARY = 'lp-btn-secondary inline-flex h-12 items-center justify-center gap-2 px-5 text-base';
const ROW = 'flex items-baseline justify-between gap-4';

const Icon = ({ icon: I, className = '' }: { icon: LucideIcon; className?: string }) => (
    <I aria-hidden className={`size-[18px] shrink-0 text-[var(--lp-muted)] ${className}`} strokeWidth={1.5} />
);

const START_STEPS = [
    {
        icon: Users,
        title: 'Get your retailer ID',
        text: 'Call us or meet your local distributor with your PAN, Aadhaar and shop details. We create your retailer account.',
    },
    {
        icon: Fingerprint,
        title: 'Finish KYC and connect a scanner',
        text: 'Complete e-KYC from the dashboard and plug in an RD-certified fingerprint device. Our team helps you set it up.',
    },
    {
        icon: Banknote,
        title: 'Serve customers and earn',
        text: 'Start AEPS, money transfer, recharge and bill payments. Commission lands in your wallet and settles to your bank.',
    },
];

const TRANSFER_AND_BILL_SERVICES = [
    { label: 'IMPS', icon: Send },
    { label: 'NEFT', icon: Landmark },
    { label: 'Electricity', icon: Zap },
    { label: 'Water', icon: Droplets },
    { label: 'Gas and LPG', icon: Flame },
    { label: 'Broadband', icon: Wifi },
    { label: 'Mobile', icon: Smartphone },
    { label: 'DTH', icon: Tv },
    { label: 'FASTag', icon: Car },
    { label: 'Insurance', icon: HeartPulse },
    { label: 'Card bills', icon: CreditCard },
    { label: 'Loan EMIs', icon: Receipt },
];

const SERVICES = ['AEPS', 'Micro ATM', 'DMT', 'BBPS', 'UPI', 'Recharge', 'PAN', 'ITR'];

/** The moment of the page: the slip a customer takes home after an AEPS withdrawal. */
function AepsReceipt() {
    return (
        <div className="rounded-[20px] bg-[var(--lp-surface)] p-4 sm:p-8">
            <div className="mb-4 flex items-center gap-2 px-1 text-sm text-[var(--lp-fg-2)]">
                <Icon icon={Fingerprint} />
                <span>Mantra MFS100 · fingerprint matched</span>
            </div>
            <div className="lp-receipt-wrap">
                <div className="lp-receipt rounded-t-xl px-5 pt-6 sm:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-base font-medium text-[var(--lp-fg)]">AEPS cash withdrawal</p>
                            <p className="lp-figure mt-1 text-xs text-[var(--lp-muted)]">08 Nov 2026 · 11:42 AM</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--lp-positive)]">
                            <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.5} /> Success
                        </span>
                    </div>
                    <p className="lp-figure mt-6 text-[40px] leading-none tracking-[-0.02em] text-[var(--lp-fg)]">₹2,000.00</p>
                    <hr className="lp-tear my-6" />
                    <dl className="space-y-3 text-sm">
                        {[
                            ['Customer', 'Sunita Devi'],
                            ['Aadhaar', 'XXXX XXXX 4410'],
                            ['Bank', 'State Bank of India'],
                            ['RRN', '431209876543'],
                        ].map(([k, v]) => (
                            <div key={k} className={ROW}>
                                <dt className="text-[var(--lp-muted)]">{k}</dt>
                                <dd className={`text-right text-[var(--lp-fg)] ${k === 'Customer' || k === 'Bank' ? '' : 'lp-figure'}`}>{v}</dd>
                            </div>
                        ))}
                    </dl>
                    <hr className="lp-tear my-6" />
                    <div className={ROW}>
                        <span className="text-sm text-[var(--lp-fg-2)]">Your commission</span>
                        <span className="lp-figure text-base text-[var(--lp-accent-ink)]">+₹14.00</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BillReceiptMockup() {
    return (
        <div className={`${CARD} w-full max-w-sm p-5 text-left`}>
            <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--lp-fg-2)]">Electricity bill</span>
                <span className="lp-figure text-xs text-[var(--lp-muted)]">BBPS</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <div className="lp-icon-tile"><Icon icon={Zap} /></div>
                <div>
                    <p className="text-base font-medium text-[var(--lp-fg)]">WBSEDCL</p>
                    <p className="lp-figure text-xs text-[var(--lp-muted)]">Consumer no. 1023 4567 89</p>
                </div>
            </div>
            <hr className="lp-tear my-4" />
            <dl className="space-y-2 text-sm">
                <div className={ROW}><dt className="text-[var(--lp-muted)]">Bill amount</dt><dd className="lp-figure text-[var(--lp-fg)]">₹1,186.00</dd></div>
                <div className={ROW}><dt className="text-[var(--lp-muted)]">Due date</dt><dd className="lp-figure text-[var(--lp-fg)]">18 Oct</dd></div>
            </dl>
            <hr className="lp-tear my-4" />
            <div className={`${ROW} text-sm`}>
                <span className="inline-flex items-center gap-1.5 text-[var(--lp-positive)]"><CheckCircle2 aria-hidden className="size-4" strokeWidth={1.5} /> Paid · receipt sent</span>
                <span className="lp-figure text-[var(--lp-accent-ink)]">+₹4.50</span>
            </div>
        </div>
    );
}

const RECHARGE_PLANS = [
    { price: '₹239', detail: '1.5 GB/day · 28 days' },
    { price: '₹299', detail: '2 GB/day · 28 days' },
    { price: '₹719', detail: '1.5 GB/day · 84 days' },
];

function RechargePlansMockup() {
    return (
        <div className={`${CARD} w-full max-w-sm p-5 text-left`}>
            <div className="flex items-center gap-3">
                <div className="lp-icon-tile"><Icon icon={Smartphone} /></div>
                <div>
                    <p className="lp-figure text-base text-[var(--lp-fg)]">98XXX XXX21</p>
                    <p className="text-xs text-[var(--lp-muted)]">Prepaid · West Bengal</p>
                </div>
            </div>
            <div className="mt-4 space-y-2">
                {RECHARGE_PLANS.map((plan, i) => (
                    <div
                        key={plan.price}
                        className={`flex h-14 items-center justify-between rounded-[10px] border px-3 ${i === 1 ? 'border-[var(--lp-accent)] bg-[var(--lp-accent-soft)]' : 'border-[var(--lp-border)]'}`}
                    >
                        <div>
                            <p className="lp-figure text-sm text-[var(--lp-fg)]">{plan.price}</p>
                            <p className="text-xs text-[var(--lp-muted)]">{plan.detail}</p>
                        </div>
                        {i === 1 && <span className="text-xs text-[var(--lp-accent-ink)]">Selected</span>}
                    </div>
                ))}
            </div>
            <div className="mt-4 flex h-10 items-center justify-center rounded-[10px] bg-[var(--lp-fg)] text-sm font-medium text-white">Recharge ₹299</div>
        </div>
    );
}

const LEDGER_ROWS = [
    { label: 'AEPS withdrawal', amount: '+₹12.00', credit: true },
    { label: 'Money transfer', amount: '−₹5,000.00', credit: false },
    { label: 'Recharge commission', amount: '+₹6.25', credit: true },
    { label: 'Electricity bill', amount: '−₹1,186.00', credit: false },
    { label: 'Settled to bank', amount: '−₹25,000.00', credit: false },
];

function LedgerScreen() {
    return (
        <div className="px-4 pb-6 pt-10 text-left">
            <p className="text-xs text-[var(--lp-muted)]">Wallet balance</p>
            <p className="lp-figure mt-1 text-2xl text-[var(--lp-fg)]">₹48,250.00</p>
            <p className="mt-1 text-xs text-[var(--lp-fg-2)]">
                <span className="lp-figure text-[var(--lp-accent-ink)]">+₹1,240.00</span> commission today
            </p>
            <p className="mb-2 mt-6 text-xs text-[var(--lp-muted)]">Today</p>
            <div className="divide-y divide-[var(--lp-border)] rounded-xl border border-[var(--lp-border)] bg-white">
                {LEDGER_ROWS.map((row) => (
                    <div key={row.label} className="flex h-11 items-center justify-between px-3">
                        <span className="text-xs text-[var(--lp-fg-2)]">{row.label}</span>
                        <span className={`lp-figure text-xs ${row.credit ? 'text-[var(--lp-positive)]' : 'text-[var(--lp-fg)]'}`}>{row.amount}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** A phone outline around a screen; flat, no tilt. */
const PhoneFrame = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-[36px] border border-[var(--lp-border-strong)] bg-[var(--lp-fg)] p-2 shadow-[var(--lp-shadow-lg)] ${className}`}>
        <div className="relative overflow-hidden rounded-[28px] bg-[var(--lp-bg)]">
            <div className="absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-full bg-[var(--lp-fg)]" />
            {children}
        </div>
    </div>
);

const FAQ_DATA = {
    support: [
        {
            q: 'How much can I actually earn from this?',
            a: 'You earn a commission on every transaction — AEPS withdrawals, money transfers, recharges, bill payments, PAN applications and ITR filings each carry their own rate. Your dashboard shows the exact commission on every transaction, and the full rate card is shared before you sign up.',
        },
        {
            q: 'How do I get my earnings out?',
            a: 'Commissions land in your wallet as each transaction completes. Settle to your own bank account from the dashboard whenever you like — there is no minimum holding period and no waiting for month-end.',
        },
        {
            q: "What if a transaction fails but the customer's money is debited?",
            a: 'Raise a ticket from the Support section with the transaction ID. Failed AEPS and DMT transactions are reconciled automatically against the bank, and refunds are credited back once the bank confirms. You can track the status of every dispute in your reports.',
        },
        {
            q: 'Is there someone I can call when I am stuck at the counter?',
            a: 'Yes. Call +91 8240039776 during business hours, message us on WhatsApp, or raise a ticket from inside the dashboard. Most counter issues are resolved on the same call.',
        },
        {
            q: 'Do I need to be a registered business to join?',
            a: 'No. Individual shop owners can sign up. You need your own PAN and Aadhaar, a bank account in your name, and a shop or counter where you serve customers.',
        },
        {
            q: 'Can I offer these services from more than one shop?',
            a: 'Each counter needs its own retailer login, because commissions, reports and settlements are tracked per retailer. If you run several outlets, ask about a distributor account instead — it lets you manage all of them from one place.',
        },
        {
            q: 'Is there a mobile app?',
            a: 'Yes. The Android app covers the same services as the web dashboard, so you can complete transactions and check your wallet without being at the computer.',
        },
    ],
    getting_started: [
        {
            q: 'What documents do I need to sign up?',
            a: 'Your PAN card, Aadhaar card, a cancelled cheque or bank passbook page, a photograph, and a photo of your shop. If your shop is registered, keep the GST or Udyam certificate handy as well.',
        },
        {
            q: 'How long before I can start taking transactions?',
            a: 'Basic services such as recharge and bill payments open as soon as your account is verified. AEPS takes longer because the bank runs its own Aadhaar KYC on you first — that step is done through a fingerprint scanner and is usually cleared within a working day.',
        },
        {
            q: 'Is there a joining fee?',
            a: 'Signing up is free. You only need working balance in your wallet to start transacting, and a fingerprint scanner if you plan to offer AEPS.',
        },
        {
            q: 'How do I put money into my wallet?',
            a: 'Raise a fund request to your distributor and upload the payment receipt. Approved top-ups reflect in your wallet immediately.',
        },
    ],
    integration: [
        {
            q: 'Which fingerprint scanner do I need for AEPS?',
            a: 'Any RD-service certified scanner works — Mantra MFS100, Morpho MSO 1300 E3, Startek FM220U and Evolute are the ones our retailers use most. The device must be registered and its RD service installed before your first AEPS transaction.',
        },
        {
            q: 'Can I use AEPS from my phone?',
            a: 'Yes, with an OTG-compatible scanner connected to an Android phone, using the app. Most retailers keep a laptop or desktop at the counter for higher daily volumes.',
        },
        {
            q: 'What do I need for Micro ATM?',
            a: "A Micro ATM device, which reads the customer's debit card and PIN. It is a separate device from the fingerprint scanner and is usually arranged through your distributor.",
        },
        {
            q: 'Do I need a fast internet connection?',
            a: 'An ordinary broadband or 4G connection is enough. AEPS and DMT are small requests — what matters is that the connection is steady, since a drop mid-transaction means waiting for reconciliation.',
        },
    ],
    security: [
        {
            q: "Is the customer's Aadhaar data safe?",
            a: 'Fingerprints are captured by the certified RD service on your device and encrypted before they ever leave it. Neither you nor we can see or store the biometric. Aadhaar numbers are masked everywhere in the dashboard and in reports.',
        },
        {
            q: 'Who actually moves the money?',
            a: 'Transactions run over NPCI rails — AEPS, IMPS and BBPS — through our licensed banking partners. Shahparpay is the platform you work on; the settlement itself sits with the bank and the network.',
        },
        {
            q: 'What happens if someone gets into my account?',
            a: 'Logins are protected by a password and an OTP on your registered mobile, and AEPS additionally requires your own fingerprint for the daily authentication the bank mandates. If you suspect anything, call support and your account is frozen immediately.',
        },
        {
            q: 'Can I see a record of everything I have done?',
            a: 'Yes. Every service has its own report, and the wallet ledger shows every credit and debit with the running balance. Reports can be filtered by date and exported.',
        },
    ],
};

type FaqCategory = keyof typeof FAQ_DATA;
const FAQ_TABS: { key: FaqCategory; label: string }[] = [
    { key: 'getting_started', label: 'Getting started' },
    { key: 'integration', label: 'Devices and setup' },
    { key: 'security', label: 'Safety and trust' },
    { key: 'support', label: 'Earnings and support' },
];

const Landing: React.FC = () => {
    const [faqCategory, setFaqCategory] = useState<FaqCategory>('support');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    return (
        <div id="top" className="landing-page relative overflow-x-clip">
            <LandingNav />

            {/* ------------------------------------------------------------ HERO */}
            <section className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} grid items-center gap-12 py-16 sm:py-20 lg:min-h-[calc(100svh-64px)] lg:grid-cols-12 lg:gap-16 lg:py-16`}>
                    <div className="lg:col-span-6">
                        <h1 className="text-[40px] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--lp-fg)] sm:text-[56px] lg:text-[64px]">
                            Turn your shop into a banking point for your neighbourhood
                        </h1>
                        <p className={`${LEAD} mt-6 max-w-xl sm:text-xl`}>
                            ₹0 to join. You earn a commission on every transaction, and settle to your bank daily.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/login" className={BTN_PRIMARY}>Sign in</Link>
                            <Link to="/contact" className={BTN_SECONDARY}>Talk to us</Link>
                        </div>
                        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--lp-fg-2)]">
                            <li className="flex items-center gap-2"><Icon icon={ShieldCheck} /> Aadhaar data never stored</li>
                            <li className="flex items-center gap-2"><Icon icon={Zap} /> Runs on NPCI rails</li>
                            <li className="flex items-center gap-2"><Icon icon={CheckCircle2} /> Retailers across West Bengal</li>
                        </ul>
                    </div>
                    <div className="lg:col-span-6">
                        <AepsReceipt />
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------- HOW TO START */}
            <section className={SECTION}>
                <div className={WRAP}>
                    <div className="max-w-2xl">
                        <p className="lp-eyebrow">Get started</p>
                        <h2 className={`${H2} mt-3`}>Open your banking point in three steps</h2>
                        <p className={`${LEAD} mt-4`}>No joining fee, no monthly charge, and our team helps you at every step.</p>
                    </div>

                    <ol className="mt-12 grid gap-4 md:grid-cols-3">
                        {START_STEPS.map(({ title, text, icon }, i) => (
                            <li key={title} className={`${CARD} p-6`}>
                                <div className="flex items-center justify-between">
                                    <div className="lp-icon-tile"><Icon icon={icon} /></div>
                                    <span className="lp-figure text-sm text-[var(--lp-muted)]">Step {i + 1}</span>
                                </div>
                                <h3 className="mt-6 text-lg font-medium text-[var(--lp-fg)]">{title}</h3>
                                <p className={`${BODY} mt-2`}>{text}</p>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <a href="tel:+918240039776" className={BTN_SECONDARY}>
                            <Icon icon={Phone} /> <span className="lp-figure">+91 8240039776</span>
                        </a>
                        <span className="text-sm text-[var(--lp-fg-2)]">or ask your local Shahparpay distributor</span>
                    </div>
                </div>
            </section>

            {/* ------------------------------------ EVERY SERVICE, ONE LOGIN */}
            <section className={`${SECTION} lp-band`}>
                <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
                    <div className="lg:col-span-5">
                        <h2 className={H2}>Every service your customers ask for, on one login</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                        <div className={`${CARD} p-6`}>
                            <p className="text-sm text-[var(--lp-fg-2)]">Transactions this week</p>
                            <p className="lp-figure mt-3 text-[32px] leading-none text-[var(--lp-fg)]">2,847</p>
                            <p className="mt-3 text-sm text-[var(--lp-muted)]"><span className="text-[var(--lp-positive)]">+3.5%</span> vs last week</p>
                        </div>

                        <div className={`${CARD} p-6`}>
                            <p className="text-sm text-[var(--lp-fg-2)]">No hidden charges</p>
                            <p className="lp-figure mt-3 text-[32px] leading-none text-[var(--lp-fg)]">₹0</p>
                            <p className="mt-3 text-sm text-[var(--lp-muted)]">to join, and nothing monthly</p>
                        </div>

                        <div className={`${CARD} p-6 sm:col-span-2`}>
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-[var(--lp-surface)] text-sm text-[var(--lp-fg-2)]">AV</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base text-[var(--lp-fg)]">Abhishek Verma</p>
                                    <p className="text-sm text-[var(--lp-muted)]">Retailer KYC verified</p>
                                </div>
                                <span className="lp-figure text-base text-[var(--lp-fg)]">₹11,000.00</span>
                            </div>
                            <hr className="lp-tear my-4" />
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-[var(--lp-fg-2)]"><Icon icon={Fingerprint} /> AEPS cash withdrawal</span>
                                <span className="text-[var(--lp-positive)]">Settled</span>
                            </div>
                        </div>

                        <div className={`${CARD} p-6`}>
                            <p className="text-sm text-[var(--lp-fg-2)]">On every counter</p>
                            <ul className="mt-4 flex flex-wrap gap-2">
                                {SERVICES.map((s) => (
                                    <li key={s} className="rounded-md border border-[var(--lp-border)] px-2 py-1 text-sm text-[var(--lp-fg)]">{s}</li>
                                ))}
                            </ul>
                        </div>

                        <div className={`${CARD} flex flex-col p-6`}>
                            <div className="lp-icon-tile"><Icon icon={Headset} /></div>
                            <p className="mt-4 text-base text-[var(--lp-fg)]">Our team sets up your counter with you</p>
                            <p className="mt-1 text-sm text-[var(--lp-muted)]">Call <span className="lp-figure">+91 8240039776</span> · Mon–Sat</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------ SERVICES IN DETAIL */}
            <section id="products" className={`${SECTION} scroll-mt-16`}>
                <div className={WRAP}>
                    <h2 className={`${H2} max-w-3xl`}>Cash withdrawal, money transfer, bills, recharge. All from your counter</h2>

                    <div className="mt-12 grid gap-4 lg:grid-cols-12">
                        {/* AEPS */}
                        <article className={`${CARD} flex flex-col overflow-hidden lg:col-span-7`}>
                            <div className="p-6 sm:p-8">
                                <h3 className={H3}>AEPS cash withdrawal</h3>
                                <p className={`${BODY} mt-3 max-w-md`}>
                                    Your customer puts a finger on the scanner and walks out with cash. No card, no passbook, no trip to a bank branch. You earn on every withdrawal.
                                </p>
                            </div>
                            <div className="mt-auto flex justify-center bg-[var(--lp-surface)] px-6 pt-8">
                                <PhoneFrame className="-mb-24 w-64 sm:w-72">
                                    <div className="space-y-3 px-4 pb-28 pt-10">
                                        <div className="flex items-center justify-between rounded-xl border border-[var(--lp-border)] bg-white p-3">
                                            <div>
                                                <p className="text-sm text-[var(--lp-fg)]">Sunita Devi</p>
                                                <p className="text-xs text-[var(--lp-positive)]">Aadhaar verified</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[var(--lp-muted)]">Withdrawing</p>
                                                <p className="lp-figure text-sm text-[var(--lp-fg)]">₹2,000.00</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-[var(--lp-border)] bg-white p-3">
                                            <div>
                                                <p className="text-sm text-[var(--lp-fg)]">Your commission</p>
                                                <p className="text-xs text-[var(--lp-muted)]">Credited to wallet</p>
                                            </div>
                                            <p className="lp-figure text-sm text-[var(--lp-accent-ink)]">+₹14.00</p>
                                        </div>
                                        <div className="rounded-xl border border-[var(--lp-border)] bg-white p-3">
                                            <p className="text-xs text-[var(--lp-muted)]">Bank chosen automatically</p>
                                            <ul className="mt-2 divide-y divide-[var(--lp-border)] text-sm text-[var(--lp-fg)]">
                                                {['State Bank of India', 'Bank of Baroda', 'Punjab National Bank'].map((b) => (
                                                    <li key={b} className="py-2">{b}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </PhoneFrame>
                            </div>
                        </article>

                        {/* Money transfer and bills */}
                        <article id="payouts" className={`${CARD} scroll-mt-16 p-6 sm:p-8 lg:col-span-5`}>
                            <h3 className={H3}>Money transfer and bills</h3>
                            <p className={`${BODY} mt-3`}>
                                Send cash to any bank account over IMPS, pay an electricity or gas bill, recharge a phone or a FASTag. The errands that bring the same customers back to your shop every month.
                            </p>
                            <ul className="mt-8 grid grid-cols-2 gap-x-4 border-t border-[var(--lp-border)]">
                                {TRANSFER_AND_BILL_SERVICES.map(({ label, icon }) => (
                                    <li key={label} className="flex h-11 items-center gap-2.5 border-b border-[var(--lp-border)] text-sm text-[var(--lp-fg)]">
                                        <Icon icon={icon} /> {label}
                                    </li>
                                ))}
                            </ul>
                        </article>

                        {/* PAN and ITR */}
                        <article id="identity" className={`${CARD} scroll-mt-16 p-6 sm:p-8 lg:col-span-5`}>
                            <h3 className={H3}>PAN card and ITR filing</h3>
                            <p className={`${BODY} mt-3`}>
                                Apply for a new PAN card, file a correction, or file an income tax return for a customer. Higher value work than a recharge, and nobody in the area is offering it.
                            </p>
                            <div className="mt-8 rounded-xl border border-[var(--lp-border)] bg-[var(--lp-bg)] p-5">
                                <div className="flex items-center gap-2">
                                    <Icon icon={IdCard} />
                                    <p className="text-base text-[var(--lp-fg)]">PAN card application</p>
                                </div>
                                <p className="mt-1 text-sm text-[var(--lp-muted)]">New PAN · Form 49A · Aadhaar, photo and signature</p>
                                <hr className="lp-tear my-4" />
                                <dl className="space-y-2 text-sm">
                                    <div className={ROW}><dt className="text-[var(--lp-muted)]">Applicant name</dt><dd className="text-[var(--lp-fg)]">Samar Ahuja</dd></div>
                                    <div className={ROW}><dt className="text-[var(--lp-muted)]">Phone number</dt><dd className="lp-figure text-[var(--lp-fg)]">+91 98XXX XXX10</dd></div>
                                    <div className={ROW}><dt className="text-[var(--lp-muted)]">Service fee</dt><dd className="lp-figure text-[var(--lp-fg)]">₹107.00</dd></div>
                                </dl>
                                <div className="mt-4 flex h-10 items-center justify-center rounded-[10px] bg-[var(--lp-fg)] text-sm font-medium text-white">Submit application</div>
                            </div>
                        </article>

                        {/* Daily settlement */}
                        <article className={`${CARD} p-6 sm:p-8 lg:col-span-7`}>
                            <h3 className={H3}>Daily settlement</h3>
                            <p className={`${BODY} mt-3 max-w-md`}>
                                Move the day's earnings from your wallet to your own bank account, on your schedule.
                            </p>
                            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl bg-[var(--lp-surface)] p-5">
                                    <p className="text-sm text-[var(--lp-fg-2)]">Settled to your bank</p>
                                    <p className="lp-figure mt-2 text-[32px] leading-none text-[var(--lp-fg)]">₹2,450.00</p>
                                    <p className="lp-figure mt-2 text-xs text-[var(--lp-muted)]">29 Nov 2026 · 02:16 PM</p>
                                    <hr className="lp-tear my-4" />
                                    <p className="flex items-center gap-2 text-sm text-[var(--lp-fg-2)]"><Icon icon={Landmark} /> Your account <span className="lp-figure">•••• 4771</span></p>
                                </div>
                                <ul className="divide-y divide-[var(--lp-border)] rounded-xl border border-[var(--lp-border)]">
                                    {[
                                        { amt: '₹2,450.00', what: 'AEPS withdrawal', when: '4 min' },
                                        { amt: '₹1,800.00', what: 'Money transfer', when: '22 min' },
                                        { amt: '₹899.00', what: 'To UPI •••• 7712', when: '11 min' },
                                    ].map((r) => (
                                        <li key={r.what} className="flex h-16 items-center justify-between px-4">
                                            <div>
                                                <p className="lp-figure text-sm text-[var(--lp-fg)]">{r.amt}</p>
                                                <p className="text-xs text-[var(--lp-muted)]">{r.what}</p>
                                            </div>
                                            <span className="text-xs text-[var(--lp-positive)]">Settled in <span className="lp-figure">{r.when}</span></span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            {/* ----------------------------------------- BILLS AND RECHARGE */}
            <section className={`${SECTION} lp-band`}>
                <div className={WRAP}>
                    <h2 className={H2}>Two more reasons they walk in</h2>
                    <div className="mt-12 grid gap-12 md:grid-cols-2">
                        <div>
                            <BillReceiptMockup />
                            <h3 className="mt-8 text-lg font-medium text-[var(--lp-fg)]">BBPS bill payments</h3>
                            <p className={`${BODY} mt-2 max-w-md`}>
                                Electricity, water, gas, broadband, LPG, FASTag, insurance premiums and credit card bills — all on the Bharat BillPay network, with an instant receipt for the customer.
                            </p>
                        </div>
                        <div>
                            <RechargePlansMockup />
                            <h3 className="mt-8 text-lg font-medium text-[var(--lp-fg)]">Mobile and DTH recharge</h3>
                            <p className={`${BODY} mt-2 max-w-md`}>
                                Every prepaid operator and DTH provider, with current plans listed in the dashboard so you are not hunting for a pack while a customer waits. Small tickets, steady footfall, commission on each one.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------ WALLET AND REPORTS */}
            <section className={SECTION}>
                <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
                    <div className="lg:col-span-7">
                        <p className="lp-eyebrow">Wallet and reports</p>
                        <h2 className={`${H2} mt-3`}>Know exactly what you earned</h2>
                        <p className={`${LEAD} mt-4 max-w-xl`}>
                            Every transaction, every commission and every settlement is on record, so the day's takings are never a guess.
                        </p>
                        <h3 className="mt-10 text-lg font-medium text-[var(--lp-fg)]">Your ledger, live</h3>
                        <p className={`${BODY} mt-2 max-w-xl`}>
                            One wallet across every service, with a running balance and a line for each credit and debit. Separate reports for AEPS, money transfer, recharge, bills, PAN and ITR, filterable by date and exportable whenever your accountant asks.
                        </p>
                    </div>
                    <div className="flex justify-center lg:col-span-5">
                        <PhoneFrame className="w-[272px]">
                            <LedgerScreen />
                        </PhoneFrame>
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------------- CTA */}
            <section className="pb-20 sm:pb-28">
                <div className={WRAP}>
                    <div className="rounded-[20px] bg-[var(--lp-fg)] p-8 text-[#efe9de] sm:p-12 lg:p-16">
                        <h2 className="max-w-2xl text-3xl font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-4xl lg:text-[44px]">
                            Your shop is already busy. Give people one more reason to come in
                        </h2>
                        <p className="mt-6 max-w-xl text-base leading-relaxed text-[#bdb6aa]">
                            Nothing to pay to join and nothing to pay monthly. You keep a commission on every transaction, and you settle your wallet to your own bank account whenever you want.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/login" className="inline-flex h-12 items-center rounded-[10px] bg-[#efe9de] px-5 text-base font-medium text-[var(--lp-fg)] transition-colors hover:bg-white">
                                Sign in
                            </Link>
                            <Link to="/contact" className="inline-flex h-12 items-center rounded-[10px] border border-white/20 px-5 text-base font-medium text-white transition-colors hover:bg-white/10">
                                Talk to us
                            </Link>
                        </div>
                        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-[#bdb6aa]">
                            AEPS · Micro ATM · BBPS · DMT · PAN and ITR
                        </p>
                    </div>
                </div>
            </section>

            {/* --------------------------------------------------------- FAQ */}
            <section id="faq" className={`${SECTION} lp-band scroll-mt-16`}>
                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                    <h2 className={H2}>Frequently asked questions</h2>
                    <p className={`${LEAD} mt-4`}>Earnings, onboarding, devices and security — the things retailers ask before they sign up.</p>

                    <div role="tablist" aria-label="Question topics" className="mt-10 flex flex-wrap gap-2">
                        {FAQ_TABS.map((tab) => {
                            const on = faqCategory === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => { setFaqCategory(tab.key); setOpenFaqIndex(0); }}
                                    className={`h-9 rounded-lg border px-3.5 text-sm transition-colors ${
                                        on
                                            ? 'border-[var(--lp-fg)] bg-[var(--lp-card)] text-[var(--lp-fg)]'
                                            : 'border-[var(--lp-border)] text-[var(--lp-fg-2)] hover:bg-[var(--lp-card)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className={`${CARD} mt-6 divide-y divide-[var(--lp-border)]`}>
                        {FAQ_DATA[faqCategory].map((item, index) => {
                            const isOpen = openFaqIndex === index;
                            const id = `faq-${faqCategory}-${index}`;
                            return (
                                <div key={item.q}>
                                    <button
                                        type="button"
                                        aria-expanded={isOpen}
                                        aria-controls={id}
                                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                                    >
                                        <span className="text-base text-[var(--lp-fg)]">{item.q}</span>
                                        <Plus
                                            aria-hidden
                                            strokeWidth={1.5}
                                            className={`size-[18px] shrink-0 text-[var(--lp-muted)] transition-transform duration-150 ${isOpen ? 'rotate-45' : ''}`}
                                        />
                                    </button>
                                    {isOpen && (
                                        <p id={id} className={`${BODY} px-5 pb-5 sm:px-6`}>
                                            {item.a}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <a
                href="https://wa.me/918240039776?text=Hi%20Shahparpay%2C%20I%20need%20help%20with%20my%20retailer%20account."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-[#1f7a4d] text-white shadow-[var(--lp-shadow-lg)] transition-colors hover:bg-[#186440]"
            >
                <MessageCircle aria-hidden className="size-5" strokeWidth={1.5} />
            </a>

            <LandingFooter />
        </div>
    );
};

export default Landing;
