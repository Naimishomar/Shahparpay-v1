import { motion } from 'motion/react';
import { Fingerprint } from 'lucide-react';
import { rupees } from '@/lib/rateCard';
import { Well } from './AuthDemos';
import { Roll } from './motion';
import { TRAVEL, useBeats } from './beats';

type Slab = { label: string; sample: number; earns: number };

/**
 * The AEPS withdrawal slabs from /api/commission, told as a counter would meet
 * them: an amount is withdrawn, its slab lights up, and what the retailer earns
 * rolls in. Every figure comes from the rate card the wallet is credited by.
 */
export default function SlabDemo({ slabs }: { slabs: Slab[] }) {
    const { ref, step } = useBeats(slabs.map(() => 2400), Math.max(0, slabs.length - 2));
    const slab = slabs[step] ?? slabs[0];
    if (!slab) return null;
    return (
        <div ref={ref}>
            <Well label={`AEPS cash withdrawal slabs: a withdrawal of ${rupees(slab.sample)} earns ${slab.earns ? rupees(slab.earns) : 'no commission'}.`}>
                <div className="flex items-center gap-2 px-5 pt-5 text-[13px] text-[var(--hd-ink-3)]">
                    <Fingerprint aria-hidden className="size-4" strokeWidth={1.75} /> AEPS cash withdrawal
                </div>
                <div className="flex items-end justify-between gap-4 border-b border-[var(--hd-line)] px-5 pb-5 pt-2">
                    <div className="lp-figure text-[30px] leading-none tracking-[-0.02em] text-[var(--hd-ink)]">₹<Roll value={slab.sample.toLocaleString('en-IN')} /></div>
                    <div className="text-right">
                        <div className="text-[12px] text-[var(--hd-ink-3)]">You earn</div>
                        <div className={`lp-figure mt-1 text-[18px] leading-none ${slab.earns ? 'text-[var(--lp-accent-ink)]' : 'text-[var(--hd-ink-3)]'}`}>
                            {slab.earns ? <>₹<Roll value={slab.earns.toFixed(2)} /></> : '—'}
                        </div>
                    </div>
                </div>
                <div className="p-2">
                    {slabs.map((s, i) => (
                        <div key={s.label} className="relative flex h-11 items-center justify-between gap-3 px-3 text-[14px]">
                            {i === step && <motion.span layoutId="slab-pick" className="absolute inset-0 rounded-[8px] bg-[var(--hd-fill)]" transition={{ duration: 0.5, ease: TRAVEL }} />}
                            <span className={`relative ${i === step ? 'text-[var(--hd-ink)]' : 'text-[var(--hd-ink-2)]'}`}>{s.label}</span>
                            <span className={`lp-figure relative ${s.earns ? 'text-[var(--hd-ink)]' : 'text-[var(--hd-ink-3)]'}`}>{s.earns ? rupees(s.earns) : 'None'}</span>
                        </div>
                    ))}
                </div>
            </Well>
        </div>
    );
}
