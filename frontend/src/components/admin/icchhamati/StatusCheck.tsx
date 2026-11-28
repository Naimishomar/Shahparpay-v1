import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, ExternalLink, Loader2, Search } from 'lucide-react';
import { BUTTON, BUTTON_QUIET, FIELD, inr, serviceLabel, useApiGet } from '../../distributor/shared';
import { Panel, StatusDot } from '../../distributor/ui';
import { ROLE_LABEL, dateTimeOf, signed, type LedgerRow, type OurTxn, type ViewProps } from './shared';
import { Fact } from './ui';

type Result = {
    ours: OurTxn;
    provider: { source: string; status: string; message: string | null; utr?: string | null };
    statement: (LedgerRow & { wallet: string })[];
    statementError: boolean;
    verdict: 'match' | 'mismatch' | 'unknown';
};

const VERDICT = {
    match: { Icon: CheckCircle2, tone: 'border-[var(--lp-positive)]/30 bg-[var(--lp-positive)]/5 text-[var(--lp-positive)]', text: 'Both sides agree.' },
    mismatch: { Icon: AlertTriangle, tone: 'border-[var(--lp-danger-line)] bg-[var(--lp-danger-soft)] text-[var(--lp-danger)]', text: 'Shahparpay and Icchhamati disagree. Check before acting on this transaction.' },
    unknown: { Icon: CircleHelp, tone: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400', text: 'Icchhamati has no final answer yet. Try again later.' },
} as const;

/** One transaction, asked of Icchhamati. Reads only: it settles nothing. */
const StatusCheck = ({ token, onOpenTransactions, onOpenUser }: ViewProps) => {
    const [q, setQ] = useState('');
    const [asked, setAsked] = useState<{ q: string; n: number } | null>(null);
    const result = useApiGet<Result>(token, asked ? `/api/admin/icchhamati/status?q=${encodeURIComponent(asked.q)}&n=${asked.n}` : null);
    const busy = Boolean(asked) && result.loading;
    const data = busy ? null : result.data;
    const v = data ? VERDICT[data.verdict] : null;

    return (
        <div className="flex flex-col gap-6">
            <Panel title="Check a transaction at Icchhamati" description="Asks Icchhamati where one transaction stands and finds it on their statement. Nothing is changed or refunded.">
                <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) setAsked({ q: q.trim(), n: (asked?.n ?? 0) + 1 }); }} className="flex flex-wrap gap-2">
                    <div className="relative min-w-64 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Transaction id, RRN, UTR or Icchhamati order id" className={`${FIELD} lp-figure pl-9`} />
                    </div>
                    <button disabled={busy || !q.trim()} className={BUTTON}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} {busy ? 'Asking Icchhamati…' : 'Check status'}</button>
                </form>
                {!busy && result.error && <p className="mt-3 text-sm text-[var(--lp-danger)]">{result.error}</p>}
            </Panel>

            {data && v && (
                <>
                    <p className={`flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm ${v.tone}`}><v.Icon size={18} /> {v.text}</p>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Panel title="Shahparpay" action={<button type="button" onClick={() => onOpenTransactions({ q: data.ours.transactionId })} className={`${BUTTON_QUIET} h-8 px-3 text-[13px]`}>Open <ExternalLink size={13} /></button>}>
                            <dl>
                                <Fact k="Status" v={<StatusDot status={data.ours.status} />} />
                                <Fact k="Service" v={serviceLabel(data.ours.type)} />
                                <Fact k="Amount" v={<span className="lp-figure">{inr.format(data.ours.amount)}</span>} strong />
                                <Fact k="Retailer" v={data.ours.retailer
                                    ? <button type="button" onClick={() => onOpenUser('retailer', data.ours.retailer!.id)} className="underline-offset-4 hover:underline">{data.ours.retailer.name}{data.ours.retailer.retailerId ? ` (${data.ours.retailer.retailerId})` : ''}</button>
                                    : '—'} />
                                <Fact k="Date" v={new Date(data.ours.createdAt).toLocaleString('en-IN')} />
                                <Fact k="Reference" v={<span className="lp-figure">{data.ours.transactionId}</span>} />
                                {data.ours.message && <Fact k="Message" v={data.ours.message} />}
                            </dl>
                        </Panel>
                        <Panel title="Icchhamati" description={`From: ${data.provider.source}`}>
                            <dl>
                                <Fact k="Status" v={['UNKNOWN', 'NOT_FOUND'].includes(data.provider.status) ? <span className="text-muted-foreground">{data.provider.status === 'NOT_FOUND' ? 'Not on the statement' : 'No answer'}</span> : <StatusDot status={data.provider.status} />} />
                                {data.provider.utr && <Fact k="UTR" v={<span className="lp-figure">{data.provider.utr}</span>} />}
                                {data.provider.message && <Fact k="Message" v={data.provider.message} />}
                                <Fact k="Statement entries" v={data.statementError ? 'Could not read the statement' : String(data.statement.length)} />
                            </dl>
                        </Panel>
                    </div>

                    {data.statement.length > 0 && (
                        <Panel title="On Icchhamati’s statement" description="Every line that carries this transaction’s reference on its day." flush>
                            <div className="divide-y">
                                {data.statement.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                                        <span className="min-w-0">
                                            <span className="block text-foreground">{r.label} <span className="text-muted-foreground">· {ROLE_LABEL[r.role]}</span></span>
                                            <span className="lp-figure block text-[12px] text-muted-foreground">{dateTimeOf(r.date)} · {r.wallet}</span>
                                        </span>
                                        <span className={`lp-figure shrink-0 ${r.type === 'CR' ? 'text-[var(--lp-positive)]' : 'text-foreground'}`}>{signed(r.type, r.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}
                </>
            )}
        </div>
    );
};

export default StatusCheck;
