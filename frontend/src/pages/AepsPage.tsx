import { useState } from 'react';
import { ChevronRight, Fingerprint } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { aepsProviderOf, usesAepsProvider } from '../lib/services';
import AEPS from './AEPS';
import IcchhamatiAEPS from './IcchhamatiAEPS';

type Provider = 'paysprint' | 'icchhamati';
const LABELS: Record<Provider, string> = { paysprint: 'PaySprint', icchhamati: 'Icchhamati' };

/**
 * AEPS for the provider(s) the retailer is onboarded with. Each provider has
 * its own onboarding and daily 2FA, and its page asks for them as soon as it
 * opens — so a retailer on both picks a provider first, and only that one's
 * page (and 2FA) opens. Not remembered across visits for the same reason.
 */
const AepsPage = () => {
    const { user } = useAuth();
    const [active, setActive] = useState<Provider | null>(null);

    if (aepsProviderOf(user) !== 'both') {
        return usesAepsProvider(user, 'icchhamati') ? <IcchhamatiAEPS /> : <AEPS />;
    }

    if (!active) {
        return (
            <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
                <section className="rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl p-3 icon-chip"><Fingerprint className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AEPS</h1>
                            <p className="text-sm text-muted-foreground">Choose the provider to work with. Each has its own daily login.</p>
                        </div>
                    </div>
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                    {(Object.keys(LABELS) as Provider[]).map((provider) => (
                        <button
                            key={provider}
                            onClick={() => setActive(provider)}
                            className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-6 text-left shadow-sm transition hover:border-zinc-400 hover:shadow-md"
                        >
                            <div>
                                <p className="text-lg font-semibold">{LABELS[provider]}</p>
                                <p className="text-sm text-muted-foreground">Open {LABELS[provider]} AEPS</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex w-full gap-1 rounded-2xl border bg-card p-1.5 sm:w-max" role="tablist" aria-label="AEPS provider">
                {(Object.keys(LABELS) as Provider[]).map((provider) => (
                    <button
                        key={provider}
                        role="tab"
                        aria-selected={active === provider}
                        onClick={() => setActive(provider)}
                        className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all sm:flex-none ${active === provider ? 'btn-primary' : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'}`}
                    >
                        {LABELS[provider]}
                    </button>
                ))}
            </div>
            {active === 'icchhamati' ? <IcchhamatiAEPS /> : <AEPS />}
        </div>
    );
};

export default AepsPage;
