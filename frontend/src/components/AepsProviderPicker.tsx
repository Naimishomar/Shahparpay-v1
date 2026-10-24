import { AEPS_PROVIDERS, type AepsProvider } from '../lib/services';

/** Segmented PaySprint / Icchhamati choice. The retailer sees only the chosen provider's AEPS. */
const AepsProviderPicker = ({ value, onChange, disabled }: {
    value: AepsProvider;
    onChange: (provider: AepsProvider) => void;
    disabled?: boolean;
}) => (
    <div className="inline-flex rounded-xl border bg-card p-1" role="radiogroup" aria-label="AEPS provider">
        {AEPS_PROVIDERS.map(({ key, label }) => (
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

export default AepsProviderPicker;
