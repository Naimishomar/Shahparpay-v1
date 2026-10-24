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

/**
 * PaySprint withdrew its AEPS and Micro ATM APIs, so its flows are switched off:
 * every retailer is on Icchhamati whatever was stored, and PaySprint-only UI is
 * hidden. The code stays; set this to true (and restore the backend routes
 * marked PAYSPRINT-DISABLED) to bring PaySprint back.
 */
export const PAYSPRINT_ENABLED: boolean = false;

/** AEPS choices for a retailer: one provider or both. Keys match backend/src/utils/services.js. */
export const AEPS_PROVIDERS = [
    { key: 'paysprint', label: 'PaySprint' },
    { key: 'icchhamati', label: 'Icchhamati' },
    { key: 'both', label: 'PaySprint + Icchhamati' },
] as const;

export type AepsProvider = (typeof AEPS_PROVIDERS)[number]['key'];

export const aepsProviderOf = (user: { aepsProvider?: string } | null | undefined): AepsProvider =>
    PAYSPRINT_ENABLED ? AEPS_PROVIDERS.find((p) => p.key === user?.aepsProvider)?.key ?? 'paysprint' : 'icchhamati';

/** The two providers on their own; a new retailer starts on exactly one. */
export const SINGLE_AEPS_PROVIDERS = AEPS_PROVIDERS.filter((p) => p.key !== 'both') as { key: 'paysprint' | 'icchhamati'; label: string }[];

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

/** Icchhamati onboarding steps, as the backend records them, in retailer-facing words. */
export const AEPS_STEP_LABELS: Record<string, string> = {
    register: 'AEPS not started',
    pan: 'PAN verification pending',
    mobile: 'Mobile verification pending',
    email: 'Email verification pending',
    aadhaar: 'Aadhaar verification pending',
    bank: 'Bank verification pending',
    video: 'Video KYC pending',
    video_review: 'Video KYC under review',
    onboard: 'Activation pending',
    ekyc: 'Biometric eKYC pending',
    twofa: 'KYC verified',
    ready: 'KYC verified',
};

type WithAepsStep = { isMerchantKycComplete?: boolean; icchhamatiAeps?: { step?: string | null; stepAt?: string | null } | null };

/**
 * Whether the retailer's AEPS KYC is done. With PaySprint off that is the
 * Icchhamati step (eKYC complete), not the old PaySprint flag.
 */
export const aepsKycDone = (r: WithAepsStep | null | undefined) =>
    PAYSPRINT_ENABLED ? !!r?.isMerchantKycComplete : ['twofa', 'ready'].includes(String(r?.icchhamatiAeps?.step));

/** Where the retailer stands, for following up. A retailer never seen on Icchhamati has not started. */
export const aepsStepLabel = (r: WithAepsStep | null | undefined) =>
    AEPS_STEP_LABELS[String(r?.icchhamatiAeps?.step)] || AEPS_STEP_LABELS.register;
