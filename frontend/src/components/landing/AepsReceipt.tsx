import { CheckCircle2, Fingerprint } from 'lucide-react';
import { ROW } from './ui';

/**
 * The public site's one rich moment: the slip a customer takes home after an
 * AEPS withdrawal, on the counter where it was printed. Used by the landing
 * hero and the sign-in page.
 */
const AepsReceipt = () => (
    <div className="lp-counter rounded-[24px] p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-4">
            <div className="lp-scanner" aria-hidden>
                <span><Fingerprint strokeWidth={1.5} className="size-4" /></span>
            </div>
            <div>
                <p className="text-sm text-[var(--lp-on-ink)]">Mantra MFS100</p>
                <p className="text-sm text-[var(--lp-on-ink-2)]">Fingerprint matched · bank approved</p>
            </div>
        </div>
        <div className="lp-receipt-wrap">
            <div className="lp-receipt rounded-t-xl px-5 pt-6 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-base font-medium text-[var(--lp-fg)]">AEPS cash withdrawal</p>
                        <p className="lp-figure mt-1 text-xs text-[var(--lp-muted)]">08 Nov 2026 · 11:42 AM</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--lp-positive)]">
                        <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.5} /> Success
                    </span>
                </div>
                <p className="lp-figure mt-6 text-[40px] leading-none tracking-[-0.02em] text-[var(--lp-fg)]">₹2,000.00</p>
                <hr className="lp-tear my-6" />
                <dl className="space-y-3 text-sm">
                    {[
                        ['Customer', 'Sunita Devi', false],
                        ['Aadhaar', 'XXXX XXXX 4410', true],
                        ['Bank', 'State Bank of India', false],
                        ['RRN', '431209876543', true],
                    ].map(([k, v, mono]) => (
                        <div key={String(k)} className={ROW}>
                            <dt className="text-[var(--lp-muted)]">{k}</dt>
                            <dd className={`text-right text-[var(--lp-fg)] ${mono ? 'lp-figure' : ''}`}>{v}</dd>
                        </div>
                    ))}
                </dl>
                <hr className="lp-tear my-6" />
                <div className={ROW}>
                    <span className="text-sm text-[var(--lp-fg-2)]">Your commission</span>
                    <span className="lp-figure text-base text-[var(--lp-accent-ink)]">+₹14.00</span>
                </div>
            </div>
        </div>
    </div>
);

export default AepsReceipt;
