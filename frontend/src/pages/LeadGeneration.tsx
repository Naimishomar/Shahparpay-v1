import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { CreditCard, UserPlus, Wallet, Briefcase, Zap, PiggyBank, User, Phone, Mail, MapPin, Map as MapIcon, Link2, Loader2, CheckCircle2 } from 'lucide-react';
import { INDIAN_STATES } from '../constants';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const PRODUCTS = [
    { id: 'CC', name: 'Credit Card', hint: 'Cards from top banks', icon: CreditCard },
    { id: 'PL', name: 'Personal Loan', hint: 'For personal needs', icon: Wallet },
    { id: 'BL', name: 'Business Loan', hint: 'Grow a business', icon: Briefcase },
    { id: 'IL', name: 'Instant Loan', hint: 'Quick disbursal', icon: Zap },
    { id: 'SA', name: 'Savings Account', hint: 'Open an account', icon: PiggyBank },
];

const LeadGeneration = () => {
    const { token } = useAuth();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        mobile_no: '',
        email: '',
        product: 'CC',
        pincode: '',
        state: ''
    });


    useEffect(() => {
        fetchHistory();
    }, [token]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/lead/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setLeads(data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load leads history.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLink = (url: string) => {
        try {
            const urlObj = new URL(url);
            const encdata = urlObj.searchParams.get('encdata');

            if (encdata) {
                // PaySprint expects a POST form submission with encdata
                const baseUrl = url.split('?')[0];
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = baseUrl;
                form.target = '_blank';

                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'encdata';
                // URL was already decoded by searchParams.get, but let's be safe
                input.value = encdata;

                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            window.open(url, '_blank');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.mobile_no || !formData.email || !formData.product) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/lead/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Lead generated successfully!");
                setFormData({
                    name: '',
                    mobile_no: '',
                    email: '',
                    product: 'CC',
                    pincode: '',
                    state: ''
                });
                fetchHistory(); // Refresh table

                // If you want to automatically open the URL for the customer:
                if (data.data && data.data.url) {
                    handleOpenLink(data.data.url);
                }
            } else {
                toast.error(data.message || "Failed to generate lead.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred during submission.");
        } finally {
            setSubmitting(false);
        }
    };

    const statusPill = (status?: string) => {
        const s = String(status || 'PENDING').toUpperCase();
        if (s.includes('APPROV') || s.includes('SUCCESS') || s.includes('DISBURS')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20';
        if (s.includes('REJECT') || s.includes('NOT_INTERESTED') || s.includes('FAIL')) return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20';
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20';
    };
    const approvedCount = leads.filter((l) => statusPill(l.executive_status).startsWith('bg-emerald')).length;
    const pendingCount = leads.filter((l) => statusPill(l.executive_status).startsWith('bg-amber')).length;
    const productName = (id: string) => PRODUCTS.find((p) => p.id === id)?.name || id;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <UserPlus className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Lead Generation</h1>
                            <p className="text-sm text-muted-foreground">Generate leads for credit cards, loans and accounts, and track their status.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Total leads', value: leads.length, dot: 'bg-zinc-400' },
                            { label: 'Approved', value: approvedCount, dot: 'bg-emerald-500' },
                            { label: 'In progress', value: pendingCount, dot: 'bg-amber-500' },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5">
                                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                    <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />{stat.label}
                                </p>
                                <p className="text-xl font-bold tabular-nums">{loading ? '…' : stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6">
                {/* New lead */}
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-foreground">Choose a product *</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {PRODUCTS.map(({ id, name, hint, icon: Icon }) => {
                                    const active = formData.product === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, product: id })}
                                            className={`relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all ${active ? 'border-zinc-900 ring-2 ring-zinc-900/10 dark:border-zinc-300 dark:ring-zinc-300/20 shadow-md' : 'bg-background/50 hover:border-zinc-400 dark:hover:border-zinc-600 hover:-translate-y-0.5'}`}
                                        >
                                            {active && <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-emerald-500" />}
                                            <div className={`rounded-xl p-2.5 ${active ? ACTIVE_BUTTON : SILVER_TILE}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{name}</p>
                                                <p className="text-xs text-muted-foreground">{hint}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 border-t pt-6">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Customer details</h2>
                            {[
                                { key: 'name', label: 'Customer Name *', type: 'text', icon: User, placeholder: 'Enter full name', required: true, clean: (v: string) => v },
                                { key: 'mobile_no', label: 'Mobile Number *', type: 'tel', icon: Phone, placeholder: 'Enter 10 digit mobile', required: true, maxLength: 10, clean: (v: string) => v.replace(/\D/g, '') },
                                { key: 'email', label: 'Email ID *', type: 'email', icon: Mail, placeholder: 'Enter email address', required: true, clean: (v: string) => v },
                                { key: 'pincode', label: 'Pincode', type: 'text', icon: MapPin, placeholder: '6 digit pincode', required: false, maxLength: 6, clean: (v: string) => v.replace(/\D/g, '') },
                            ].map((f) => {
                                const Icon = f.icon;
                                return (
                                    <div key={f.key} className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium text-foreground">{f.label}</label>
                                        <div className="relative">
                                            <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type={f.type}
                                                required={f.required}
                                                maxLength={f.maxLength}
                                                value={formData[f.key as keyof typeof formData]}
                                                onChange={(e) => setFormData({ ...formData, [f.key]: f.clean(e.target.value) })}
                                                className={`${INPUT} pl-10`}
                                                placeholder={f.placeholder}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">State</label>
                                <div className="relative">
                                    <MapIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <select
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        className={`${INPUT} pl-10`}
                                    >
                                        <option value="" disabled className="bg-background text-foreground">Select State</option>
                                        {INDIAN_STATES.map((state) => (
                                            <option key={state} value={state} className="bg-background text-foreground">{state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Link2 className="w-5 h-5" />
                                    Generate {productName(formData.product)} Link
                                </>
                            )}
                        </button>
                    </form>
                </section>

            </div>
        </div>
    );
};

export default LeadGeneration;
