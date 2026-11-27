import React, { useState } from 'react';
import { FileText, Loader2, ArrowUpRight, Wallet, KeyRound, ShieldCheck, ScrollText, RotateCcw, Timer, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PrimaryCta, { Busy } from '../components/PrimaryCta';
import { TitleText } from '../components/BlurText';

// Same black (light) / silver (dark) language as the dashboard.
const SILVER_TILE = 'icon-chip';

const ITR: React.FC = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleLaunchPortal = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/itr/launch`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (res.data.success && res.data.redirect_url) {
                toast.success("ITR portal link generated successfully! Redirecting...");
                window.open(res.data.redirect_url, '_blank');
            } else {
                toast.error(res.data.message || "Failed to launch ITR portal.");
            }
        } catch (error) {
            console.error("ITR Launch Error:", error);
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(
                err.response?.data?.message || 
                "An error occurred while generating the ITR portal URL."
            );
        } finally {
            setLoading(false);
        }
    };

    // The three beats of a filing, and the facts worth knowing, each said once.
    const steps = [
        { icon: KeyRound, title: 'Open the filing module', text: 'A secure single-use link opens eSevaTech in a new tab.' },
        { icon: FileText, title: 'File the return', text: "Fill in and check the client's details there, then submit." },
        { icon: Wallet, title: 'Pay only on success', text: 'Your Utility Wallet is charged when the submission goes through.' },
    ];
    const facts = [
        { icon: Timer, text: 'Each link works once and stays valid for 15 minutes. Open a new one if it expires.' },
        { icon: Wallet, text: 'Your wallet balance is checked during submission, so keep enough in the Utility Wallet.' },
        { icon: RotateCcw, text: 'A rejected return is refunded to your Utility Wallet automatically.' },
        { icon: ShieldCheck, text: 'Check the information carefully before you submit the form.' },
    ];

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="relative flex items-start gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                        <FileText className="h-7 w-7" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="TaxSuite Filing Services" /></h1>
                            <span className="rounded-full border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">eSevaTech partner</span>
                        </div>
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                            Submit and manage Income Tax Returns for your clients through the secure eSevaTech ITR module.
                        </p>
                    </div>
                </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* File a return: how it goes, then the one button. */}
                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-semibold">File an income tax return</h2>
                    <p className="text-sm text-muted-foreground">Three steps, most of them in the eSevaTech module.</p>

                    <ol className="stage-list mt-6 space-y-6">
                        {steps.map(({ icon: Icon, title, text }, i) => (
                            <li key={title} className="relative flex gap-4">
                                {i < steps.length - 1 && <span aria-hidden className="absolute left-[21px] top-12 bottom-[-1.5rem] w-px bg-border" />}
                                <span className={`relative grid size-11 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}>
                                    <Icon className="h-5 w-5" />
                                    <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">{i + 1}</span>
                                </span>
                                <span className="pt-1">
                                    <span className="block font-semibold">{title}</span>
                                    <span className="block text-sm text-muted-foreground">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-8">
                        <PrimaryCta
                            onClick={handleLaunchPortal}
                            disabled={loading}
                            className="group w-full py-4 text-base font-bold"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <Busy text="Generating secure link..." />
                                </>
                            ) : (
                                <>
                                    <span>Open filing module</span>
                                    <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </>
                            )}
                        </PrimaryCta>
                        <p className="mt-2 text-center text-xs text-muted-foreground">Opens in a new tab · the link is valid for 15 minutes</p>
                    </div>
                </section>

                {/* Good to know: each rule once, and where the money shows up. */}
                <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                    <section className="rounded-2xl border bg-card p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Good to know</p>
                        <ul className="mt-4 space-y-3.5">
                            {facts.map(({ icon: Icon, text }) => (
                                <li key={text} className="flex items-start gap-3 text-sm">
                                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                    <span className="pt-1 leading-snug text-muted-foreground">{text}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className="rounded-2xl border bg-card p-2 shadow-sm">
                        {[
                            { to: '/reports/itr', icon: FileText, label: 'ITR reports', hint: 'Every return filed, with its status' },
                            { to: '/reports/wallet-ledger', icon: ScrollText, label: 'Wallet Ledger', hint: 'Every charge and refund' },
                        ].map(({ to, icon: Icon, label, hint }) => (
                            <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{label}</span>
                                    <span className="block text-xs text-muted-foreground">{hint}</span>
                                </span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        ))}
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default ITR;