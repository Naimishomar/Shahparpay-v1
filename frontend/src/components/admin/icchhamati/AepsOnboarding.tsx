import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TABLE, TD, TH, THEAD, TR, ago, useApiGet } from '../../distributor/shared';
import { Empty, Panel, ShareBar, Skeleton, StatStrip } from '../../distributor/ui';
import { AEPS_STEP_LABELS } from '../../../lib/services';
import type { ViewProps } from './shared';

type Summary = {
    steps: { step: string; count: number }[];
    done: number;
    total: number;
    retailers: { id: string; name: string; retailerId?: string; businessName?: string; step: string; stepAt: string | null; joinedAt: string; distributor: string | null }[];
};

const DONE = ['twofa', 'ready'];

/** Where every retailer stands on Icchhamati AEPS onboarding, and who has been stuck longest. */
const AepsOnboarding = ({ token, nonce, onOpenUser }: Pick<ViewProps, 'token' | 'onOpenUser'> & { nonce: number }) => {
    const summary = useApiGet<Summary>(token, `/api/admin/icchhamati/aeps-onboarding?r=${nonce}`);
    const [step, setStep] = useState<string | null>(null);
    const d = summary.data;
    const pending = (d?.steps ?? []).filter((s) => !DONE.includes(s.step));
    const max = Math.max(1, ...pending.map((s) => s.count));
    const people = (d?.retailers ?? []).filter((r) => !step || r.step === step);

    return (
        <div className="flex flex-col gap-6">
            <StatStrip loading={summary.loading && !d} cols={3} items={d ? [
                { label: 'Active retailers', value: String(d.total) },
                { label: 'AEPS ready', value: String(d.done), hint: d.total ? `${Math.round((d.done / d.total) * 100)}% done` : undefined },
                { label: 'Still onboarding', value: String(d.total - d.done), hint: 'Listed below, longest waiting first' },
            ] : []} />
            {summary.error && <p className="text-sm text-[var(--lp-danger)]">{summary.error}</p>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Panel title="Where they stand" description="Click a step to see who is on it." flush>
                    {!d ? <div className="p-5"><Skeleton className="h-56 rounded-xl" /></div> : (
                        <div className="py-1">
                            {pending.map((s) => (
                                <button key={s.step} type="button" onClick={() => setStep(step === s.step ? null : s.step)} aria-pressed={step === s.step}
                                    className={`block w-full px-5 py-2.5 text-left transition-colors hover:bg-muted/50 ${step === s.step ? 'bg-muted' : ''}`}>
                                    <span className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                                        <span className="text-foreground">{AEPS_STEP_LABELS[s.step] || s.step}</span>
                                        <span className="lp-figure text-muted-foreground">{s.count}</span>
                                    </span>
                                    <ShareBar value={s.count} max={max} />
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title={step ? AEPS_STEP_LABELS[step] || step : 'Retailers not yet ready'} description={step ? <button type="button" onClick={() => setStep(null)} className="underline-offset-4 hover:underline">Show every step</button> : 'Open a retailer to check their status with Icchhamati.'} flush>
                    {!d ? <div className="p-5"><Skeleton className="h-56 rounded-xl" /></div> : !people.length ? <Empty>Nobody here.</Empty> : (
                        <div className="max-h-[560px] overflow-auto">
                            <table className={TABLE}>
                                <thead><tr className={THEAD}>{['Retailer', 'Step', 'On this step', 'Distributor', ''].map((h, i) => <th key={i} className={TH}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {people.map((r) => (
                                        <tr key={r.id} onClick={() => onOpenUser('retailer', r.id)} className={`${TR} cursor-pointer`}>
                                            <td className={TD}><p className="text-foreground">{r.name}</p><p className="lp-figure text-[12px] text-muted-foreground">{r.retailerId || r.businessName}</p></td>
                                            <td className={`${TD} text-[13px]`}>{AEPS_STEP_LABELS[r.step] || r.step}</td>
                                            <td className={`${TD} whitespace-nowrap text-[13px] text-muted-foreground`}>{r.stepAt ? ago(r.stepAt) : `joined ${ago(r.joinedAt)}`}</td>
                                            <td className={`${TD} text-[13px] text-muted-foreground`}>{r.distributor || '—'}</td>
                                            <td className={`${TD} w-8`}><ChevronRight size={16} className="text-muted-foreground" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
};

export default AepsOnboarding;
