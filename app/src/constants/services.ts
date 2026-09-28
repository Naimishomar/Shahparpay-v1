/**
 * Services a distributor can switch on or off per retailer. Keys match
 * backend/src/utils/services.js, which refuses a switched-off service.
 */
export const SERVICE_LABELS = {
  aeps: 'AEPS',
  matm: 'Micro ATM',
  dmt: 'DMT',
  payout: 'Direct Payout',
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
  MATM: 'matm',
  DMT: 'dmt',
  DirectPayout: 'payout',
  Recharge: 'recharge',
  BBPS: 'bbps',
  BbpsService: 'bbps',
  Collect: 'collect',
  PAN: 'pan',
  ITR: 'itr',
  LeadGeneration: 'lead',
};

/** Admins and distributors are never gated; a retailer is unless switched off. */
export const isRouteEnabled = (
  user: { role?: string; disabledServices?: string[] } | null | undefined,
  route: string
) => {
  const key = ROUTE_SERVICE[route];
  return !key || user?.role !== 'retailer' || !user.disabledServices?.includes(key);
};
