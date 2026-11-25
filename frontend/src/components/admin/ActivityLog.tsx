import { useState } from 'react';
import {
    Banknote, ChevronLeft, ChevronRight, History, KeyRound, LogIn, Package, Pencil, Search, ShieldAlert, ShieldCheck,
    UserMinus, UserPlus,
} from 'lucide-react';
import { FIELD, ICON_BUTTON, ago, useApiGet } from '../distributor/shared';
import { Empty, PageHeader, Panel, Segmented, Skeleton } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';

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
            <button onClick={() => onOpenUser(role, id)} className="font-medium hover:underline">{name || role}</button>
        ) : (
            <span className="font-medium">{name || role || 'System'}</span>
        );
    return (
        <ol>
            {rows.map((a) => {
                const Icon = iconFor(a.action);
                const warn = WARN.has(a.action);
                return (
                    <li key={a._id} className="flex gap-3 border-b py-3 last:border-0">
                        <Icon aria-hidden strokeWidth={1.75} className={`mt-0.5 size-4 flex-none ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground">
                                {who(a.actorId, a.actorRole, a.actorName)}
                                {a.actorRole && <span className="ml-1.5 text-[12px] text-muted-foreground">{a.actorRole}</span>}
                                <span className="text-muted-foreground"> · </span>
                                {a.summary}
                                {a.targetId && a.targetId !== a.actorId && a.targetName && !a.summary.includes(a.targetName) && (
                                    <> <span className="text-muted-foreground">→</span> {who(a.targetId, a.targetRole, a.targetName)}</>
                                )}
                            </p>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                                {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {ago(a.createdAt)}
                                {a.ip && <span className="lp-figure"> · {a.ip}</span>}
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
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Platform"
                title="Activity log"
                description="Sign-ins, onboarding, edits, service and status changes, fund requests — who did what, and when."
            />

            <Panel flush>
                <div className="flex flex-col gap-3 border-b p-4">
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                        <Segmented label="Event type" size="sm" value={action} onChange={(k) => { setAction(k); setPageNo(1); }} options={FILTERS} />
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPageNo(1); }} className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or description, then press Enter" className={`${FIELD} pl-9`} />
                        </div>
                        <select value={role} onChange={(e) => { setRole(e.target.value); setPageNo(1); }} className={`${FIELD} sm:w-48`} aria-label="Who">
                            <option value="">Anyone</option>
                            <option value="admin">Admins</option>
                            <option value="distributor">Distributors</option>
                            <option value="retailer">Retailers</option>
                        </select>
                    </form>
                </div>

                {error && <div className={`${ALERT_ERROR} m-4`}>{error}</div>}
                <div className="px-5">
                    {loading && !data ? (
                        <div className="space-y-3 py-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                    ) : !data?.rows.length ? (
                        <Empty>No activity recorded yet for this view. New events appear here as they happen.</Empty>
                    ) : (
                        <div className={loading ? 'opacity-50 transition-opacity' : ''}><ActivityList rows={data.rows} onOpenUser={onOpenUser} /></div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t px-5 py-3">
                    <p className="text-[13px] text-muted-foreground">{data ? `${data.total.toLocaleString('en-IN')} events · page ${pageNo} of ${pages}` : ''}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setPageNo(pageNo - 1)} disabled={pageNo <= 1 || loading} className={ICON_BUTTON} aria-label="Previous page"><ChevronLeft size={16} /></button>
                        <button onClick={() => setPageNo(pageNo + 1)} disabled={pageNo >= pages || loading} className={ICON_BUTTON} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </Panel>
        </div>
    );
};

export default ActivityLog;
