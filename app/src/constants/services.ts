/**
 * Services a distributor can switch on or off per retailer. Keys match
 * backend/src/utils/services.js, which refuses a switched-off service.
 */
export const SERVICE_LABELS = {
  aeps: 'AEPS',
  matm: 'Micro ATM',
  dmt: 'DMT',
  recharge: 'Recharge',
  bbps: 'BBPS',
  collect: 'Collect Payments',
  pan: 'PAN Card',
  itr: 'ITR Filing',
  lead: 'Lead Generation',
} as const;

export type ServiceKey = keyof typeof SERVICE_LABELS;

/** Which service each navigator route belongs to. Routes not listed are never gated. */
export const ROUTE_SERVICE: Record<string, ServiceKey> = {
  AEPS: 'aeps',
  PipeStatus: 'aeps',
  KycStatus: 'aeps',
  MATM: 'matm',
  DMT: 'dmt',
  Recharge: 'recharge',
  BBPS: 'bbps',
  BbpsService: 'bbps',
  Collect: 'collect',
  PAN: 'pan',
  ITR: 'itr',
  LeadGeneration: 'lead',
};

/**
 * PaySprint withdrew its AEPS and Micro ATM APIs, so its flows are switched off:
 * every retailer is on Icchhamati whatever was stored, and PaySprint-only
 * screens are hidden. The code stays; set this to true (and restore the backend
 * routes marked PAYSPRINT-DISABLED) to bring PaySprint back.
 */
export const PAYSPRINT_ENABLED: boolean = false;

/** PaySprint's bank pipes and merchant KYC mean nothing to a retailer on Icchhamati AEPS. */
const PAYSPRINT_ONLY_ROUTES = ['PipeStatus', 'KycStatus'];

/** Admins and distributors are never gated; a retailer is unless switched off. */
export const isRouteEnabled = (
  user: { role?: string; disabledServices?: string[]; aepsProvider?: string } | null | undefined,
  route: string
) => {
  const key = ROUTE_SERVICE[route];
  if (!key || user?.role !== 'retailer') return true;
  if (PAYSPRINT_ONLY_ROUTES.includes(route) && !usesAepsProvider(user, 'paysprint')) return false;
  return !user.disabledServices?.includes(key);
};

/** AEPS choices for a retailer: one provider or both. Keys match backend/src/utils/services.js. */
export const AEPS_PROVIDERS = [
  { key: 'paysprint', label: 'PaySprint' },
  { key: 'icchhamati', label: 'Icchhamati' },
  { key: 'both', label: 'PaySprint + Icchhamati' },
] as const;

export type AepsProvider = (typeof AEPS_PROVIDERS)[number]['key'];

export const aepsProviderOf = (user: { aepsProvider?: string } | null | undefined): AepsProvider =>
  PAYSPRINT_ENABLED ? AEPS_PROVIDERS.find((p) => p.key === user?.aepsProvider)?.key ?? 'paysprint' : 'icchhamati';

/** Whether the retailer may use this provider's AEPS ('both' allows either). */
export const usesAepsProvider = (
  user: { aepsProvider?: string } | null | undefined,
  provider: 'paysprint' | 'icchhamati'
) => {
  const chosen = aepsProviderOf(user);
  return chosen === 'both' || chosen === provider;
};
