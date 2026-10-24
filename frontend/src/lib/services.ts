/**
 * Services a distributor can switch on or off per retailer. Keys match
 * backend/src/utils/services.js, which refuses a switched-off service.
 */
export const SERVICES = [
    { key: 'aeps', label: 'AEPS', hint: 'Cash withdrawal, deposit, Aadhaar Pay' },
    { key: 'matm', label: 'Micro ATM', hint: 'Card withdrawals on a mATM device' },
    { key: 'dmt', label: 'DMT', hint: 'Domestic money transfer' },
    { key: 'payout', label: 'Direct Payout', hint: 'Pay any bank account' },
    { key: 'recharge', label: 'Recharge', hint: 'Mobile & DTH' },
    { key: 'bbps', label: 'BBPS', hint: 'Utility bill payments' },
    { key: 'collect', label: 'Collect Payments', hint: 'Payment links' },
    { key: 'pan', label: 'PAN Card', hint: 'PSA & PAN applications' },
    { key: 'itr', label: 'ITR Filing', hint: 'Income tax returns' },
    { key: 'lead', label: 'Lead Generation', hint: 'Loans & credit cards' },
] as const;

/** AEPS choices for a retailer: one provider or both. Keys match backend/src/utils/services.js. */
export const AEPS_PROVIDERS = [
    { key: 'paysprint', label: 'PaySprint' },
    { key: 'icchhamati', label: 'Icchhamati' },
    { key: 'both', label: 'Both' },
] as const;

export type AepsProvider = (typeof AEPS_PROVIDERS)[number]['key'];

export const aepsProviderOf = (user: { aepsProvider?: string } | null | undefined): AepsProvider =>
    AEPS_PROVIDERS.find((p) => p.key === user?.aepsProvider)?.key ?? 'paysprint';

/** Whether the retailer may use this provider's AEPS ('both' allows either). */
export const usesAepsProvider = (user: { aepsProvider?: string } | null | undefined, provider: 'paysprint' | 'icchhamati') => {
    const chosen = aepsProviderOf(user);
    return chosen === 'both' || chosen === provider;
};

export type ServiceKey = (typeof SERVICES)[number]['key'];

export const serviceLabel = (key: ServiceKey) => SERVICES.find((s) => s.key === key)?.label ?? key;

/** Admins and distributors are never gated; a retailer is unless switched off. */
export const isServiceEnabled = (
    user: { role?: string; disabledServices?: string[] } | null | undefined,
    key?: ServiceKey
) => !key || user?.role !== 'retailer' || !user.disabledServices?.includes(key);
