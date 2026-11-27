import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '../context/AuthContext';
import PrimaryCta from '../components/PrimaryCta';
import { toast } from 'sonner';
import { CreditCard, UserPlus, Wallet, Briefcase, Zap, PiggyBank, User, Phone, Mail, MapPin, Map as MapIcon, Link2, Loader2, ExternalLink, ArrowRight, Inbox } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { INDIAN_STATES } from '../constants';
import { TitleText } from '../components/BlurText';

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'btn-primary';
const SILVER_TILE = 'icon-chip';
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
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Hero */}
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <UserPlus className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight"><TitleText text="Lead Generation" /></h1>
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

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* New lead: the product first, then who it is for. */}
                <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-7">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-semibold">
                                <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                                Product
                            </p>
                            <div role="radiogroup" aria-label="Product" className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                                {PRODUCTS.map(({ id, name, hint, icon: Icon }) => {
                                    const active = formData.product === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setFormData({ ...formData, product: id })}
                                            className={`group relative flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${active ? 'border-transparent bg-background' : 'bg-background/50 hover:-translate-y-0.5 hover:shadow-md'}`}
                                        >
                                            {/* The ring slides to the chosen product. */}
                                            {active && <motion.span layoutId="lead-product" aria-hidden transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }} className="absolute inset-0 rounded-xl ring-2 ring-primary" />}
                                            <span className={`grid size-10 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 ${active ? ACTIVE_BUTTON : SILVER_TILE}`}>
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-semibold leading-tight">{name}</span>
                                                <span className="block text-xs text-muted-foreground">{hint}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="flex items-center gap-2 text-sm font-semibold">
                                <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                                Customer details
                            </p>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                {[
                                    { key: 'name', label: 'Full name', type: 'text', icon: User, placeholder: 'Customer’s full name', required: true, clean: (v: string) => v },
                                    { key: 'mobile_no', label: 'Mobile number', type: 'tel', icon: Phone, placeholder: '10-digit mobile', required: true, maxLength: 10, clean: (v: string) => v.replace(/\D/g, '') },
                                    { key: 'email', label: 'Email', type: 'email', icon: Mail, placeholder: 'name@example.com', required: true, clean: (v: string) => v, wide: true },
                                    { key: 'pincode', label: 'Pincode', type: 'text', icon: MapPin, placeholder: '6-digit pincode', required: false, maxLength: 6, clean: (v: string) => v.replace(/\D/g, '') },
                                ].map((f) => {
                                    const Icon = f.icon;
                                    return (
                                        <div key={f.key} className={cn('flex flex-col gap-1.5', f.wide && 'sm:col-span-2')}>
                                            <label htmlFor={`lead-${f.key}`} className="text-sm font-medium text-foreground">
                                                {f.label}{f.required ? <span className="text-rose-500"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
                                            </label>
                                            <div className="relative">
                                                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <input
                                                    id={`lead-${f.key}`}
                                                    type={f.type}
                                                    required={f.required}
                                                    maxLength={f.maxLength}
                                                    value={formData[f.key as keyof typeof formData]}
                                                    onChange={(e) => setFormData({ ...formData, [f.key]: f.clean(e.target.value) })}
                                                    className={cn(INPUT, 'h-11 pl-10')}
                                                    placeholder={f.placeholder}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="lead-state" className="text-sm font-medium text-foreground">State <span className="font-normal text-muted-foreground">(optional)</span></label>
                                    <div className="relative">
                                        <MapIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                                            <SelectTrigger id="lead-state" className={cn(INPUT, 'h-11 pl-10 data-[size=default]:h-11')}>
                                                <SelectValue placeholder="Select state" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="z-[110] max-h-72">
                                                {INDIAN_STATES.map((state) => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <PrimaryCta disabled={submitting} className="w-full font-semibold">
                                {submitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Link2 className="w-5 h-5" />
                                        Generate {productName(formData.product)} link
                                    </>
                                )}
                            </PrimaryCta>
                            <p className="mt-2 text-center text-xs text-muted-foreground">The application opens in a new tab for the customer to complete.</p>
                        </div>
                    </form>
                </section>

                {/* Recent leads: their status, and the application link to open again. */}
                <aside className="rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent leads</p>
                        <Link to="/reports/lead-generation" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                            View all <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />)}</div>
                    ) : leads.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                            <Inbox className="mb-2 h-8 w-8 opacity-60" />
                            <p className="text-sm">No leads yet. Your first one shows up here.</p>
                        </div>
                    ) : (
                        <ul className="stage-list mt-3 divide-y">
                            {leads.slice(0, 6).map((lead: any) => {
                                const Icon = PRODUCTS.find((p) => p.id === lead.product)?.icon || UserPlus;
                                return (
                                    <li key={lead._id || lead.refid} className="flex items-center gap-3 py-3">
                                        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${SILVER_TILE}`}><Icon className="h-4 w-4" /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{lead.name || 'Customer'}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{productName(lead.product)}{lead.mobile_no ? ` · ${lead.mobile_no}` : ''}</span>
                                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusPill(lead.executive_status)}`}>
                                                {String(lead.executive_status || 'Pending').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())}
                                            </span>
                                        </span>
                                        {lead.url && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenLink(lead.url)}
                                                aria-label={`Open the application for ${lead.name || 'this lead'}`}
                                                title="Open the application"
                                                className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default LeadGeneration;
