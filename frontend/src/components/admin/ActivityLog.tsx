import { useState } from 'react';
import {
    Banknote, ChevronLeft, ChevronRight, History, KeyRound, LogIn, Package, Pencil, Search, ShieldAlert, ShieldCheck,
    UserMinus, UserPlus,
} from 'lucide-react';
import { CARD, INPUT, LABEL, SECONDARY_BUTTON, SILVER_TILE, ago, useApiGet } from '../distributor/shared';
import { Skeleton } from '../distributor/ui';

export type Activity = {
    _id: string;
    action: string;
    actorId?: string;
    actorRole?: string;
    actorName?: string;
    targetId?: string;
    targetRole?: string;
    targetName?: string;
    summary: string;
    ip?: string;
    createdAt: string;
};

const ICONS: Record<string, typeof History> = {
    'auth.login': LogIn,
    'auth.login_failed': ShieldAlert,
    'auth.password_change': KeyRound,
    'auth.password_reset': KeyRound,
    'retailer.create': UserPlus,
    'distributor.create': UserPlus,
    'retailer.update': Pencil,
    'retailer.services': Package,
    'user.activate': ShieldCheck,
    'user.deactivate': UserMinus,
};
const iconFor = (action: string) => ICONS[action] || (action.startsWith('fund_request') ? Banknote : History);
const WARN = new Set(['auth.login_failed', 'user.deactivate', 'fund_request.rejected']);

const FILTERS = [
    ['', 'Everything'],
    ['auth.login', 'Sign-ins'],
    ['auth.login_failed', 'Failed sign-ins'],
    ['auth.password*', 'Password changes'],
    ['retailer.create', 'Onboarding'],
    ['retailer.update', 'Profile edits'],
    ['retailer.services', 'Service changes'],
    ['user.*', 'Account status'],
    ['fund_request*', 'Fund requests'],
] as const;

/** Timeline rows; `onOpenUser` makes the names clickable. */
export const ActivityList = ({ rows, onOpenUser }: { rows: Activity[]; onOpenUser?: (role: 'retailer' | 'distributor', id: string) => void }) => {
    const who = (id?: string, role?: string, name?: string) =>
        onOpenUser && id && (role === 'retailer' || role === 'distributor') ? (
            <button onClick={() => onOpenUser(role, id)} className="font-semibold hover:underline">{name || role}</button>
        ) : (
            <span className="font-semibold">{name || role || 'System'}</span>
        );
    return (
        <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-border">
            {rows.map((a) => {
                const Icon = iconFor(a.action);
                return (
                    <li key={a._id} className="relative flex gap-3 rounded-xl px-1 py-2">
                        <div className={`relative z-10 shrink-0 rounded-xl p-2 ${WARN.has(a.action) ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20' : SILVER_TILE}`}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-sm">
                                {who(a.actorId, a.actorRole, a.actorName)}
                                {a.actorRole && <span className="ml-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{a.actorRole}</span>}
                                <span className="text-muted-foreground"> · </span>
                                {a.summary}
                                {a.targetId && a.targetId !== a.actorId && a.targetName && !a.summary.includes(a.targetName) && (
                                    <> <span className="text-muted-foreground">→</span> {who(a.targetId, a.targetRole, a.targetName)}</>
                                )}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {ago(a.createdAt)}
                                {a.ip && <span className="font-mono"> · {a.ip}</span>}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
};

const ActivityLog = ({ token, onOpenUser }: { token: string | null; onOpenUser: (role: 'retailer' | 'distributor', id: string) => void }) => {
    const [action, setAction] = useState('');
    const [role, setRole] = useState('');
    const [q, setQ] = useState('');
    const [search, setSearch] = useState('');
    const [pageNo, setPageNo] = useState(1);
    const limit = 30;
    const params = new URLSearchParams({ page: String(pageNo), limit: String(limit), ...(action && { action }), ...(role && { role }), ...(search && { q: search }) });
    const { data, loading, error } = useApiGet<{ rows: Activity[]; total: number }>(token, `/api/admin/console/activity?${params}`);
    const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex items-center gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><History className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Activity log</h1>
                        <p className="text-sm text-muted-foreground">Sign-ins, onboarding, edits, service and status changes, fund requests — who did what, and when.</p>
                    </div>
                </div>
            </section>

            <section className={CARD}>
                <div className="mb-5 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map(([key, label]) => (
                            <button
                                key={key || 'all'}
                                onClick={() => { setAction(key); setPageNo(1); }}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${action === key ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPageNo(1); }} className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or description, then press Enter" className={`${INPUT} pl-9`} />
                        </div>
                        <select value={role} onChange={(e) => { setRole(e.target.value); setPageNo(1); }} className={`${INPUT} sm:w-48`} aria-label="Who">
                            <option value="">Anyone</option>
                            <option value="admin">Admins</option>
                            <option value="distributor">Distributors</option>
                            <option value="retailer">Retailers</option>
                        </select>
                    </form>
                </div>

                {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
                {loading && !data ? (
                    <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : !data?.rows.length ? (
                    <p className="py-14 text-center text-sm text-muted-foreground">No activity recorded yet for this view. New events appear here as they happen.</p>
                ) : (
                    <div className={loading ? 'opacity-50 transition-opacity' : ''}><ActivityList rows={data.rows} onOpenUser={onOpenUser} /></div>
                )}

                <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className={LABEL}>{data ? `${data.total.toLocaleString('en-IN')} events · page ${pageNo} of ${pages}` : ''}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={`${SECONDARY_BUTTON} px-3 py-1.5`} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ActivityLog;
