import { SINGLE_AEPS_PROVIDERS, usesAepsProvider, type AepsProvider } from '../lib/services';

type Single = 'paysprint' | 'icchhamati';

/** PaySprint / Icchhamati choice for a new retailer: they start on exactly one. */
const AepsProviderPicker = ({ value, onChange, disabled }: {
    value: Single;
    onChange: (provider: Single) => void;
    disabled?: boolean;
}) => (
    <div className="inline-flex rounded-xl border bg-card p-1" role="radiogroup" aria-label="AEPS provider">
        {SINGLE_AEPS_PROVIDERS.map(({ key, label }) => (
            <button
                key={key}
                type="button"
                role="radio"
                aria-checked={value === key}
                disabled={disabled}
                onClick={() => value !== key && onChange(key)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${value === key ? 'btn-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
                {label}
            </button>
        ))}
    </div>
);

/**
 * An existing retailer's providers, switched on one at a time: the second
 * provider onboards on its own criteria, so it is added separately. At least
 * one stays on.
 */
export const AepsProviderSwitches = ({ value, onChange, disabled }: {
    value: AepsProvider;
    onChange: (provider: AepsProvider) => void;
    disabled?: boolean;
}) => {
    const on = (key: Single) => usesAepsProvider({ aepsProvider: value }, key);
    const toggle = (key: Single) => {
        const other: Single = key === 'paysprint' ? 'icchhamati' : 'paysprint';
        onChange(on(key) ? other : on(other) ? 'both' : key);
    };
    return (
        <div className="flex flex-wrap gap-2">
            {SINGLE_AEPS_PROVIDERS.map(({ key, label }) => {
                const active = on(key);
                // The last provider left cannot be switched off.
                const locked = active && !on(key === 'paysprint' ? 'icchhamati' : 'paysprint');
                return (
                    <button
                        key={key}
                        type="button"
                        role="switch"
                        aria-checked={active}
                        disabled={disabled || locked}
                        title={locked ? 'At least one AEPS provider stays on' : undefined}
                        onClick={() => toggle(key)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-background' : 'text-muted-foreground'}`}
                    >
                        <span className={`relative h-4 w-7 rounded-full transition-colors ${active ? 'bg-primary' : 'bg-black/15 dark:bg-white/15'}`}>
                            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </span>
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

export default AepsProviderPicker;
