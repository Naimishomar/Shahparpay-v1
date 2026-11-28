import { useState } from 'react';
import { CheckCircle2, Loader2, ScanSearch } from 'lucide-react';
import { BUTTON, FIELD, inr, serviceLabel, useApiGet } from '../../distributor/shared';
import { Panel, StatStrip, StatusDot } from '../../distributor/ui';
import { timeOf, todayIst, type OurTxn, type ViewProps } from './shared';

type Entry = { id: number; wallet: string; date: string; details: string; label: string; ref: string; type: 'CR' | 'DR'; amount: number };
type Kind = 'stuck_ours' | 'failed_ours' | 'amount' | 'missing_ours' | 'missing_theirs';
type Issue = { kind: Kind; entry?: Entry; ours?: OurTxn };
type Result = {
    day: string; entries: number; principal: number; ours: number; matched: number; issues: Issue[];
    wallets: { id: number; name: string; entries: number; credits: number; debits: number }[];
};

/** Each kind of difference, said as what happened and what to do about it. Most urgent first. */
const KINDS: { kind: Kind; title: string; hint: string; tone: string }[] = [
    { kind: 'stuck_ours', title: 'Done at Icchhamati, still pending with us', hint: 'Icchhamati has booked these. The retailer is waiting: check and settle them.', tone: 'bg-amber-500' },
    { kind: 'failed_ours', title: 'Failed or refunded with us, but booked at Icchhamati', hint: 'Icchhamati moved the money and never reversed it. A refund here may have been paid twice.', tone: 'bg-[var(--lp-danger)]' },
    { kind: 'amount', title: 'Amounts do not match', hint: 'The same transaction with a different amount on each side.', tone: 'bg-[var(--lp-danger)]' },
    { kind: 'missing_theirs', title: 'Successful with us, not on Icchhamati’s statement', hint: 'We credited or debited for these, but Icchhamati shows no entry for the day.', tone: 'bg-[var(--lp-danger)]' },
    { kind: 'missing_ours', title: 'On Icchhamati’s statement, not in Shahparpay', hint: 'Usually someone using the Icchhamati portal directly. Make sure each one is known.', tone: 'bg-muted-foreground' },
];

const IssueRow = ({ issue: { entry, ours }, onOpenTransactions }: { issue: Issue; onOpenTransactions: ViewProps['onOpenTransactions'] }) => {
    const body = (
        <>
            <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">
                    {entry ? entry.label : ours ? serviceLabel(ours.type) : '—'}
                    {ours?.retailer && <span className="text-muted-foreground"> · {ours.retailer.name}</span>}
                </span>
                <span className="lp-figure mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {entry ? `${timeOf(entry.date)} · ${entry.ref} · ${entry.wallet}` : ours ? `${new Date(ours.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · ${ours.transactionId}` : ''}
                </span>
            </span>
            <span className="grid shrink-0 grid-cols-2 gap-6 text-right">
                <span>
                    <span className="block text-[11px] text-muted-foreground">Icchhamati</span>
                    <span className="lp-figure text-sm text-foreground">{entry ? inr.format(entry.amount) : '—'}</span>
                </span>
                <span>
                    <span className="block text-[11px] text-muted-foreground">Shahparpay</span>
                    {ours ? <span className="inline-flex flex-col items-end"><span className="lp-figure text-sm text-foreground">{inr.format(ours.amount)}</span><StatusDot status={ours.status} /></span> : <span className="text-sm text-muted-foreground">—</span>}
                </span>
            </span>
        </>
    );
    return ours
        ? <button type="button" onClick={() => onOpenTransactions({ q: ours.transactionId })} className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/50">{body}</button>
        : <div className="flex items-center gap-4 px-5 py-3">{body}</div>;
};

/** One day of Icchhamati's statement lined up against our transactions. */
const Reconcile = ({ token, onOpenTransactions }: ViewProps) => {
    const [day, setDay] = useState(todayIst());
    const [run, setRun] = useState<string | null>(null);
    const result = useApiGet<Result>(token, run ? `/api/admin/icchhamati/reconcile?date=${run}` : null);
    const data = result.data?.day === run ? result.data : null;
    const busy = Boolean(run) && result.loading;

    return (
        <div className="flex flex-col gap-6">
            <Panel title="Reconcile with Icchhamati" description="Lines up one day of Icchhamati’s statement against Shahparpay’s transactions and lists only what differs.">
                <form onSubmit={(e) => { e.preventDefault(); if (run === day) result.reload(); else setRun(day); }} className="flex flex-wrap items-center gap-2">
                    <input type="date" value={day} max={todayIst()} onChange={(e) => setDay(e.target.value)} className={`${FIELD} sm:w-44 dark:[color-scheme:dark]`} aria-label="Day" />
                    <button disabled={busy || !day} className={BUTTON}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} strokeWidth={1.75} />} {busy ? 'Checking…' : 'Run check'}</button>
                    {busy && <span className="text-[13px] text-muted-foreground">Reading every statement page of the day. This can take a minute.</span>}
                </form>
                {result.error && <p className="mt-3 text-sm text-[var(--lp-danger)]">{result.error}</p>}
            </Panel>

            {data && (
                <>
                    <StatStrip items={[
                        { label: 'Icchhamati entries', value: String(data.entries), hint: `${data.principal} transactions, rest commission and charges` },
                        { label: 'Our Icchhamati transactions', value: String(data.ours), hint: 'Successful, same day' },
                        { label: 'Matched', value: String(data.matched) },
                        { label: 'Need attention', value: String(data.issues.length), hint: data.issues.length ? 'Listed below' : 'All clear' },
                    ]} />

                    {data.issues.length === 0 ? (
                        <Panel>
                            <p className="flex items-center justify-center gap-2 py-6 text-sm text-foreground"><CheckCircle2 size={18} className="text-[var(--lp-positive)]" /> Everything on {new Date(`${data.day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} matches.</p>
                        </Panel>
                    ) : KINDS.map(({ kind, title, hint, tone }) => {
                        const list = data.issues.filter((i) => i.kind === kind);
                        if (!list.length) return null;
                        return (
                            <Panel key={kind} title={<span className="inline-flex items-center gap-2"><span aria-hidden className={`size-2 rounded-full ${tone}`} />{title} <span className="lp-figure text-muted-foreground">{list.length}</span></span>} description={hint} flush>
                                <div className="divide-y">{list.map((i, n) => <IssueRow key={n} issue={i} onOpenTransactions={onOpenTransactions} />)}</div>
                            </Panel>
                        );
                    })}

                    <Panel title="By wallet" flush>
                        <div className="divide-y">
                            {data.wallets.map((w) => (
                                <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                                    <span className="text-foreground">{w.name} <span className="text-muted-foreground">· {w.entries} entries</span></span>
                                    <span className="lp-figure flex gap-6"><span className="text-[var(--lp-positive)]">+{inr.format(w.credits)}</span><span className="text-foreground">−{inr.format(w.debits)}</span></span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </>
            )}
        </div>
    );
};

export default Reconcile;
