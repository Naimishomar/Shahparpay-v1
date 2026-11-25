import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'motion/react';
import {
    ArrowRight,
    BadgeCheck,
    Check,
    CheckCircle2,
    Clock3,
    CreditCard,
    FileText,
    Fingerprint,
    IdCard,
    Loader2,
    Landmark,
    MessageCircle,
    Phone,
    PiggyBank,
    Plus,
    QrCode,
    Send,
    ShieldCheck,
    Smartphone,
    Users,
    Wallet,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import './landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import HeroDemo from '@/components/landing/HeroDemo';
import { Roll, Slot } from '@/components/landing/motion';
import { TRAVEL, useBeats } from '@/components/landing/beats';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, H2, LEAD, SECTION, WRAP } from '@/components/landing/ui';

/*
 * Figures on this page follow the rate card in backend/src/utils/wallet.util.js
 * (served at /api/commission). Change them together.
 */

const Icon = ({ icon: I, className = '' }: { icon: LucideIcon; className?: string }) => (
    <I aria-hidden className={`size-4 shrink-0 text-[var(--hd-ink-3)] ${className}`} strokeWidth={1.75} />
);

/** Filler where the eye does not land: the product's own gray lines. */
const Bar = ({ w, className = '' }: { w: number; className?: string }) => (
    <span aria-hidden className={`block h-[6px] rounded-full bg-[var(--hd-bar)] ${className}`} style={{ width: w }} />
);

/** A row of a faux list: one line, 12px inset. */
const Row = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`flex h-12 items-center gap-3 border-b border-[var(--hd-line)] px-3 text-[14px] last:border-0 ${className}`}>{children}</div>
);

const PRIMARY_BTN = 'flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[var(--hd-primary)] text-[14px] font-medium text-[var(--hd-on-primary)]';
const OK_PILL = 'inline-flex h-6 items-center gap-1 rounded-full bg-[var(--hd-ok-bg)] px-2 text-[12px] text-[var(--lp-positive)]';
const Ok = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-1.5 text-[var(--lp-positive)]"><CheckCircle2 aria-hidden className="size-4" strokeWidth={2} /> {children}</span>
);
const Wait = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-1.5 text-[var(--hd-ink-2)]"><Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={2} /> {children}</span>
);

/** A feature tile: copy at the top, the product pinned beneath it and bled off the bottom edge. */
function Tile({ title, text, className = '', children }: { title: string; text: string; className?: string; children: React.ReactNode }) {
    return (
        <article className={`hd-tile min-h-[380px] ${className}`}>
            <div className="p-6 sm:p-8">
                <h3 className="text-xl font-medium tracking-[-0.01em] text-[var(--lp-fg)]">{title}</h3>
                <p className={`${BODY} mt-2 max-w-md`}>{text}</p>
            </div>
            <div className="hd-tile__shot">
                <div aria-hidden className="hd-window rounded-t-[14px] bg-[var(--hd-surface)] pb-10">{children}</div>
            </div>
        </article>
    );
}

/* ------------------------------------------------------------------ tiles */

/** Waiting for the customer's UPI payment, then paid and the commission lands. */
function UpiShot() {
    const { ref, step } = useBeats([2400, 3400], 1);
    const paid = step === 1;
    return (
        <div ref={ref} className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-xl bg-white p-3 ring-1 ring-[var(--hd-line)]">
                <QRCodeSVG value="https://shahparpay.com" size={132} fgColor="#16142e" bgColor="#ffffff" level="M" />
            </div>
            <div className="min-w-0">
                <div className="text-[12px] text-[var(--hd-ink-3)]">UPI cash withdrawal</div>
                <div className="lp-figure mt-1 text-[26px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹2,000.00</div>
                <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--hd-line)]">
                    <Row>
                        <Slot at={step} states={[[0, <Wait>Waiting for the customer</Wait>], [1, <Ok>Paid from customer's UPI app</Ok>]]} />
                    </Row>
                    <Row>
                        <span className="text-[var(--hd-ink-2)]">Your commission</span>
                        <span className="lp-figure ml-auto text-[var(--lp-accent-ink)] transition-opacity duration-500" style={{ opacity: paid ? 1 : 0.25 }}>
                            +₹{paid ? '3.00' : '0.00'}
                        </span>
                    </Row>
                </div>
            </div>
        </div>
    );
}

/** The account holder's name is checked, then the transfer goes. */
function DmtShot() {
    const { ref, step } = useBeats([1600, 1900, 3000], 2);
    return (
        <div ref={ref} className="p-5">
            <div className="flex items-center gap-3">
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-[var(--hd-violet-bg)] text-[13px] font-medium text-[var(--lp-accent-ink)]">RK</span>
                <div className="min-w-0">
                    <div className="text-[14px] text-[var(--hd-ink)]">Ravi Kumar</div>
                    <div className="lp-figure mt-0.5 text-[12px] text-[var(--hd-ink-3)]">SBI •••• 4771</div>
                </div>
                <Slot
                    className="ml-auto flex-none justify-items-end"
                    at={step === 0 ? 0 : 1}
                    states={[
                        [0, <span className="inline-flex h-6 items-center gap-1 text-[12px] text-[var(--hd-ink-2)]"><Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} /> Verifying</span>],
                        [1, <span className={OK_PILL}><BadgeCheck aria-hidden className="size-3.5" strokeWidth={2} /> Verified</span>],
                    ]}
                />
            </div>
            <div className="mt-5 rounded-[10px] border border-[var(--hd-line)]">
                <Row>
                    <span className="text-[var(--hd-ink-2)]">Send by IMPS</span>
                    <span className="lp-figure ml-auto text-[var(--hd-ink)]">₹5,000.00</span>
                </Row>
                <Row>
                    <Bar w={72} />
                    <Bar w={44} className="ml-auto" />
                </Row>
            </div>
            <div className={`${PRIMARY_BTN} mt-4 transition-colors duration-300 ${step === 2 ? '!bg-[#15803d] !text-white' : ''}`}>
                <Slot
                    at={step === 2 ? 1 : 0}
                    states={[
                        [0, <><Send aria-hidden className="size-4" strokeWidth={1.75} /> Send ₹5,000</>],
                        [1, <><Check aria-hidden className="size-4" strokeWidth={2.25} /> Sent to Ravi Kumar</>],
                    ]}
                />
            </div>
        </div>
    );
}

/** A bill fetched by consumer number, paid, receipt sent. */
function BillShot() {
    const { ref, step } = useBeats([2400, 3200], 1);
    return (
        <div ref={ref} className="p-5">
            <div className="flex items-center gap-3">
                <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-[var(--hd-warn-bg)] text-[var(--hd-warn)]"><Zap aria-hidden className="size-4" strokeWidth={1.75} /></span>
                <div className="min-w-0">
                    <div className="text-[14px] text-[var(--hd-ink)]">WBSEDCL electricity</div>
                    <div className="lp-figure mt-0.5 text-[12px] text-[var(--hd-ink-3)]">Consumer 1023 4567 89</div>
                </div>
            </div>
            <hr className="lp-tear my-4" />
            <div className="flex items-baseline justify-between text-[14px]">
                <span className="text-[var(--hd-ink-2)]">Bill amount</span>
                <span className="lp-figure text-[var(--hd-ink)]">₹1,186.00</span>
            </div>
            <div className="mt-2 flex items-center gap-2"><Bar w={64} /><Bar w={38} className="ml-auto" /></div>
            <hr className="lp-tear my-4" />
            <div className="text-[14px]">
                <Slot at={step} states={[[0, <Wait>Paying on Bharat BillPay</Wait>], [1, <Ok>Paid · receipt sent</Ok>]]} />
            </div>
        </div>
    );
}

const PLANS = [
    { price: 239, detail: '1.5 GB/day · 28 days' },
    { price: 299, detail: '2 GB/day · 28 days' },
    { price: 719, detail: '1.5 GB/day · 84 days' },
];

/** The selection moves through the plans; the button's price follows it. */
function RechargeShot() {
    const { ref, step } = useBeats([2200, 2200, 2200], 1);
    return (
        <div ref={ref} className="grid gap-5 p-5 sm:grid-cols-[1fr_1fr]">
            <div>
                <div className="flex items-center gap-3">
                    <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-[var(--hd-fill)]"><Smartphone aria-hidden className="size-4 text-[var(--hd-ink-2)]" strokeWidth={1.75} /></span>
                    <div className="min-w-0">
                        <div className="lp-figure text-[14px] text-[var(--hd-ink)]">98XXX XXX21</div>
                        <div className="mt-0.5 text-[12px] text-[var(--hd-ink-3)]">Prepaid · West Bengal</div>
                    </div>
                </div>
                <div className={`${PRIMARY_BTN} mt-5`}>Recharge ₹<Roll value={String(PLANS[step].price)} /></div>
            </div>
            <div className="relative space-y-2">
                {PLANS.map((p, i) => (
                    <div key={p.price} className="relative flex h-14 items-center justify-between gap-3 rounded-[10px] border border-[var(--hd-line)] px-3">
                        {i === step && (
                            <motion.span
                                layoutId="plan-pick"
                                className="absolute -inset-px rounded-[10px] border border-[var(--hd-primary)] bg-[var(--hd-fill)]"
                                transition={{ duration: 0.5, ease: TRAVEL }}
                            />
                        )}
                        <div className="relative min-w-0">
                            <div className="lp-figure text-[14px] text-[var(--hd-ink)]">₹{p.price}</div>
                            <div className="mt-0.5 text-[12px] text-[var(--hd-ink-3)]">{p.detail}</div>
                        </div>
                        <Check aria-hidden className="relative size-4 flex-none text-[var(--hd-primary)] transition-opacity duration-300" style={{ opacity: i === step ? 1 : 0 }} strokeWidth={2.25} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** A PAN application earns ₹5; the TaxSuite return beside it finishes filing. */
function PanShot() {
    const { ref, step } = useBeats([2000, 3200], 1);
    return (
        <div ref={ref} className="p-5">
            <div className="flex items-center gap-2 text-[14px] text-[var(--hd-ink)]">
                <Icon icon={IdCard} /> New PAN · Form 49A
            </div>
            <div className="mt-4 rounded-[10px] border border-[var(--hd-line)]">
                <Row>
                    <span className="text-[var(--hd-ink-2)]">Applicant</span>
                    <span className="ml-auto text-[var(--hd-ink)]">Samar Ahuja</span>
                </Row>
                <Row>
                    <span className="text-[var(--hd-ink-2)]">Fee</span>
                    <span className="lp-figure ml-auto text-[var(--hd-ink)]">₹107.00</span>
                </Row>
                <Row>
                    <span className="text-[var(--hd-ink-2)]">You earn</span>
                    <span className="lp-figure ml-auto text-[var(--lp-accent-ink)]">+₹5.00</span>
                </Row>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-[var(--hd-fill)] px-3 py-3 text-[14px] text-[var(--hd-ink)]">
                <Icon icon={FileText} /> TaxSuite · ITR
                <Slot
                    className="ml-auto justify-items-end"
                    at={step}
                    states={[
                        [0, <span className="inline-flex h-6 items-center gap-1 text-[12px] text-[var(--hd-ink-2)]"><Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} /> Filing</span>],
                        [1, <span className={OK_PILL}>Filed</span>],
                    ]}
                />
            </div>
        </div>
    );
}

const LEADS = [
    { name: 'Credit card', earns: '₹500', icon: CreditCard },
    { name: 'Zero-balance savings account', earns: '₹100', icon: PiggyBank },
    { name: 'Instant loan', earns: '₹100', icon: Landmark },
];

/** Leads get approved one at a time; the approved one is lifted and marked. */
function LeadShot() {
    const { ref, step } = useBeats([2200, 2200, 2200], 0);
    return (
        <div ref={ref} className="p-5">
            <div className="text-[12px] text-[var(--hd-ink-3)]">Paid once the lead is approved</div>
            <div className="mt-3 rounded-[10px] border border-[var(--hd-line)] p-1">
                {LEADS.map((l, i) => (
                    <div key={l.name} className="relative flex h-12 items-center gap-3 px-3 text-[14px]">
                        {i === step && (
                            <motion.span layoutId="lead-pick" className="absolute inset-0 rounded-[8px] bg-[var(--hd-fill)]" transition={{ duration: 0.5, ease: TRAVEL }} />
                        )}
                        <Icon icon={l.icon} className="relative" />
                        <span className="relative min-w-0 truncate text-[var(--hd-ink)]">{l.name}</span>
                        <span className="relative ml-auto flex flex-none items-center gap-2">
                            <span className={`${OK_PILL} transition-opacity duration-300`} style={{ opacity: i === step ? 1 : 0 }}>Approved</span>
                            <span className="lp-figure text-[var(--lp-accent-ink)]">{l.earns}</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ---------------------------------------------------- wallet + phone shot */

/** What lands in the wallet, in the order the loop plays it. Commission is credited before 2% TDS here. */
const CREDITS = [
    { what: 'AEPS commission', amt: 11, icon: Fingerprint },
    { what: 'UPI cash withdrawal', amt: 3, icon: QrCode },
    { what: 'PAN application', amt: 5, icon: IdCard },
];
const BASE_BALANCE = 48250;

/** A ledger that only grows: each beat a new credit arrives on top and the balance rolls. */
function WalletShot() {
    const { ref, tick } = useBeats([2600], 0);
    const n = tick + 1; // credits shown so far; the poster shows the first one
    const rows = Array.from({ length: Math.min(n, 3) }, (_, k) => {
        const idx = n - 1 - k;
        return { id: idx, ...CREDITS[idx % CREDITS.length] };
    });
    const balance = BASE_BALANCE + Array.from({ length: n }, (_, i) => CREDITS[i % CREDITS.length].amt).reduce((a, b) => a + b, 0);

    return (
        <div ref={ref} className="relative mx-auto max-w-[1040px]">
            <div className="hd-window overflow-hidden rounded-[14px] bg-[var(--hd-surface)] md:mr-[160px]">
                <div className="flex h-[38px] items-center gap-2 border-b border-[var(--hd-line)] bg-[var(--hd-chrome)] px-3.5">
                    <span className="flex gap-1.5" aria-hidden>
                        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} className="size-[10px] rounded-full" style={{ background: c }} />)}
                    </span>
                    <span className="mx-auto flex h-[22px] w-[200px] items-center justify-center rounded-md bg-[var(--hd-surface)] text-[11px] text-[var(--hd-ink-3)] ring-1 ring-[var(--hd-line)]">shahparpay.com/ledger</span>
                </div>
                <div className="p-5 sm:p-7 md:pr-[124px]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <div className="text-[13px] text-[var(--hd-ink-3)]">Wallet balance</div>
                            <div className="lp-figure mt-1 text-[32px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹<Roll value={balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} /></div>
                        </div>
                        <div className="flex gap-2" aria-hidden>
                            <span className="flex h-9 items-center rounded-[9px] border border-[var(--hd-line-strong)] px-3"><Bar w={48} /></span>
                            <span className="flex h-9 items-center gap-2 rounded-[9px] bg-[var(--hd-primary)] px-3.5 text-[13px] font-medium text-[var(--hd-on-primary)]">
                                <Landmark aria-hidden className="size-4" strokeWidth={1.75} /> Move to bank
                            </span>
                        </div>
                    </div>
                    <div className="mt-6 overflow-hidden rounded-[10px] border border-[var(--hd-line)]">
                        <AnimatePresence initial={false}>
                            {rows.map((r) => (
                                <motion.div
                                    key={r.id}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 52, opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ height: { duration: 0.5, ease: TRAVEL }, opacity: { duration: 0.35, delay: 0.15 } }}
                                    className="overflow-hidden"
                                >
                                    <Row className="h-[52px]">
                                        <Icon icon={r.icon} />
                                        <span className="min-w-0 truncate text-[var(--hd-ink)]">{r.what}</span>
                                        <span className="lp-figure ml-auto flex-none text-[var(--lp-positive)]">+₹{r.amt}.00</span>
                                    </Row>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {[[120, 64], [96, 72]].map(([a, b], i) => (
                            <Row key={i} className="h-[52px] border-t border-[var(--hd-line)]">
                                <Bar w={16} className="flex-none" /><Bar w={a} /><Bar w={b} className="ml-auto" />
                            </Row>
                        ))}
                    </div>
                </div>
            </div>

            {/* Satellite: the Android app, straddling the window's right edge over its margin. */}
            <div className="absolute right-0 top-16 hidden w-[260px] md:block">
                <div className="hd-satellite rounded-[34px] bg-[var(--hd-bezel)] p-[7px]">
                    <div className="relative min-h-[400px] overflow-hidden rounded-[28px] bg-[var(--lp-bg)] px-4 pb-6 pt-10">
                        <span aria-hidden className="absolute left-1/2 top-3 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-[var(--hd-bezel)]" />
                        <div className="flex items-center gap-2 text-[13px] text-[var(--lp-positive)]">
                            <CheckCircle2 aria-hidden className="size-4" strokeWidth={2} /> Settled to your bank
                        </div>
                        <div className="lp-figure mt-3 text-[28px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹25,000.00</div>
                        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--hd-ink-2)]">
                            <Landmark aria-hidden className="size-3.5 text-[var(--hd-ink-3)]" strokeWidth={1.75} /> SBI <span className="lp-figure">•••• 4771</span>
                        </div>
                        <hr className="lp-tear my-4" />
                        <div className="flex items-baseline justify-between text-[12px]">
                            <span className="text-[var(--hd-ink-2)]">Payout charge</span>
                            <span className="lp-figure text-[var(--hd-ink)]">₹5 + GST</span>
                        </div>
                        <div className="mt-4 space-y-2.5" aria-hidden>
                            <Bar w={140} /><Bar w={96} /><Bar w={118} /><Bar w={0} className="h-4 bg-transparent" /><Bar w={120} /><Bar w={84} /><Bar w={132} /><Bar w={100} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------- distributor network shot */

const SWITCHES = ['AEPS', 'DMT', 'Recharge', 'PAN'];
const RETAILERS = [
    { name: 'Sunita General Store', place: 'Howrah', initials: 'SG', bg: 'rgba(59,130,246,0.16)', ink: '#5b8fd9', flips: true },
    { name: 'Maa Tara Telecom', place: 'Bally', initials: 'MT', bg: 'rgba(234,88,12,0.16)', ink: '#d0673f', flips: false },
];

const Toggle = ({ on }: { on: boolean }) => (
    <span className={`relative inline-flex h-[18px] w-[30px] flex-none rounded-full transition-colors duration-200 ${on ? 'bg-[var(--hd-primary)]' : 'bg-[var(--hd-off)]'}`}>
        <span className="absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[left] duration-200" style={{ left: on ? 14 : 2 }} />
    </span>
);

/** The distributor switches PAN on for one shop, and a fund request is approved. */
function NetworkShot() {
    const { ref, step } = useBeats([2600, 2600], 1);
    const on = step === 1;
    return (
        <div ref={ref} className="hd-window overflow-hidden rounded-[14px] bg-[var(--hd-surface)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--hd-line)] px-5 py-4">
                <div className="text-[15px] font-medium text-[var(--hd-ink)]">Your retailers</div>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--hd-warn-bg)] px-2.5 text-[12px] text-[var(--hd-warn)]">
                    <Clock3 aria-hidden className="size-3.5" strokeWidth={1.75} /> <Roll value={on ? '1' : '2'} /> {on ? 'fund request' : 'fund requests'}
                </span>
            </div>
            {RETAILERS.map((r) => (
                <div key={r.name} className="border-b border-[var(--hd-line)] px-5 py-4 last:border-0">
                    <div className="flex items-center gap-3">
                        <span className="flex size-9 flex-none items-center justify-center rounded-full text-[12px] font-medium" style={{ background: r.bg, color: r.ink }}>{r.initials}</span>
                        <div className="min-w-0">
                            <div className="truncate text-[14px] text-[var(--hd-ink)]">{r.name}</div>
                            <div className="text-[12px] text-[var(--hd-ink-3)]">{r.place}</div>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 pl-12">
                        {SWITCHES.map((s) => (
                            <span key={s} className="inline-flex items-center gap-2 text-[12px] text-[var(--hd-ink-2)]">
                                <Toggle on={s !== 'PAN' || !r.flips || on} /> {s}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
            <div className="flex items-center gap-3 px-5 py-4" aria-hidden>
                <span className="size-9 flex-none rounded-full bg-[var(--hd-fill)]" />
                <div className="space-y-2"><Bar w={130} /><Bar w={70} /></div>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------- data */

const START_STEPS = [
    { icon: Users, title: 'Sign up online', text: 'Four short steps with your PAN, Aadhaar, bank and shop details, then a one-time ₹199 registration fee by UPI.' },
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
            q: 'Is there a joining fee?',
            a: 'There is a one-time ₹199 registration fee, paid by UPI at the end of the online signup. Your signup reaches our team for approval only after the fee is paid. There is no monthly charge.',
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
