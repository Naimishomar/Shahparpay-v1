import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { aepsProviderOf, usesAepsProvider } from '../lib/services';
import AEPS from './AEPS';
import IcchhamatiAEPS from './IcchhamatiAEPS';

type Provider = 'paysprint' | 'icchhamati';
const STORAGE_KEY = 'aepsProvider';
const LABELS: Record<Provider, string> = { paysprint: 'PaySprint', icchhamati: 'Icchhamati' };

/** The last provider used on this browser, so a retailer on both lands where they left off. */
const remembered = (): Provider => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'icchhamati' ? 'icchhamati' : 'paysprint';
    } catch {
        return 'paysprint';
    }
};

/**
 * AEPS for the provider(s) the retailer is onboarded with. A retailer on both
 * switches between them here; each keeps its own onboarding and daily login.
 */
const AepsPage = () => {
    const { user } = useAuth();
    const [active, setActive] = useState<Provider>(remembered);

    if (aepsProviderOf(user) !== 'both') {
        return usesAepsProvider(user, 'icchhamati') ? <IcchhamatiAEPS /> : <AEPS />;
    }

    const choose = (provider: Provider) => {
        setActive(provider);
        try {
            localStorage.setItem(STORAGE_KEY, provider);
        } catch {
            // Remembering is a convenience; the switch still works without it.
        }
    };

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex w-full gap-1 rounded-2xl border bg-card p-1.5 sm:w-max" role="tablist" aria-label="AEPS provider">
                {(Object.keys(LABELS) as Provider[]).map((provider) => (
                    <button
                        key={provider}
                        role="tab"
                        aria-selected={active === provider}
                        onClick={() => choose(provider)}
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
