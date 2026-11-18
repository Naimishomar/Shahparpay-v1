import { useEffect, useState } from 'react';
import { BadgePercent, Loader2 } from 'lucide-react';
import { rateSections, type RateSection } from '../lib/rateCard';

/** The retailer's rate card inside the portal: one page instead of a hint on every service. */
const CommissionSlab = () => {
    const [sections, setSections] = useState<RateSection[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/commission`)
            .then((r) => r.json())
            .then((d) => (d?.success ? setSections(rateSections(d.data)) : Promise.reject()))
            .catch(() => setError('Could not load the commission slab. Please try again shortly.'));
    }, []);

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="relative overflow-hidden top-glow rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl p-3 icon-chip"><BadgePercent className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Commission Slab</h1>
                        <p className="text-sm text-muted-foreground">What you earn and pay on every service. Commission is credited as each transaction succeeds.</p>
                    </div>
                </div>
            </section>

            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</p>}
            {!sections && !error && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
            )}

            {sections && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {sections.map((s) => (
                        <section key={s.key} className="rounded-3xl border bg-card p-6 shadow-sm">
                            <h2 className="font-semibold">{s.title}</h2>
                            <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
                            <div className="mt-4 divide-y">
                                {s.rows.map((row) => (
                                    <div key={row.left} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                                        <span>{row.left}</span>
                                        <span className={`shrink-0 font-semibold tabular-nums ${row.muted ? 'text-muted-foreground' : ''}`}>{row.right}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommissionSlab;
