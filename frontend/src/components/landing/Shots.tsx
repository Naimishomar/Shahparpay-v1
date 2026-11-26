import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'motion/react';
import {
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
    PiggyBank,
    QrCode,
    Send,
    Smartphone,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { Roll, Slot } from '@/components/landing/motion';
import { TRAVEL, useBeats } from '@/components/landing/beats';
import { BODY } from '@/components/landing/ui';

/*
 * The landing page's product shots: small looping scenes of the portal at work.
 * Shared by the landing page and the retailer dashboard. They read the --hd-*
 * and --lp-* tokens, so they must sit inside .landing-page or .hd-scope.
 * Figures follow the rate card in backend/src/utils/wallet.util.js.
 */
export const Icon = ({ icon: I, className = '' }: { icon: LucideIcon; className?: string }) => (
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
export function Tile({ title, text, className = '', children }: { title: string; text: string; className?: string; children: React.ReactNode }) {
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
export function UpiShot() {
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
export function DmtShot() {
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
export function BillShot() {
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
export function RechargeShot() {
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
export function PanShot() {
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
export function LeadShot() {
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
export function WalletShot() {
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
export function NetworkShot() {
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
