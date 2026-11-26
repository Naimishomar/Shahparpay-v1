import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Fingerprint,
    MessageCircle,
    Phone,
    Plus,
    ShieldCheck,
    Smartphone,
    Users,
    Wallet,
    Zap,
} from 'lucide-react';
import './landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import HeroDemo from '@/components/landing/HeroDemo';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, H2, LEAD, SECTION, WRAP } from '@/components/landing/ui';

/*
 * Figures on this page follow the rate card in backend/src/utils/wallet.util.js
 * (served at /api/commission). Change them together.
 */

import { Icon, Tile, UpiShot, DmtShot, BillShot, RechargeShot, PanShot, LeadShot, WalletShot, NetworkShot } from '@/components/landing/Shots';

/* -------------------------------------------------------------------- data */

const START_STEPS = [
    { icon: Users, title: 'Sign up online', text: 'Four short steps with your PAN, Aadhaar, bank and shop details, then a one-time ₹99 onboarding charge by UPI.' },
    { icon: Fingerprint, title: 'Get approved and finish KYC', text: 'Our team approves your account. Complete AEPS eKYC from the dashboard with an RD-certified fingerprint scanner.' },
    { icon: Wallet, title: 'Load your wallet and start', text: 'Raise a fund request to your distributor. Serve customers, earn on every transaction, settle to your bank.' },
];

const RATES = [
    { what: 'AEPS withdrawal of ₹3,000', earns: '₹11' },
    { what: 'UPI cash withdrawal of ₹2,000', earns: '₹3' },
    { what: 'PAN card application', earns: '₹5' },
    { what: 'Approved credit card lead', earns: '₹500' },
];

const FAQ_DATA = {
    support: [
        {
            q: 'How much can I actually earn from this?',
            a: 'You earn a commission on every transaction — AEPS and UPI cash withdrawals, Micro ATM, recharges, bill payments, PAN applications and approved leads each carry their own rate. Your dashboard shows the exact commission on every transaction, and the full rate card is on the Commission page.',
        },
        {
            q: 'How do I get my earnings out?',
            a: 'Commissions land in your wallet as each transaction completes. Move money to your own bank account from the dashboard whenever you like; each payout costs ₹5 + GST. There is no minimum holding period and no waiting for month-end.',
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
            q: 'Is there an onboarding charge?',
            a: 'Yes, a one-time ₹99 onboarding charge, paid by UPI at the end of the online signup. Your signup reaches our team for approval only after it is paid, and ₹10 of it goes to your Utility Wallet for the AEPS onboarding fee. There is no monthly charge.',
        },
        {
            q: 'What documents do I need to sign up?',
            a: 'Your PAN card, Aadhaar card, a cancelled cheque or bank passbook page, a photograph, and a photo of your shop. If your shop is registered, keep the GST or Udyam certificate handy as well.',
        },
        {
            q: 'How long before I can start taking transactions?',
            a: 'Basic services such as recharge and bill payments open as soon as your account is approved. AEPS takes longer because the bank runs its own Aadhaar KYC on you first — that step is done through a fingerprint scanner and is usually cleared within a working day.',
        },
        {
            q: 'Do I need to be a registered business to join?',
            a: 'No. Individual shop owners can sign up. You need your own PAN and Aadhaar, a bank account in your name, and a shop or counter where you serve customers.',
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
            q: 'Do I need a scanner for UPI cash withdrawal?',
            a: 'No. You generate a QR for the amount, the customer pays it from any UPI app on their phone, and you hand over the cash once it shows as paid. It works from ₹500 to ₹5,000.',
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
            a: 'Transactions run over NPCI rails — AEPS, UPI, IMPS and BBPS — through our licensed banking partners. Shahparpay is the platform you work on; the settlement itself sits with the bank and the network.',
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

/* -------------------------------------------------------------------- page */

const Landing: React.FC = () => {
    const [faqCategory, setFaqCategory] = useState<FaqCategory>('getting_started');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    return (
        <div id="top" className="landing-page relative overflow-x-clip">
            <LandingNav />

            {/* ------------------------------------------------------------ HERO */}
            <section className="border-b border-[var(--lp-border)]">
                <div className={`${WRAP} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24`}>
                    <div className="lg:col-span-5">
                        <h1 className="lp-serif text-balance text-[48px] leading-[1] text-[var(--lp-fg)] sm:text-[64px] xl:text-[72px]">
                            Turn your shop into a banking point for your neighbourhood
                        </h1>
                        <p className={`${LEAD} mt-6 max-w-xl sm:text-xl`}>
                            AEPS and UPI cash withdrawal, money transfer, bills and recharge on one login. You earn on every transaction and move it to your bank whenever you like.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/signup" className={BTN_PRIMARY}>Start your signup <ArrowRight aria-hidden className="size-4" strokeWidth={2} /></Link>
                            <Link to="/login" className={BTN_SECONDARY}>Sign in</Link>
                        </div>
                        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--lp-fg-2)]">
                            <li className="flex items-center gap-2"><Icon icon={ShieldCheck} /> Aadhaar data never stored</li>
                            <li className="flex items-center gap-2"><Icon icon={Zap} /> Runs on NPCI rails</li>
                            <li className="flex items-center gap-2"><Icon icon={Smartphone} /> Web and Android app</li>
                        </ul>
                    </div>
                    <div className="lg:col-span-7">
                        <div className="rounded-[20px] bg-[var(--lp-surface)]">
                            <HeroDemo />
                        </div>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------- SERVICES BENTO */}
            <section id="products" className={`${SECTION} scroll-mt-16`}>
                <div className={WRAP}>
                    <div className="max-w-3xl">
                        <p className="lp-eyebrow">Services</p>
                        <h2 className={`${H2} mt-3`}>Every errand your customers bring, on one counter</h2>
                    </div>

                    <div className="mt-12 grid gap-4 lg:grid-cols-12">
                        <Tile
                            className="lg:col-span-7"
                            title="UPI cash withdrawal"
                            text="No scanner, no card. Show a QR for the amount, the customer pays from any UPI app, you hand over the cash. ₹500 to ₹5,000."
                        >
                            <UpiShot />
                        </Tile>
                        <Tile
                            className="lg:col-span-5"
                            title="Money transfer"
                            text="Cash in hand to any bank account over IMPS. The account holder's name is checked before a rupee leaves."
                        >
                            <DmtShot />
                        </Tile>
                        <Tile
                            className="lg:col-span-5"
                            title="Bill payments"
                            text="Electricity, water, gas, broadband, FASTag, insurance and credit card bills on Bharat BillPay, with an instant receipt."
                        >
                            <BillShot />
                        </Tile>
                        <Tile
                            className="lg:col-span-7"
                            title="Mobile and DTH recharge"
                            text="Every prepaid operator and DTH provider, with current plans listed so you are not hunting for a pack while a customer waits."
                        >
                            <RechargeShot />
                        </Tile>
                        <Tile
                            className="lg:col-span-6"
                            title="PAN card and TaxSuite filing"
                            text="New PAN applications, corrections and income tax returns. Higher value work than a recharge."
                        >
                            <PanShot />
                        </Tile>
                        <Tile
                            className="lg:col-span-6"
                            title="Lead generation"
                            text="Refer customers for credit cards, savings accounts and instant loans, and earn a flat amount when the bank approves."
                        >
                            <LeadShot />
                        </Tile>
                    </div>

                    <p className="mt-6 text-sm text-[var(--lp-fg-2)]">
                        Also on every counter: AEPS balance enquiry, mini statement, cash deposit and Aadhaar Pay, Micro ATM, and payment links to collect from customers.
                    </p>
                </div>
            </section>

            {/* ------------------------------------------- WALLET AND SETTLEMENT */}
            <section className={`${SECTION} lp-band`}>
                <div className={WRAP}>
                    <div className="max-w-2xl">
                        <p className="lp-eyebrow">Wallet and settlement</p>
                        <h2 className={`${H2} mt-3`}>Know exactly what you earned, and take it home</h2>
                        <p className={`${LEAD} mt-4`}>
                            One wallet across every service, a line for each credit and debit, and a report per service you can filter and export. Move the balance to your bank from the web or the app.
                        </p>
                    </div>
                    <div className="mt-12">
                        <WalletShot />
                    </div>
                </div>
            </section>

            {/* ---------------------------------------------- DISTRIBUTOR NETWORK */}
            <section className={SECTION}>
                <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
                    <div className="lg:col-span-5">
                        <p className="lp-eyebrow">For distributors</p>
                        <h2 className={`${H2} mt-3`}>Run a network of counters from one place</h2>
                        <p className={`${LEAD} mt-4`}>
                            Add retailers, switch each service on or off per shop, approve their wallet top-ups and earn a share of every transaction they make.
                        </p>
                        <Link to="/contact" className={`${BTN_SECONDARY} mt-8`}>Ask about a distributor account</Link>
                    </div>
                    <div className="lg:col-span-7">
                        <div className="rounded-[20px] bg-[var(--lp-surface)] px-[8%] pt-10 sm:pt-12">
                            <div className="-mb-px max-h-[380px] overflow-hidden">
                                <NetworkShot />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ------------------------------------------------- HOW TO START */}
            <section className={`${SECTION} lp-band`}>
                <div className={WRAP}>
                    <div className="max-w-2xl">
                        <p className="lp-eyebrow">Get started</p>
                        <h2 className={`${H2} mt-3`}>Open your banking point in three steps</h2>
                    </div>

                    <ol className="mt-12 grid gap-4 md:grid-cols-3">
                        {START_STEPS.map(({ title, text, icon }, i) => (
                            <li key={title} className={`${CARD} p-6`}>
                                <div className="flex items-start justify-between">
                                    <span className="lp-serif text-[56px] leading-none text-[var(--lp-accent-ink)]"><span className="sr-only">Step </span>{i + 1}</span>
                                    <div className="lp-icon-tile"><Icon icon={icon} /></div>
                                </div>
                                <h3 className="mt-6 text-lg font-medium text-[var(--lp-fg)]">{title}</h3>
                                <p className={`${BODY} mt-2`}>{text}</p>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <Link to="/signup" className={BTN_PRIMARY}>Start your signup</Link>
                        <a href="tel:+918240039776" className={BTN_SECONDARY}>
                            <Icon icon={Phone} /> <span className="lp-figure">+91 8240039776</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* --------------------------------------------- RATES + CTA */}
            <section className={SECTION}>
                <div className={WRAP}>
                    <div className="lp-counter rounded-[24px] p-8 sm:p-12 lg:p-16">
                        <div className="grid gap-12 lg:grid-cols-12">
                            <div className="lg:col-span-6">
                                <h2 className="lp-serif max-w-2xl text-[40px] leading-[1.04] text-white sm:text-[52px]">
                                    Your shop is already busy. Give people one more reason to come in
                                </h2>
                                <div className="mt-8 flex flex-wrap gap-3">
                                    <Link to="/signup" className="inline-flex h-12 items-center rounded-[10px] bg-[#efe9de] px-5 text-base font-medium text-[#1c1a17] transition-colors hover:bg-white">
                                        Start your signup
                                    </Link>
                                    <Link to="/contact" className="inline-flex h-12 items-center rounded-[10px] border border-white/20 px-5 text-base font-medium text-white transition-colors hover:bg-white/10">
                                        Talk to us
                                    </Link>
                                </div>
                            </div>
                            <div className="lg:col-span-6">
                                <p className="text-sm text-[var(--lp-on-ink-2)]">What you earn, from the rate card</p>
                                <dl className="mt-3 divide-y divide-white/10 border-y border-white/10">
                                    {RATES.map((r) => (
                                        <div key={r.what} className="flex h-14 items-center justify-between gap-4">
                                            <dt className="text-[15px] text-[var(--lp-on-ink)]">{r.what}</dt>
                                            <dd className="lp-figure text-lg text-white">{r.earns}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="mt-4 text-sm text-[var(--lp-on-ink-2)]">
                                    Before 2% TDS. <Link to="/commission" className="text-white underline underline-offset-4">See the full rate card</Link>
                                </p>
                            </div>
                        </div>
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
