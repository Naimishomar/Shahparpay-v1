import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import HeroDemo from './landing/HeroDemo';
import { BillShot, DmtShot, LeadShot, PanShot, RechargeShot, UpiShot } from './landing/Shots';
import { ARRIVE, TRAVEL } from './landing/beats';
import { isServiceEnabled } from '../lib/services';

/*
 * The landing page's product scenes, brought into the retailer dashboard as a
 * tour of what the counter can earn on. Each scene plays only while it is on
 * screen (and never under reduced motion), opens its service on click, and the
 * whole section folds away for retailers who have seen enough.
 */

type Service = Parameters<typeof isServiceEnabled>[1];
type Scene = { service: Service; to: string; title: string; text: string; shot: ReactNode };

const SCENES: Scene[] = [
    { service: 'aeps', to: '/upi-cash-withdrawal', title: 'UPI cash withdrawal', text: 'Show a QR for the amount, the customer pays from any UPI app, you hand over the cash.', shot: <UpiShot /> },
    { service: 'dmt', to: '/dmt', title: 'Money transfer', text: 'Cash in hand to any bank account over IMPS, with the account holder’s name checked first.', shot: <DmtShot /> },
    { service: 'bbps', to: '/bbps', title: 'Bill payments', text: 'Electricity, water, gas, broadband, FASTag and more on Bharat BillPay, with an instant receipt.', shot: <BillShot /> },
    { service: 'recharge', to: '/recharge', title: 'Mobile and DTH recharge', text: 'Every prepaid operator and DTH provider, with current plans listed while the customer waits.', shot: <RechargeShot /> },
    { service: 'pan', to: '/pan', title: 'PAN card', text: 'New PAN applications and corrections, tracked to the card.', shot: <PanShot /> },
    { service: 'lead', to: '/lead-generation', title: 'Lead generation', text: 'Refer customers for cards, accounts and loans, and earn when the bank approves.', shot: <LeadShot /> },
];

const KEY = 'hideServiceShowcase';

const ServiceShowcase = ({ user }: { user: Parameters<typeof isServiceEnabled>[0] }) => {
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(KEY) !== '1'; } catch { return true; }
    });
    const toggle = () => setOpen((o) => {
        try { localStorage.setItem(KEY, o ? '1' : '0'); } catch { /* the choice just is not remembered */ }
        return !o;
    });

    const aeps = isServiceEnabled(user, 'aeps');
    const scenes = SCENES.filter((s) => isServiceEnabled(user, s.service)).slice(0, 4);
    if (!aeps && scenes.length === 0) return null;

    return (
        <section aria-labelledby="showcase-title" className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 id="showcase-title" className="text-lg font-semibold">Earn more at your counter</h3>
                    <p className="text-sm text-muted-foreground">How each service works, in a few seconds. Open one to start.</p>
                </div>
                <button type="button" onClick={toggle} aria-expanded={open} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                    {open ? 'Hide' : 'Show'}
                    <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="scenes"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: TRAVEL }}
                        className="overflow-hidden"
                    >
                        <div className="hd-scope mt-5 grid gap-4 lg:grid-cols-2">
                            {aeps && (
                                <Link to="/aeps" className="group lg:col-span-2 grid overflow-hidden rounded-[20px] bg-[var(--lp-surface)] outline-offset-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
                                    <div className="p-6 sm:p-8">
                                        <h4 className="text-xl font-medium tracking-[-0.01em] text-[var(--lp-fg)]">AEPS cash withdrawal</h4>
                                        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
                                            Type the amount, the customer scans a finger, the slip prints and your commission lands in the Trade Wallet.
                                        </p>
                                        <Cta>Start AEPS</Cta>
                                    </div>
                                    <div className="p-3 sm:p-4">
                                        <HeroDemo />
                                    </div>
                                </Link>
                            )}
                            {scenes.map((s, i) => (
                                <motion.div
                                    key={s.to}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.25 }}
                                    transition={{ duration: 0.7, ease: ARRIVE, delay: (i % 2) * 0.08 }}
                                >
                                    <Link to={s.to} className="group block h-full rounded-[20px] outline-offset-2">
                                        <article className="hd-tile h-full min-h-[360px]">
                                            <div className="p-6">
                                                <h4 className="text-lg font-medium tracking-[-0.01em] text-[var(--lp-fg)]">{s.title}</h4>
                                                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--lp-fg-2)]">{s.text}</p>
                                                <Cta>Open</Cta>
                                            </div>
                                            <div className="hd-tile__shot">
                                                <div aria-hidden className="hd-window rounded-t-[14px] bg-[var(--hd-surface)] pb-10 transition-transform duration-500 ease-out group-hover:-translate-y-1">{s.shot}</div>
                                            </div>
                                        </article>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

const Cta = ({ children }: { children: ReactNode }) => (
    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--lp-accent-ink)]">
        {children}
        <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </span>
);

export default ServiceShowcase;
