import { useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Mail, MapPin, MessageCircle, Power, Receipt, RefreshCcw, ShieldCheck, LogIn, Trash2, Store, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_DANGER, BUTTON_QUIET, FIELD, TABLE, TD, TH, THEAD, TR, ago, inr, inrShort, serviceLabel, useApiGet } from '../distributor/shared';
import { Avatar, Empty, PageHeader, Panel, Skeleton, StatStrip, StatusDot, TextLink } from '../distributor/ui';
import { SERVICES, aepsKycDone, aepsStepLabel, type ServiceKey } from '../../lib/services';
import { ActivityList, type Activity } from './ActivityLog';
import { useAuth } from '../../context/AuthContext';
import { ALERT_ERROR } from '../landing/ui';

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

/** Small field label, sentence case. */
const LBL = 'text-[13px] text-muted-foreground';

/** One hairline row of a detail list: label left, value right. */
const KV = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b py-2.5 text-sm last:border-0">
        <dt className="flex-none text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
);

const DocTile = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><p className={LBL}>{label}</p><span className="lp-figure text-[13px] text-foreground">{number || '—'}</span></div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="block aspect-[3/2] overflow-hidden rounded-xl border">
                <img src={picture} alt={label} className="h-full w-full object-cover" />
            </a>
        ) : <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">Not uploaded</div>}
    </div>
);

type Reason = { key: string; label: string; subject: string; body: string };

/** Pick a reason and the backend emails the user a ready template; the note is optional. */
const NoticeEmail = ({ token, role, id, email, onDone }: { token: string | null; role: string; id: string; email?: string; onDone: () => void }) => {
    const { data: reasons } = useApiGet<Reason[]>(token, '/api/admin/console/notice-reasons');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const picked = reasons?.find((r) => r.key === reason);

    const send = async () => {
        setSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/users/${role}/${id}/notice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason, note }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(json.message || 'Email sent');
            onDone();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Could not send the email');
        } finally {
            setSending(false);
        }
    };

    if (!email) return <Panel><p className="text-sm text-muted-foreground">This user has no email on file.</p></Panel>;
    return (
        <Panel title="Send an email" description={`To ${email}. Pick a reason; the email is written for you.`}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    {(reasons || []).map((r) => (
                        <button key={r.key} type="button" onClick={() => setReason(r.key)} className={`h-8 rounded-lg border px-3 text-[13px] transition-colors ${reason === r.key ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
                {picked && (
                    <div className="rounded-xl bg-muted/60 p-4 text-sm">
                        <p className="text-foreground">{picked.subject}</p>
                        <p className="mt-1 text-muted-foreground">{picked.body}</p>
                    </div>
                )}
                <label className="flex flex-col gap-1.5">
                    <span className={LBL}>Note (optional)</span>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Anything specific to add, e.g. which document is missing" className={`${FIELD} h-auto py-2.5`} />
                </label>
                <div className="flex gap-2">
                    <button type="button" onClick={send} disabled={!reason || sending} className={BUTTON}>
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} strokeWidth={1.75} />} Send email
                    </button>
                    <button type="button" onClick={onDone} className={BUTTON_QUIET}>Cancel</button>
                </div>
            </div>
        </Panel>
    );
};

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

    const { startImpersonation } = useAuth();
    const [emailing, setEmailing] = useState(false);
    // Opens this user's own portal to fix a problem for them; logged against the admin.
    const loginAs = async () => {
        setBusy('loginAs');
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/users/${role}/${id}/impersonate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            startImpersonation(json.token, json.user);
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Could not sign in as this user');
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

    // Where a retailer stands in AEPS onboarding, asked of the provider when the
    // page opens; the stored step is only as fresh as the retailer's last visit.
    const [checkingAeps, setCheckingAeps] = useState(false);
    const fetchAepsStatus = () =>
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/retailers/${id}/aeps-status`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json());
    const refreshAepsStatus = () => {
        setCheckingAeps(true);
        fetchAepsStatus()
            .then((json) => { if (!json.success) throw new Error(json.message); reload(); })
            .catch((error) => toast.error(error instanceof Error && error.message ? error.message : 'Could not check AEPS status'))
            .finally(() => setCheckingAeps(false));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (role === 'retailer') fetchAepsStatus().then((json) => json.success && reload()).catch(() => {}); }, [id, role]);

    if (loading && !data) {
        return <div className="flex flex-col gap-6"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
    }
    if (!data || !user) {
        return (
            <Panel>
                <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">{error || 'User not found.'}</p>
                    <button type="button" onClick={onBack} className={`${BUTTON_QUIET} mt-4`}><ChevronLeft size={16} /> Back</button>
                </div>
            </Panel>
        );
    }

    const address = [user.address?.city, user.address?.district, user.address?.state].filter(Boolean).join(', ');
    const code = user.retailerId || user.distributorId;
    const txnFilter: Record<string, string> = { [role]: id };
    const successRate = data.stats.count ? Math.round((data.stats.success / data.stats.count) * 100) : null;

    const isRetailer = role === 'retailer';
    const pending = isRetailer && (user.verificationStatus === 'pending' || user.verificationStatus === 'rejected');

    const stats = [
        { label: 'Utility wallet', value: inr.format(data.wallets.main) },
        { label: 'Trade wallet', value: inr.format(data.wallets.aeps) },
        { label: isRetailer ? 'Lifetime volume' : 'Network volume', value: inrShort(data.stats.volume), hint: `${data.stats.count.toLocaleString('en-IN')} txns`, onClick: () => onOpenTransactions(txnFilter) },
        { label: 'Commission earned', value: inr.format(data.stats.earned) },
        { label: 'Success rate', value: successRate === null ? '—' : `${successRate}%`, hint: data.stats.failed ? `${data.stats.failed} failed` : undefined },
        { label: 'Last transaction', value: data.stats.lastTxnAt ? ago(data.stats.lastTxnAt) : 'Never' },
    ];

    // Who they are, said once under the name: role, code, standing.
    const facts: React.ReactNode[] = [
        <span key="role">{isRetailer ? 'Retailer' : 'Distributor'}</span>,
        <span key="code" className="lp-figure">{code}</span>,
        <StatusDot key="active" status={active ? 'ACTIVE' : 'INACTIVE'} />,
    ];
    if (isRetailer && user.verificationStatus === 'pending') facts.push(<StatusDot key="v" status="Awaiting_verification" />);
    if (isRetailer && user.verificationStatus === 'rejected') facts.push(<StatusDot key="v" status="REJECTED" />);
    if (isRetailer && user.signupSource === 'self') facts.push(<span key="self">Self signup · {user.signupFeePaidAt ? 'onboarding charge paid' : 'onboarding charge unpaid'}</span>);

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft size={15} /> Back</button>

            <div className="flex items-start gap-4">
                <Avatar name={user.name} src={user.profilePicture} size="w-14 h-14 text-base" />
                <div className="min-w-0 flex-1">
                    <PageHeader
                        title={<span className="block truncate">{user.name}</span>}
                        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{facts.map((f, i) => <span key={i} className="inline-flex items-center gap-3">{i > 0 && <span aria-hidden className="text-border">·</span>}{f}</span>)}</span>}
                        actions={<>
                            <button type="button" onClick={() => onOpenTransactions(txnFilter)} className={BUTTON_QUIET}><Receipt size={16} strokeWidth={1.75} /> Transactions</button>
                            <button type="button" onClick={() => setEmailing((v) => !v)} className={BUTTON_QUIET}><Mail size={16} strokeWidth={1.75} /> Email</button>
                            {active && (
                                <button type="button" onClick={loginAs} disabled={busy === 'loginAs'} className={BUTTON_QUIET} title="Open their portal to fix a problem; ends after 1 hour">
                                    {busy === 'loginAs' ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} strokeWidth={1.75} />} Login as {role}
                                </button>
                            )}
                            <button type="button" onClick={() => setConfirmStatus(true)} disabled={busy === 'status'} className={active ? BUTTON_DANGER : BUTTON}>
                                {busy === 'status' ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} strokeWidth={1.75} />}
                                {active ? 'Deactivate' : 'Activate'}
                            </button>
                        </>}
                    />
                </div>
            </div>

            {confirmStatus && (
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--lp-warn-line,rgba(217,119,6,0.3))] bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-foreground">{active ? `Deactivate ${user.name}?` : `Activate ${user.name}?`}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            {active
                                ? 'They are signed out on their next request and cannot sign in again until you reactivate them.'
                                : 'They will be able to sign in and use the platform again.'}
                        </p>
                    </div>
                    <div className="flex flex-none gap-2">
                        <button type="button" onClick={toggleStatus} className={active ? BUTTON_DANGER : BUTTON}>Yes, {active ? 'deactivate' : 'activate'}</button>
                        <button type="button" onClick={() => setConfirmStatus(false)} className={BUTTON_QUIET}>Cancel</button>
                    </div>
                </div>
            )}

            {emailing && <NoticeEmail token={token} role={role} id={id} email={user.email} onDone={() => setEmailing(false)} />}

            {pending && (
                <VerificationCard token={token} user={user} busy={busy === 'verify'} onDecide={(body, ok) => call('verify', `/api/admin/console/retailers/${id}/verification`, 'PATCH', body, ok)} onDeleted={onBack} id={id} />
            )}

            <StatStrip items={stats} cols={6} />

            <div className="grid gap-6 xl:grid-cols-3">
                {/* Main column: what they do */}
                <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
                    {isRetailer && (
                        <Panel
                            title="Services"
                            description="Switched-off services are hidden from this retailer and blocked on the server."
                            action={<span className="text-[13px] text-muted-foreground"><span className="lp-figure text-foreground">{SERVICES.length - disabled.length}</span> of {SERVICES.length} on</span>}
                            flush
                        >
                            <ul className="grid sm:grid-cols-2">
                                {SERVICES.map((svc) => {
                                    const on = !disabled.includes(svc.key);
                                    return (
                                        <li key={svc.key} className="flex min-h-12 items-center justify-between gap-3 border-b px-5 py-2.5 sm:odd:border-r">
                                            <span className={`text-sm ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{svc.label}</span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={on}
                                                aria-label={`${svc.label} ${on ? 'on' : 'off'}`}
                                                disabled={busy !== null}
                                                onClick={() => toggleService(svc.key)}
                                                className={`relative h-5 w-9 flex-none rounded-full transition-colors duration-200 disabled:opacity-60 ${on ? 'bg-primary' : 'bg-input'}`}
                                            >
                                                <span className="absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left] duration-200" style={{ left: on ? 18 : 2 }} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </Panel>
                    )}

                    {role === 'distributor' && (
                        <Panel title="Retailers" description={`${data.retailers.length} onboarded`} flush>
                            {data.retailers.length === 0 ? (
                                <Empty>No retailers onboarded yet.</Empty>
                            ) : (
                                <div className="max-h-[28rem] overflow-auto">
                                    <table className={TABLE}>
                                        <thead className="sticky top-0 bg-card">
                                            <tr className={THEAD}>
                                                <th className={TH}>Retailer</th>
                                                <th className={`${TH} text-right`}>Volume</th>
                                                <th className={`${TH} text-right`}>Txns</th>
                                                <th className={TH}>Last txn</th>
                                                <th className={TH}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...data.retailers].sort((a, b) => b.volume - a.volume).map((r) => (
                                                <tr key={r._id} onClick={() => onOpenUser('retailer', r._id)} className={`${TR} cursor-pointer`}>
                                                    <td className={TD}>
                                                        <p className="text-foreground">{r.name}</p>
                                                        <p className="lp-figure text-[12px] text-muted-foreground">{r.retailerId}</p>
                                                    </td>
                                                    <td className={`${TD} lp-figure text-right`}>{inrShort(r.volume)}</td>
                                                    <td className={`${TD} lp-figure text-right`}>{r.count}</td>
                                                    <td className={`${TD} text-muted-foreground`}>{ago(r.lastTxnAt)}</td>
                                                    <td className={TD}>
                                                        {r.isActive === false ? <StatusDot status="INACTIVE" /> : aepsKycDone(r) ? <StatusDot status="ACTIVE" /> : <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground"><span aria-hidden className="size-1.5 rounded-full bg-amber-500" />{aepsStepLabel(r)}</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Panel>
                    )}

                    <Panel title="Recent transactions" action={<TextLink onClick={() => onOpenTransactions(txnFilter)}>All</TextLink>} flush>
                        {data.recentTransactions.length === 0 ? (
                            <Empty>No transactions yet.</Empty>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={TABLE}>
                                    <tbody>
                                        {data.recentTransactions.map((t) => (
                                            <tr key={t._id} className={TR}>
                                                <td className={TD}>
                                                    <p className="text-foreground">{serviceLabel(t.type)}</p>
                                                    <p className="text-[12px] text-muted-foreground">{role === 'distributor' ? `${t.userId?.name} · ` : ''}{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                </td>
                                                <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(t.amount)}</td>
                                                <td className={`${TD} text-right`}><StatusDot status={t.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Activity">
                        {data.activity.length === 0
                            ? <Empty>No activity recorded yet.</Empty>
                            : <div className="max-h-[28rem] overflow-auto pr-1"><ActivityList rows={data.activity} onOpenUser={onOpenUser} /></div>}
                    </Panel>
                </div>

                {/* Side column: who they are */}
                <div className="flex min-w-0 flex-col gap-6">
                    {isRetailer && (
                        <Panel
                            title="AEPS onboarding"
                            action={
                                <button type="button" onClick={refreshAepsStatus} disabled={checkingAeps} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-60" title="Check AEPS onboarding with the provider now">
                                    <RefreshCcw size={13} className={checkingAeps ? 'animate-spin' : ''} />
                                    {checkingAeps ? 'Checking…' : user.icchhamatiAeps?.stepAt ? `Checked ${ago(user.icchhamatiAeps.stepAt)}` : 'Check status'}
                                </button>
                            }
                        >
                            <p className="flex items-center gap-2 text-sm text-foreground">
                                {aepsKycDone(user)
                                    ? <><ShieldCheck size={16} className="text-[var(--lp-positive)]" /> KYC verified</>
                                    : <><span aria-hidden className="size-1.5 rounded-full bg-amber-500" /> {aepsStepLabel(user)}</>}
                            </p>
                        </Panel>
                    )}

                    {isRetailer && !pending && (
                        <DistributorCard token={token} user={user} busy={busy === 'distributor'} onSave={(distributorId) => call('distributor', `/api/admin/console/retailers/${id}/distributor`, 'PATCH', { distributorId }, 'Distributor updated')} />
                    )}

                    {isRetailer && pending && user.distributorId && (
                        <Panel title="Distributor">
                            <button type="button" onClick={() => onOpenUser('distributor', user.distributorId._id)} className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"><Store size={15} className="text-muted-foreground" /> {user.distributorId.name}</button>
                        </Panel>
                    )}

                    <Panel title="Contact and business">
                        <dl>
                            <KV label="Email"><span className="block truncate">{user.email || '—'}</span></KV>
                            <KV label="Mobile">
                                <span className="inline-flex items-center gap-3">
                                    <span className="lp-figure">{user.contactNumber || '—'}</span>
                                    {user.contactNumber && (
                                        <a href={`https://wa.me/91${String(user.contactNumber).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi ${user.name}, this is Shahparpay.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-[var(--lp-positive)] hover:underline">
                                            <MessageCircle size={14} /> WhatsApp
                                        </a>
                                    )}
                                </span>
                            </KV>
                            {isRetailer && user.distributorId && !pending && (
                                <KV label="Distributor">
                                    <button type="button" onClick={() => onOpenUser('distributor', user.distributorId._id)} className="hover:underline">{user.distributorId.name}</button>
                                </KV>
                            )}
                            <KV label="Business">{[user.businessName, user.businessAddress, address].filter(Boolean).join(' · ') || '—'}</KV>
                            <KV label="Joined">{new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</KV>
                        </dl>
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            <DocTile label="Aadhaar" number={user.aadhaarNumber} picture={user.aadhaarPicture} />
                            <DocTile label="PAN" number={user.panNumber} picture={user.panPicture} />
                            <DocTile label="Photo" picture={user.profilePicture} />
                        </div>
                    </Panel>

                    {isRetailer && user.icchhamatiAeps?.outletId && !aepsKycDone(user) && (
                        <AepsAddressCard id={id} token={token} user={user} onSaved={reload} />
                    )}

                    <Panel title="Fund requests" flush>
                        {data.fundRequests.length === 0 ? (
                            <Empty>None.</Empty>
                        ) : (
                            <ul>
                                {data.fundRequests.map((f) => (
                                    <li key={f._id} className="flex items-center justify-between gap-3 border-b px-5 py-3 last:border-0">
                                        <div>
                                            <p className="lp-figure text-sm text-foreground">{inr.format(f.amount)}</p>
                                            <p className="text-[12px] text-muted-foreground">{f.transactionMode} · {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                        </div>
                                        <StatusDot status={f.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default UserDetail;

/** Adds or changes an approved retailer's distributor. Only a self signup may be left under the admin. */
const DistributorCard = ({ token, user, busy, onSave }: { token: string | null; user: any; busy: boolean; onSave: (distributorId: string | null) => void }) => {
    const { data: distributors } = useApiGet<any[]>(token, '/api/admin/distributors');
    const current = user.distributorId?._id || '';
    const [distributorId, setDistributorId] = useState(current);
    useEffect(() => setDistributorId(current), [current]);
    const canBeUnderAdmin = user.signupSource === 'self';

    return (
        <Panel title="Distributor" description={current ? 'Move this retailer to another distributor.' : 'Directly under the admin. Add a distributor any time.'}>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                    <span className={LBL}>Place under</span>
                    <select className={FIELD} value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
                        {(canBeUnderAdmin || !current) && <option value="">No distributor (under admin)</option>}
                        {(distributors || []).map((d) => <option key={d._id} value={d._id}>{d.name} ({d.distributorId})</option>)}
                    </select>
                </label>
                <button type="button" onClick={() => onSave(distributorId || null)} disabled={busy || distributorId === current} className={`${BUTTON} w-full`}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} strokeWidth={1.75} />} Save
                </button>
            </div>
        </Panel>
    );
};

/**
 * Approve or reject a self signup. Approving places the retailer under the
 * chosen distributor, or directly under the admin; the reject reason is shown
 * to the retailer.
 */
const VerificationCard = ({ id, token, user, busy, onDecide, onDeleted }: { id: string; token: string | null; user: any; busy: boolean; onDecide: (body: object, ok: string) => void; onDeleted: () => void }) => {
    const { data: distributors } = useApiGet<any[]>(token, '/api/admin/distributors');
    const [deleting, setDeleting] = useState(false);
    const [typed, setTyped] = useState('');
    const [removing, setRemoving] = useState(false);

    // Irreversible: the admin types the retailer ID to confirm.
    const remove = async () => {
        setRemoving(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/retailers/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success('Retailer and all their data deleted');
            onDeleted();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Delete failed');
        } finally {
            setRemoving(false);
        }
    };
    const [distributorId, setDistributorId] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [note, setNote] = useState('');

    return (
        <Panel
            className="border-amber-500/40"
            title={user.verificationStatus === 'rejected' ? 'Signup rejected' : 'Verify this signup'}
            description="Check the documents and shop address. Until approved, the retailer can sign in but use nothing."
        >
            {user.verificationStatus === 'rejected' && user.verificationNote && (
                <div className={`${ALERT_ERROR} mb-4`}>
                    <p className="text-[12px] opacity-80">Reason given</p>
                    <p className="mt-1 whitespace-pre-wrap">{user.verificationNote}</p>
                </div>
            )}
            {rejecting ? (
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5">
                        <span className={LBL}>Reason (the retailer sees this)</span>
                        <textarea className={`${FIELD} h-auto min-h-24 py-2.5`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Aadhaar photo is blurry; please contact support with a clear copy." autoFocus />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => onDecide({ status: 'rejected', note: note.trim() }, 'Signup rejected')}
                            disabled={busy || !note.trim()}
                            className={BUTTON_DANGER}
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject signup
                        </button>
                        <button type="button" onClick={() => setRejecting(false)} className={BUTTON_QUIET}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <label className="flex flex-1 flex-col gap-1.5">
                        <span className={LBL}>Place under</span>
                        <select className={FIELD} value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
                            <option value="">No distributor (under admin)</option>
                            {(distributors || []).map((d) => <option key={d._id} value={d._id}>{d.name} ({d.distributorId})</option>)}
                        </select>
                    </label>
                    <button onClick={() => onDecide({ status: 'approved', distributorId: distributorId || null }, 'Retailer approved')} disabled={busy || (user.signupSource === 'self' && !user.signupFeePaidAt)} title={user.signupSource === 'self' && !user.signupFeePaidAt ? 'The ₹99 onboarding charge is not paid yet' : undefined} className={BUTTON}>
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Approve
                    </button>
                    {user.verificationStatus !== 'rejected' && (
                        <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={BUTTON_QUIET}><XCircle size={16} strokeWidth={1.75} /> Reject</button>
                    )}
                    <button onClick={() => setDeleting(true)} disabled={busy || removing} className={BUTTON_DANGER}><Trash2 size={16} strokeWidth={1.75} /> Delete</button>
                </div>
            )}
            {deleting && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--lp-danger-line)] bg-[var(--lp-danger-soft)] p-4">
                    <p className="text-sm text-[var(--lp-danger)]">This permanently deletes {user.name}'s account, wallets, transactions (including the onboarding charge), banks, tickets and logs. It cannot be undone. Type <span className="lp-figure">{user.retailerId}</span> to confirm.</p>
                    <input className={FIELD} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={user.retailerId} autoFocus />
                    <div className="flex flex-wrap gap-2">
                        <button onClick={remove} disabled={removing || typed.trim() !== user.retailerId} className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[var(--lp-danger)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                            {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete everything
                        </button>
                        <button type="button" onClick={() => { setDeleting(false); setTyped(''); }} className={BUTTON_QUIET}>Cancel</button>
                    </div>
                </div>
            )}
        </Panel>
    );
};

/**
 * Corrects the shop address on the retailer's Icchhamati AEPS draft. The
 * retailer cannot reopen the Shop & bank step, and Icchhamati refuses to
 * activate a merchant whose address fails its validation.
 */
const AepsAddressCard = ({ id, token, user, onSaved }: { id: string; token: string | null; user: any; onSaved: () => void }) => {
    const [form, setForm] = useState({
        shop_address: user.businessAddress || '',
        shop_city: user.address?.city || '',
        shop_district: user.address?.district || '',
        shop_pin_code: user.address?.pincode || '',
    });
    const [saving, setSaving] = useState(false);
    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/console/retailers/${id}/aeps-address`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(json.message || 'Shop address updated');
            onSaved();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Could not update the address');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Panel
            title="AEPS shop address"
            description={<>Corrects the address on outlet <span className="lp-figure">{user.icchhamatiAeps.outletId}</span> at Icchhamati, when activation fails validation. Only before AEPS is activated.</>}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className={LBL}>Shop address</span>
                    <input className={FIELD} value={form.shop_address} onChange={set('shop_address')} placeholder="Shop number, street, area" />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LBL}>City</span>
                    <input className={FIELD} value={form.shop_city} onChange={set('shop_city')} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LBL}>District</span>
                    <input className={FIELD} value={form.shop_district} onChange={set('shop_district')} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LBL}>Pincode</span>
                    <input className={`${FIELD} lp-figure`} inputMode="numeric" value={form.shop_pin_code} onChange={(e) => setForm({ ...form, shop_pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                </label>
                <div className="flex items-end">
                    <button type="button" onClick={save} disabled={saving} className={`${BUTTON} w-full`}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                        {saving ? 'Saving…' : 'Update on Icchhamati'}
                    </button>
                </div>
            </div>
        </Panel>
    );
};
