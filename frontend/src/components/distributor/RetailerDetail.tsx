import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SERVICES, aepsKycDone, aepsStepLabel, type ServiceKey } from '../../lib/services';
import { ChevronLeft, Edit2, RefreshCcw } from 'lucide-react';
import { BUTTON, TABLE, TD, TH, THEAD, TR, type RetailerPerformance, ago, delta, inr, inrShort, serviceLabel, useDistributorData } from './shared';
import { Avatar, Empty, PageHeader, Panel, RangeSwitch, Segmented, ShareBar, Skeleton, StatStrip, StatusDot, TrendChart } from './ui';
import { txnRef } from "@/lib/txnRef";

const DocTile = ({ label, number, picture }: { label: string; number?: string; picture?: string }) => (
    <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
            <p className="text-muted-foreground">{label}</p>
            <span className="lp-figure text-foreground">{number || '—'}</span>
        </div>
        {picture ? (
            <a href={picture} target="_blank" rel="noreferrer" className="group relative block aspect-[3/2] overflow-hidden rounded-xl border">
                <img src={picture} alt={label} className="h-full w-full object-cover" />
                <span className="absolute bottom-2 right-2 rounded-md bg-card px-2 py-1 text-[12px] text-foreground opacity-0 transition-opacity group-hover:opacity-100">View full</span>
            </a>
        ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Not uploaded</div>
        )}
    </div>
);

/** A hairline key/value row: label muted on the left, value on the right. */
const KV = ({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) => (
    <div className="flex items-baseline justify-between gap-4 border-b px-5 py-3 text-sm last:border-0">
        <dt className="flex-none text-muted-foreground">{label}</dt>
        <dd className={`min-w-0 text-right text-foreground ${mono ? 'lp-figure' : ''}`}>{children}</dd>
    </div>
);

const RetailerDetail = ({
    token,
    retailer,
    days,
    onDaysChange,
    onBack,
    onEdit,
    onServicesChanged,
}: {
    token: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    retailer: any;
    days: number;
    onDaysChange: (d: number) => void;
    onBack: () => void;
    onEdit: () => void;
    onServicesChanged: (patch: { disabledServices?: string[]; icchhamatiAeps?: { step: string; stepAt: string } }) => void;
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
            onServicesChanged({ disabledServices: json.data.disabledServices });
            const label = SERVICES.find((s) => s.key === key)?.label;
            toast.success(`${label} ${next.includes(key) ? 'switched off' : 'switched on'}`);
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Could not update services');
        } finally {
            setOptimistic(null);
            setSavingKey(null);
        }
    };

    // Where the retailer stands in AEPS onboarding, asked of the provider each
    // time the page opens: the stored step is only as fresh as their last visit.
    const [checkingAeps, setCheckingAeps] = useState(false);
    const fetchAepsStatus = () =>
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/retailers/${retailer._id}/aeps-status`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then((res) => res.json());
    const applyAepsStatus = (json: { success: boolean; message?: string; data?: { step: string; checkedAt: string } }) => {
        if (!json.success || !json.data) throw new Error(json.message);
        onServicesChanged({ icchhamatiAeps: { step: json.data.step, stepAt: json.data.checkedAt } });
    };
    const refreshAepsStatus = () => {
        setCheckingAeps(true);
        fetchAepsStatus()
            .then(applyAepsStatus)
            .catch((error) => toast.error(error instanceof Error && error.message ? error.message : 'Could not check AEPS status'))
            .finally(() => setCheckingAeps(false));
    };
    // A failed background check stays quiet; the stored step is still shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchAepsStatus().then(applyAepsStatus).catch(() => {}); }, [retailer._id]);

    const address = [retailer.address?.city, retailer.address?.district, retailer.address?.state].filter(Boolean).join(', ');

    const kpis = data ? [
        { label: `Your commission · ${days}d`, value: inr.format(data.totals.earned), change: delta(data.totals.earned, data.previous.earned) },
        { label: `Volume · ${days}d`, value: inrShort(data.totals.volume), change: delta(data.totals.volume, data.previous.volume) },
        { label: `Transactions · ${days}d`, value: data.totals.count.toLocaleString('en-IN'), change: delta(data.totals.count, data.previous.count) },
        { label: 'Lifetime commission', value: inr.format(data.lifetimeEarned) },
    ] : [];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ChevronLeft size={16} strokeWidth={1.75} /> Back to retailers
            </button>

            <PageHeader
                eyebrow={
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="lp-figure text-foreground">{retailer.retailerId}</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className={`size-1.5 rounded-full ${aepsKycDone(retailer) ? 'bg-[var(--lp-positive)]' : 'bg-amber-500'}`} />
                            {aepsKycDone(retailer) ? 'KYC verified' : aepsStepLabel(retailer)}
                        </span>
                        <button type="button" onClick={refreshAepsStatus} disabled={checkingAeps} className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-60" title="Check AEPS onboarding with the provider now">
                            <RefreshCcw size={12} className={checkingAeps ? 'animate-spin' : ''} />
                            {checkingAeps ? 'Checking…' : retailer.icchhamatiAeps?.stepAt ? `Checked ${ago(retailer.icchhamatiAeps.stepAt)}` : 'Check status'}
                        </button>
                    </span>
                }
                title={<span className="inline-flex items-center gap-4"><Avatar name={retailer.name} src={retailer.profilePicture} size="w-12 h-12" /><span className="truncate">{retailer.name}</span></span>}
                description={`Active ${ago(data?.lastActiveAt ?? retailer.lastActiveAt).toLowerCase()} · joined ${new Date(retailer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                actions={<>
                    <RangeSwitch value={days} onChange={onDaysChange} />
                    <button type="button" onClick={onEdit} className={BUTTON}><Edit2 size={16} strokeWidth={1.75} /> Edit details</button>
                </>}
            />

            <StatStrip items={kpis} loading={loading} />

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
                    <Panel
                        title="Daily activity"
                        description={`Last ${days} days. Hover for a day.`}
                        action={<Segmented label="Chart metric" size="sm" value={metric} onChange={setMetric} options={[['volume', 'Volume'], ['earned', 'Commission'], ['count', 'Txns']] as const} />}
                    >
                        {loading && !data ? <Skeleton className="h-44 rounded-xl" /> : data?.trend.length ? <TrendChart points={data.trend} metric={metric} id={`retailer-${retailer._id}`} /> : <Empty>No transactions in this range.</Empty>}
                    </Panel>

                    <Panel title="Recent transactions" flush>
                        {loading && !data ? (
                            <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                        ) : !data?.recent.length ? (
                            <Empty>This retailer has no transactions yet.</Empty>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={TABLE}>
                                    <thead>
                                        <tr className={THEAD}>
                                            <th className={TH}>Reference</th>
                                            <th className={TH}>Service</th>
                                            <th className={`${TH} text-right`}>Amount</th>
                                            <th className={`${TH} text-right`}>Your commission</th>
                                            <th className={TH}>Status</th>
                                            <th className={`${TH} text-right`}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recent.map((t) => (
                                            <tr key={t._id} className={TR}>
                                                <td className={`${TD} lp-figure text-[12px] text-muted-foreground`}>{txnRef(t)}</td>
                                                <td className={TD}>{serviceLabel(t.type)}</td>
                                                <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(t.amount)}</td>
                                                <td className={`${TD} lp-figure text-right`}>{t.commissions?.distributorEarned ? inr.format(t.commissions.distributorEarned) : '—'}</td>
                                                <td className={TD}><StatusDot status={t.status} /></td>
                                                <td className={`${TD} whitespace-nowrap text-right text-muted-foreground`}>{new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Services" description="Switched-off services are hidden from this retailer and blocked." action={<span className="text-[13px] text-muted-foreground">{SERVICES.length - disabled.length} of {SERVICES.length} on</span>} flush>
                        <ul className="grid sm:grid-cols-2">
                            {SERVICES.map((svc) => {
                                const on = !disabled.includes(svc.key);
                                return (
                                    <li key={svc.key} className="flex items-center justify-between gap-3 border-b px-5 py-3 sm:odd:border-r">
                                        <div className="min-w-0">
                                            <p className={`text-sm ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{svc.label}</p>
                                            <p className="truncate text-[12px] text-muted-foreground">{svc.hint}</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={on}
                                            aria-label={`${svc.label} ${on ? 'on' : 'off'}`}
                                            disabled={savingKey !== null}
                                            onClick={() => toggleService(svc.key)}
                                            className={`relative h-5 w-9 flex-none rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-primary' : 'bg-input'}`}
                                        >
                                            <span className={`absolute left-0 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <Panel title="Account" flush>
                        <dl>
                            <KV label="Utility wallet" mono>{inr.format(retailer.mainWalletBalance || 0)}</KV>
                            <KV label="Trade wallet" mono>{inr.format(retailer.aepsWalletBalance || 0)}</KV>
                            <KV label="Email"><span className="break-all">{retailer.email || '—'}</span></KV>
                            <KV label="Mobile" mono>{retailer.contactNumber || '—'}</KV>
                            <KV label="Location">{address || '—'}</KV>
                        </dl>
                    </Panel>

                    <Panel title="Services used">
                        {loading && !data ? (
                            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                        ) : services.length === 0 ? (
                            <Empty>No transactions in this range.</Empty>
                        ) : (
                            <ul className="space-y-4">
                                {services.map((s) => (
                                    <li key={s.type}>
                                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                            <span className="truncate text-foreground">{serviceLabel(s.type)}</span>
                                            <span className="lp-figure text-foreground">{inrShort(s.volume)}</span>
                                        </div>
                                        <ShareBar value={s.volume} max={serviceMax} />
                                        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">{s.count} txns{s.earned ? ` · ${inr.format(s.earned)} to you` : ''}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel title="Business and documents" flush>
                        <dl>
                            <KV label="Business name">{retailer.businessName || '—'}</KV>
                            <KV label="Business address">{retailer.businessAddress || '—'}</KV>
                            {retailer.hasGst && <KV label="GST number" mono>{retailer.gstNumber}</KV>}
                        </dl>
                        <div className="grid grid-cols-2 gap-4 border-t p-5">
                            <DocTile label="Aadhaar" number={retailer.aadhaarNumber} picture={retailer.aadhaarPicture} />
                            <DocTile label="PAN" number={retailer.panNumber} picture={retailer.panPicture} />
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default RetailerDetail;
