import { useState } from 'react';
import { toast } from 'sonner';
import { SERVICES, type ServiceKey } from '../../lib/services';
import { Briefcase, Package, ChevronLeft, Edit2, Link2, Mail, MapPin, Phone, ShieldCheck, Clock, UserCircle, Activity } from 'lucide-react';
import { CARD, LABEL, PENDING_PILL, PRIMARY_BUTTON, type RetailerPerformance, SECONDARY_BUTTON, SILVER_TILE, STATUS_PILL, ago, delta, inr, inrShort, serviceLabel, useDistributorData } from './shared';
import { Avatar, DeltaBadge, RangeSwitch, ShareBar, Skeleton, TrendChart } from './ui';

const DocTile = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
            <p className={LABEL}>{label}</p>
            <span className="font-mono text-sm">{number || '—'}</span>
        </div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="group relative block aspect-[3/2] overflow-hidden rounded-xl border">
                <img src={picture} alt={label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">View full</span>
                </div>
            </a>
        ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>
        )}
    </div>
);

const RetailerDetail = ({
    token,
    retailer,
    days,
    onDaysChange,
    onBack,
    onEdit,
    onKycLink,
    onServicesChanged,
}: {
    token: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    retailer: any;
    days: number;
    onDaysChange: (d: number) => void;
    onBack: () => void;
    onEdit: () => void;
    onKycLink: () => void;
    onServicesChanged: (disabled: string[]) => void;
}) => {
    const { data, loading } = useDistributorData<RetailerPerformance>(token, `/api/distributor/retailers/${retailer._id}/performance`, days);
    const [metric, setMetric] = useState<'earned' | 'volume' | 'count'>('volume');
    const services = [...(data?.byService || [])].sort((a, b) => b.volume - a.volume);
    const serviceMax = Math.max(...services.map((s) => s.volume), 0);
    // The retailer prop is the source of truth (the Edit modal updates it too);
    // `optimistic` only covers the moment a toggle is saving.
    const [optimistic, setOptimistic] = useState<string[] | null>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const disabled: string[] = optimistic ?? retailer.disabledServices ?? [];

    // Saves immediately; the switch flips back if the server refuses.
    const toggleService = async (key: ServiceKey) => {
        const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
        setOptimistic(next);
        setSavingKey(key);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/retailers/${retailer._id}/services`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ disabledServices: next }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            onServicesChanged(json.data.disabledServices);
            const label = SERVICES.find((s) => s.key === key)?.label;
            toast.success(`${label} ${next.includes(key) ? 'switched off' : 'switched on'}`);
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Could not update services');
        } finally {
            setOptimistic(null);
            setSavingKey(null);
        }
    };

    const address = [retailer.address?.city, retailer.address?.district, retailer.address?.state].filter(Boolean).join(', ');

    const kpis = data ? [
        { label: `Your commission · ${days}d`, value: inr.format(data.totals.earned), change: delta(data.totals.earned, data.previous.earned) },
        { label: `Volume · ${days}d`, value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume) },
        { label: `Transactions · ${days}d`, value: data.totals.count.toLocaleString('en-IN'), change: delta(data.totals.count, data.previous.count) },
        { label: 'Lifetime commission', value: inr.format(data.lifetimeEarned), change: null },
    ] : [];

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-8 duration-500">
            <button onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={16} /> Back to retailers
            </button>

            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <Avatar name={retailer.name} src={retailer.profilePicture} size="w-16 h-16" />
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl md:text-3xl font-bold tracking-tight">{retailer.name}</h1>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border bg-background/70 px-2.5 py-0.5 font-mono text-xs">{retailer.retailerId}</span>
                                    {retailer.isMerchantKycComplete ? (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20"><ShieldCheck size={12} /> KYC verified</span>
                                    ) : (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${PENDING_PILL}`}><Clock size={12} /> KYC pending</span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Activity size={12} /> Active {ago(data?.lastActiveAt ?? retailer.lastActiveAt)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <RangeSwitch value={days} onChange={onDaysChange} />
                            {!retailer.isMerchantKycComplete && (
                                <button onClick={onKycLink} className={`${SECONDARY_BUTTON} py-2`}><Link2 size={16} /> KYC link</button>
                            )}
                            <button onClick={onEdit} className={`${PRIMARY_BUTTON} py-2`}><Edit2 size={16} /> Edit details</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {loading && !data
                            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                            : kpis.map(({ label, value, change }) => (
                                <div key={label} className="rounded-2xl border bg-background/70 backdrop-blur p-4">
                                    <p className={LABEL}>{label}</p>
                                    <p className="mt-2 text-xl font-bold tabular-nums truncate">{value}</p>
                                    {change !== null && <div className="mt-1"><DeltaBadge value={change} /></div>}
                                </div>
                            ))}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border bg-background/70 px-3 py-1">Main wallet <b className="tabular-nums">{inr.format(retailer.mainWalletBalance || 0)}</b></span>
                        <span className="rounded-full border bg-background/70 px-3 py-1">AEPS wallet <b className="tabular-nums">{inr.format(retailer.aepsWalletBalance || 0)}</b></span>
                        <span className="rounded-full border bg-background/70 px-3 py-1">Joined <b>{new Date(retailer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b></span>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Daily activity</h2>
                        <div className="inline-flex rounded-xl border bg-background p-1">
                            {([['volume', 'Volume'], ['earned', 'Commission'], ['count', 'Txns']] as const).map(([key, label]) => (
                                <button key={key} onClick={() => setMetric(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${metric === key ? 'bg-black/5 dark:bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : <TrendChart points={data?.trend || []} metric={metric} id={`retailer-${retailer._id}`} />}
                </section>

                <section className={CARD}>
                    <h2 className="mb-4 text-lg font-semibold">Services used</h2>
                    {loading && !data ? (
                        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : services.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No transactions in this range.</p>
                    ) : (
                        <ul className="space-y-3.5">
                            {services.map((s) => (
                                <li key={s.type}>
                                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                        <span className="truncate font-medium">{serviceLabel(s.type)}</span>
                                        <span className="font-semibold tabular-nums">{inrShort(s.volume)}</span>
                                    </div>
                                    <ShareBar value={s.volume} max={serviceMax} />
                                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{s.count} txns{s.earned ? ` · ${inr.format(s.earned)} to you` : ''}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className={CARD}>
                <h2 className="mb-4 text-lg font-semibold">Recent transactions</h2>
                {loading && !data ? (
                    <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : !data?.recent.length ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">This retailer has no transactions yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <th className="pb-3 font-medium">Reference</th>
                                    <th className="pb-3 font-medium">Service</th>
                                    <th className="pb-3 font-medium text-right">Amount</th>
                                    <th className="pb-3 font-medium text-right">Your commission</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.recent.map((t) => (
                                    <tr key={t._id}>
                                        <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{t.transactionId}</td>
                                        <td className="py-3 pr-3">{serviceLabel(t.type)}</td>
                                        <td className="py-3 pr-3 text-right font-semibold tabular-nums">{inr.format(t.amount)}</td>
                                        <td className="py-3 pr-3 text-right tabular-nums">{t.commissions?.distributorEarned ? inr.format(t.commissions.distributorEarned) : '—'}</td>
                                        <td className="py-3 pr-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[t.status] || PENDING_PILL}`}>{t.status}</span></td>
                                        <td className="py-3 text-right whitespace-nowrap text-muted-foreground">{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className={CARD}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Package className="h-4 w-4" /></div>
                        <div>
                            <h2 className="text-lg font-semibold">Services</h2>
                            <p className="text-sm text-muted-foreground">Switched-off services are hidden from this retailer and blocked.</p>
                        </div>
                    </div>
                    <span className={LABEL}>{SERVICES.length - disabled.length} of {SERVICES.length} on</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {SERVICES.map((svc) => {
                        const on = !disabled.includes(svc.key);
                        return (
                            <label key={svc.key} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${on ? 'bg-background' : 'bg-black/[0.02] dark:bg-white/[0.02]'}`}>
                                <div className="min-w-0">
                                    <p className={`text-sm font-semibold ${on ? '' : 'text-muted-foreground'}`}>{svc.label}</p>
                                    <p className="truncate text-xs text-muted-foreground">{svc.hint}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={on}
                                    aria-label={`${svc.label} ${on ? 'on' : 'off'}`}
                                    disabled={savingKey !== null}
                                    onClick={() => toggleService(svc.key)}
                                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-zinc-900 dark:bg-zinc-200' : 'bg-black/15 dark:bg-white/15'}`}
                                >
                                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                </button>
                            </label>
                        );
                    })}
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                    <div className="mb-5 flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><UserCircle className="h-4 w-4" /></div>
                        <h2 className="text-lg font-semibold">Personal info</h2>
                    </div>
                    <dl className="space-y-4 text-sm">
                        <div className="flex items-center gap-3"><Mail size={16} className="text-muted-foreground" /><dd className="truncate font-medium">{retailer.email || '—'}</dd></div>
                        <div className="flex items-center gap-3"><Phone size={16} className="text-muted-foreground" /><dd className="font-medium tabular-nums">{retailer.contactNumber || '—'}</dd></div>
                        <div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-muted-foreground" /><dd className="font-medium">{address || '—'}</dd></div>
                    </dl>
                </section>

                <section className={CARD}>
                    <div className="mb-5 flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Briefcase className="h-4 w-4" /></div>
                        <h2 className="text-lg font-semibold">Business & legal</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className={LABEL}>Business name</p><p className="mt-1 font-medium">{retailer.businessName || '—'}</p></div>
                        <div><p className={LABEL}>Business address</p><p className="mt-1 font-medium">{retailer.businessAddress || '—'}</p></div>
                        {retailer.hasGst && <div className="col-span-2"><p className={LABEL}>GST number</p><p className="mt-1 font-mono">{retailer.gstNumber}</p></div>}
                        <DocTile label="Aadhaar" number={retailer.aadhaarNumber} picture={retailer.aadhaarPicture} />
                        <DocTile label="PAN" number={retailer.panNumber} picture={retailer.panPicture} />
                    </div>
                </section>
            </div>
        </div>
    );
};

export default RetailerDetail;
