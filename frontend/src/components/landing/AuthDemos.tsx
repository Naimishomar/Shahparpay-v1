import { AnimatePresence, motion } from 'motion/react';
import { Check, Circle, CreditCard, Fingerprint, IdCard, Loader2, QrCode, type LucideIcon } from 'lucide-react';
import { Roll, Slot } from './motion';
import { TRAVEL, useBeats } from './beats';

/*
 * Illustrations for the sign-in and signup pages, built to the same rules as the
 * landing hero: one window pinned on a tinted well and bled off its foot, real
 * words only on the story, figures from the rate card.
 */

const Bar = ({ w }: { w: number }) => <span aria-hidden className="block h-[6px] rounded-full bg-[var(--hd-bar)]" style={{ width: w }} />;

function Well({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div role="img" aria-label={label} className="overflow-hidden rounded-[20px] bg-[var(--lp-surface)] px-[8%] pt-8">
            <div className="hd-window -mb-6 rounded-t-[14px] bg-[var(--hd-surface)] pb-10">{children}</div>
        </div>
    );
}

/* ---------------------------------------------------------------- sign in */

const CREDITS: { what: string; amt: number; icon: LucideIcon }[] = [
    { what: 'AEPS withdrawal ₹3,000', amt: 11, icon: Fingerprint },
    { what: 'UPI cash withdrawal ₹2,000', amt: 3, icon: QrCode },
    { what: 'Micro ATM ₹5,000', amt: 9, icon: CreditCard },
    { what: 'PAN application', amt: 5, icon: IdCard },
];
const START = 286;

/** What is waiting behind the sign in: today's commission, growing as the counter works. */
export function TodayDemo() {
    const { ref, tick } = useBeats([2600], 0);
    const n = tick + 3; // the poster already has a morning's work on it
    const rows = Array.from({ length: 3 }, (_, k) => ({ id: n - 1 - k, ...CREDITS[(n - 1 - k) % CREDITS.length] }));
    const total = START + Array.from({ length: n }, (_, i) => CREDITS[i % CREDITS.length].amt).reduce((a, b) => a + b, 0);

    return (
        <div ref={ref}>
            <Well label="Retailer dashboard: today's commission rises as AEPS, UPI and Micro ATM transactions complete.">
                <div className="flex items-end justify-between gap-4 border-b border-[var(--hd-line)] px-5 pb-4 pt-5">
                    <div>
                        <div className="text-[13px] text-[var(--hd-ink-3)]">Commission today</div>
                        <div className="lp-figure mt-1.5 text-[30px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹<Roll value={`${total}.00`} /></div>
                    </div>
                    <span aria-hidden className="mb-1 flex items-center gap-2"><Bar w={40} /><Bar w={28} /></span>
                </div>
                <div className="overflow-hidden px-2 pt-2">
                    <AnimatePresence initial={false}>
                        {rows.map((r) => (
                            <motion.div
                                key={r.id}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 48, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ height: { duration: 0.5, ease: TRAVEL }, opacity: { duration: 0.35, delay: 0.15 } }}
                                className="overflow-hidden"
                            >
                                <div className="flex h-12 items-center gap-3 px-3 text-[14px]">
                                    <r.icon aria-hidden className="size-4 flex-none text-[var(--hd-ink-3)]" strokeWidth={1.75} />
                                    <span className="min-w-0 truncate text-[var(--hd-ink)]">{r.what}</span>
                                    <span className="lp-figure ml-auto flex-none text-[var(--lp-positive)]">+₹{r.amt}.00</span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {[120, 92].map((w, i) => (
                        <div key={i} className="flex h-12 items-center gap-3 px-3">
                            <span className="size-4 flex-none rounded bg-[var(--hd-bar)]" /><Bar w={w} /><span className="ml-auto"><Bar w={48} /></span>
                        </div>
                    ))}
                </div>
            </Well>
        </div>
    );
}

/* ----------------------------------------------------------------- signup */

const STEPS = ['Account', 'KYC & business', 'Branding', 'Review'];

/**
 * The signup as it happens: four steps tick off, the ₹199 fee is paid by UPI,
 * and the account goes to the admin. Beat i means i things are done.
 */
export function SignupDemo() {
    const { ref, step } = useBeats([1100, 900, 900, 900, 900, 1300, 3200], 6);
    const feePaid = step >= 6;
    const paying = step === 5;

    return (
        <div ref={ref}>
            <Well label="Retailer signup: four steps complete, the ₹199 registration fee is paid by UPI, and the account is sent for approval.">
                <div className="px-5 pb-1 pt-5 text-[13px] text-[var(--hd-ink-3)]">Your signup</div>
                <ol className="px-2">
                    {STEPS.map((s, i) => {
                        const done = step > i;
                        return (
                            <li key={s} className="flex h-11 items-center gap-3 px-3 text-[14px]">
                                <Slot
                                    at={done ? 1 : 0}
                                    states={[
                                        [0, <Circle aria-hidden className="size-[18px] text-[var(--hd-line-strong)]" strokeWidth={1.75} />],
                                        [1, <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--lp-positive)]"><Check aria-hidden className="size-3 text-[var(--hd-surface)]" strokeWidth={3} /></span>],
                                    ]}
                                />
                                <span className={`transition-colors duration-300 ${done ? 'text-[var(--hd-ink)]' : 'text-[var(--hd-ink-3)]'}`}>{s}</span>
                            </li>
                        );
                    })}
                </ol>
                <div className="mx-5 mt-2 flex items-center gap-3 rounded-[10px] border border-[var(--hd-line)] px-3 py-3 text-[14px]">
                    <QrCode aria-hidden className="size-4 flex-none text-[var(--hd-ink-3)]" strokeWidth={1.75} />
                    <span className="text-[var(--hd-ink)]">Registration fee</span>
                    <span className="lp-figure text-[var(--hd-ink)]">₹199</span>
                    <Slot
                        className="ml-auto justify-items-end text-[12px]"
                        at={feePaid ? 2 : paying ? 1 : 0}
                        states={[
                            [0, <span className="text-[var(--hd-ink-3)]">Pay by UPI</span>],
                            [1, <span className="inline-flex items-center gap-1 text-[var(--hd-ink-2)]"><Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2} /> Paying</span>],
                            [2, <span className="inline-flex h-6 items-center rounded-full bg-[var(--hd-ok-bg)] px-2 text-[var(--lp-positive)]">Paid</span>],
                        ]}
                    />
                </div>
                <div
                    className="mx-5 mt-3 flex h-10 items-center justify-center rounded-[9px] text-[14px] font-medium transition-colors duration-300"
                    style={feePaid ? { background: 'var(--hd-primary)', color: 'var(--hd-on-primary)' } : { background: 'var(--hd-fill)', color: 'var(--hd-ink-3)' }}
                >
                    <Slot at={feePaid ? 1 : 0} states={[[0, 'Finish the steps to apply'], [1, 'Sent for approval']]} />
                </div>
            </Well>
        </div>
    );
}
