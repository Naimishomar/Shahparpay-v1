import React, { useState } from 'react';
import { FileText, Loader2, ArrowUpRight, CheckCircle2, AlertCircle, Wallet, KeyRound, ClipboardCheck, ShieldCheck, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';

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

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <FileText className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">ITR Filing Services</h1>
                                <span className="rounded-full border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">eSevaTech partner</span>
                            </div>
                            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                                Submit and manage Income Tax Returns for your clients through the secure eSevaTech ITR module.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleLaunchPortal}
                        disabled={loading}
                        className={`group flex shrink-0 items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed ${ACTIVE_BUTTON}`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Generating secure link...</span>
                            </>
                        ) : (
                            <>
                                <span>Open Filing Module</span>
                                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </>
                        )}
                    </button>
                </div>
            </section>

            {/* How it works */}
            <section className="grid gap-4 md:grid-cols-3">
                {[
                    { icon: KeyRound, title: 'Launch securely', text: 'A single-use token opens the eSevaTech module in a new tab. It stays valid for 15 minutes.' },
                    { icon: FileText, title: 'File the return', text: "Fill in and validate the client's details in the portal, then submit." },
                    { icon: Wallet, title: 'Pay on success', text: 'Your Main Wallet is charged only on a successful submission. Rejections are refunded automatically.' },
                ].map(({ icon: Icon, title, text }, i) => (
                    <div key={title} className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
                        <span aria-hidden className="pointer-events-none absolute -right-2 -top-4 text-7xl font-black text-black/[0.04] dark:text-white/[0.05]">{i + 1}</span>
                        <div className={`mb-3 inline-flex rounded-xl p-2.5 ${SILVER_TILE}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <p className="font-semibold">{title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                    </div>
                ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Guidelines */}
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                        <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                        Guidelines & Rules
                    </h3>
                    <ul className="space-y-3">
                        {[
                            { ok: true, text: 'Wallet balance checks run automatically during submission.' },
                            { ok: true, text: 'Each single-use token is valid for 15 minutes.' },
                            { ok: true, text: 'Validate information carefully before submitting the form.' },
                            { ok: false, text: 'Refunds for rejected requests are credited to your Main Wallet automatically.' },
                        ].map(({ ok, text }) => (
                            <li key={text} className="flex items-start gap-3 rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground">
                                <div className={`shrink-0 rounded-full p-1 ring-1 ${ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20'}`}>
                                    {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                </div>
                                <span className="pt-0.5">{text}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Security */}
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-6 text-white shadow-lg dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                    <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl dark:bg-white/40" />
                    <div className="relative flex h-full flex-col gap-4">
                        <div className="inline-flex w-max rounded-xl bg-white/10 p-2.5 ring-1 ring-white/20 dark:bg-black/10 dark:ring-black/10">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold">Secure filing</h4>
                            <p className="mt-2 text-sm leading-relaxed opacity-80">
                                ITR filing through eSevaTech uses secure single-use tokens. Your Main Wallet is only charged upon successful submission.
                            </p>
                        </div>
                        <p className="mt-auto flex items-center gap-2 border-t border-white/15 pt-4 text-xs opacity-70 dark:border-black/10">
                            <ScrollText className="h-4 w-4 shrink-0" />
                            Every transaction is logged in your Wallet Ledger.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ITR;