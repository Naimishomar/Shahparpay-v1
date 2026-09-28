import { useState } from 'react';
import { ArrowRight, Banknote, ChevronLeft, Clock, History, Loader2, Mail, MapPin, Package, Phone, Power, Receipt, ShieldCheck, Store, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CARD, LABEL, PENDING_PILL, SECONDARY_BUTTON, SILVER_TILE, STATUS_PILL, ago, inr, inrShort, serviceLabel, useApiGet } from '../distributor/shared';
import { Avatar, Skeleton } from '../distributor/ui';
import { SERVICES, type ServiceKey } from '../../lib/services';
import { ActivityList, type Activity } from './ActivityLog';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Detail = {
    role: 'retailer' | 'distributor';
    user: any;
    wallets: { main: number; aeps: number };
    stats: { count: number; success: number; failed: number; volume: number; earned: number; lastTxnAt: string | null };
    recentTransactions: any[];
    activity: Activity[];
    fundRequests: any[];
    retailers: any[];
};

const DocTile = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><p className={LABEL}>{label}</p><span className="font-mono text-sm">{number || '—'}</span></div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="group relative block aspect-[3/2] overflow-hidden rounded-xl border">
                <img src={picture} alt={label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </a>
        ) : <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>}
    </div>
);

const UserDetail = ({
    token, role, id, onBack, onOpenUser, onOpenTransactions,
}: {
    token: string | null;
    role: 'retailer' | 'distributor';
    id: string;
    onBack: () => void;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
    onOpenTransactions: (query: Record<string, string>) => void;
}) => {
    const { data, loading, error, reload } = useApiGet<Detail>(token, `/api/admin/console/users/${role}/${id}`);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmStatus, setConfirmStatus] = useState(false);
    const user = data?.user;
    const active = user?.isActive !== false;
    const disabled: string[] = user?.disabledServices || [];

    const call = async (key: string, path: string, method: string, body: object, ok: string) => {
        setBusy(key);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(ok);
            reload();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Action failed');
        } finally {
            setBusy(null);
        }
    };

    const toggleStatus = () => {
        setConfirmStatus(false);
        call('status', `/api/admin/console/users/${role}/${id}/status`, 'PATCH', { isActive: !active }, active ? 'Account deactivated' : 'Account activated');
    };
    const toggleService = (key: ServiceKey) => {
        const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
        const label = SERVICES.find((s) => s.key === key)?.label;
        call(`svc:${key}`, `/api/admin/console/retailers/${id}/services`, 'PUT', { disabledServices: next }, `${label} switched ${next.includes(key) ? 'off' : 'on'}`);
    };

    if (loading && !data) {
        return <div className="flex flex-col gap-6"><Skeleton className="h-56 rounded-3xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
    }
    if (!data || !user) {
        return (
            <div className={`${CARD} text-center`}>
                <p className="text-sm text-muted-foreground">{error || 'User not found.'}</p>
                <button onClick={onBack} className={`${SECONDARY_BUTTON} mt-4`}><ChevronLeft size={16} /> Back</button>
            </div>
        );
    }

    const address = [user.address?.city, user.address?.district, user.address?.state].filter(Boolean).join(', ');
    const code = user.retailerId || user.distributorId;
    const txnFilter: Record<string, string> = { [role]: id };
    const successRate = data.stats.count ? Math.round((data.stats.success / data.stats.count) * 100) : null;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-8 duration-500">
            <button onClick={onBack} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Back</button>

            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <Avatar name={user.name} src={user.profilePicture} size="w-16 h-16" />
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl md:text-3xl font-bold tracking-tight">{user.name}</h1>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${SILVER_TILE}`}>{role}</span>
                                    <span className="rounded-full border bg-background/70 px-2.5 py-0.5 font-mono text-xs">{code}</span>
                                    {active
                                        ? <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20">Active</span>
                                        : <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20">Inactive</span>}
                                    {role === 'retailer' && (user.isMerchantKycComplete
                                        ? <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20"><ShieldCheck size={12} /> KYC verified</span>
                                        : <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${PENDING_PILL}`}><Clock size={12} /> KYC pending</span>)}
                                    {role === 'retailer' && user.distributorId && (
                                        <button onClick={() => onOpenUser('distributor', user.distributorId._id)} className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2.5 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10">
                                            <Store size={12} /> {user.distributorId.name}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => onOpenTransactions(txnFilter)} className={`${SECONDARY_BUTTON} py-2`}><Receipt size={16} /> All transactions</button>
                            <button
                                onClick={() => setConfirmStatus(true)}
                                disabled={busy === 'status'}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${active ? 'border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            >
                                {busy === 'status' ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                                {active ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        {[
                            ['Main wallet', inr.format(data.wallets.main)],
                            ['AEPS wallet', inr.format(data.wallets.aeps)],
                            [role === 'retailer' ? 'Lifetime volume' : 'Network volume', inrShort(data.stats.volume)],
                            [role === 'retailer' ? 'Commission earned' : 'Commission earned', inr.format(data.stats.earned)],
                            ['Success rate', successRate === null ? '—' : `${successRate}%`],
                            ['Last transaction', data.stats.lastTxnAt ? ago(data.stats.lastTxnAt) : 'Never'],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border bg-background/70 backdrop-blur p-3.5">
                                <p className={LABEL}>{label}</p>
                                <p className="mt-1.5 truncate text-lg font-bold tabular-nums">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {confirmStatus && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold">{active ? `Deactivate ${user.name}?` : `Activate ${user.name}?`}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {active
                            ? 'They are signed out on their next request and cannot sign in again until you reactivate them.'
                            : 'They will be able to sign in and use the platform again.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button onClick={toggleStatus} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Yes, {active ? 'deactivate' : 'activate'}</button>
                        <button onClick={() => setConfirmStatus(false)} className={SECONDARY_BUTTON}>Cancel</button>
                    </div>
                </div>
            )}

            {role === 'retailer' && (
                <section className={CARD}>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Package className="h-4 w-4" /></div>
                            <div>
                                <h2 className="text-lg font-semibold">Services</h2>
                                <p className="text-sm text-muted-foreground">Switched-off services are hidden from this retailer and blocked on the server.</p>
                            </div>
                        </div>
                        <span className={LABEL}>{SERVICES.length - disabled.length} of {SERVICES.length} on</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {SERVICES.map((svc) => {
                            const on = !disabled.includes(svc.key);
                            return (
                                <div key={svc.key} className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
                                    <span className={`text-sm font-semibold ${on ? '' : 'text-muted-foreground'}`}>{svc.label}</span>
                                    <button
                                        role="switch"
                                        aria-checked={on}
                                        aria-label={`${svc.label} ${on ? 'on' : 'off'}`}
                                        disabled={busy !== null}
                                        onClick={() => toggleService(svc.key)}
                                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-zinc-900 dark:bg-zinc-200' : 'bg-black/15 dark:bg-white/15'}`}
                                    >
                                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {role === 'distributor' && (
                <section className={`${CARD} overflow-hidden p-0`}>
                    <div className="flex items-center justify-between p-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Users className="h-4 w-4" /></div>
                            <h2 className="text-lg font-semibold">Retailers ({data.retailers.length})</h2>
                        </div>
                    </div>
                    {data.retailers.length === 0 ? (
                        <p className="px-6 pb-8 text-sm text-muted-foreground">No retailers onboarded yet.</p>
                    ) : (
                        <div className="max-h-[28rem] overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-card">
                                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                        <th className="px-6 py-2 font-medium">Retailer</th>
                                        <th className="px-4 py-2 font-medium text-right">Volume</th>
                                        <th className="px-4 py-2 font-medium text-right">Txns</th>
                                        <th className="px-4 py-2 font-medium">Last txn</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {[...data.retailers].sort((a, b) => b.volume - a.volume).map((r) => (
                                        <tr key={r._id} onClick={() => onOpenUser('retailer', r._id)} className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                                            <td className="px-6 py-2.5">
                                                <p className="font-medium">{r.name}</p>
                                                <p className="font-mono text-[11px] text-muted-foreground">{r.retailerId}</p>
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">{inrShort(r.volume)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground">{ago(r.lastTxnAt)}</td>
                                            <td className="px-4 py-2.5">
                                                {r.isActive === false ? <span className="text-xs font-semibold text-red-600 dark:text-red-400">Inactive</span> : r.isMerchantKycComplete ? <span className="text-xs text-muted-foreground">Active</span> : <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">KYC pending</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            <div className="grid gap-6 lg:grid-cols-5">
                <section className={`${CARD} lg:col-span-3`}>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Recent transactions</h2>
                        <button onClick={() => onOpenTransactions(txnFilter)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">All <ArrowRight size={14} /></button>
                    </div>
                    {data.recentTransactions.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No transactions yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody className="divide-y">
                                    {data.recentTransactions.map((t) => (
                                        <tr key={t._id}>
                                            <td className="py-2.5 pr-3">
                                                <p className="font-medium">{serviceLabel(t.type)}</p>
                                                <p className="text-[11px] text-muted-foreground">{role === 'distributor' ? `${t.userId?.name} · ` : ''}{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>
                                            <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr.format(t.amount)}</td>
                                            <td className="py-2.5 text-right"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_PILL[t.status] || PENDING_PILL}`}>{t.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className={`${CARD} lg:col-span-2`}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><History className="h-4 w-4" /></div>
                        <h2 className="text-lg font-semibold">Activity</h2>
                    </div>
                    {data.activity.length === 0
                        ? <p className="py-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                        : <div className="max-h-[28rem] overflow-auto pr-1"><ActivityList rows={data.activity} onOpenUser={onOpenUser} /></div>}
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className={CARD}>
                    <h2 className="mb-4 text-lg font-semibold">Contact & business</h2>
                    <dl className="space-y-3 text-sm">
                        <div className="flex items-center gap-3"><Mail size={16} className="text-muted-foreground" /><dd className="truncate font-medium">{user.email || '—'}</dd></div>
                        <div className="flex items-center gap-3"><Phone size={16} className="text-muted-foreground" /><dd className="font-medium tabular-nums">{user.contactNumber || '—'}</dd></div>
                        <div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-muted-foreground" /><dd className="font-medium">{[user.businessName, user.businessAddress, address].filter(Boolean).join(' · ') || '—'}</dd></div>
                        <div className="flex items-center gap-3"><Clock size={16} className="text-muted-foreground" /><dd className="text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
                    </dl>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                        <DocTile label="Aadhaar" number={user.aadhaarNumber} picture={user.aadhaarPicture} />
                        <DocTile label="PAN" number={user.panNumber} picture={user.panPicture} />
                    </div>
                </section>

                <section className={CARD}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Banknote className="h-4 w-4" /></div>
                        <h2 className="text-lg font-semibold">Fund requests</h2>
                    </div>
                    {data.fundRequests.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">None.</p>
                    ) : (
                        <ul className="divide-y text-sm">
                            {data.fundRequests.map((f) => (
                                <li key={f._id} className="flex items-center justify-between gap-3 py-2.5">
                                    <div>
                                        <p className="font-semibold tabular-nums">{inr.format(f.amount)}</p>
                                        <p className="text-[11px] text-muted-foreground">{f.transactionMode} · {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                    </div>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${f.status === 'APPROVED' ? STATUS_PILL.SUCCESS : f.status === 'REJECTED' ? STATUS_PILL.FAILED : PENDING_PILL}`}>{f.status}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default UserDetail;
