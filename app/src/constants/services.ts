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
  itr: 'TaxSuite Filing',
  lead: 'Lead Generation',
} as const;

export type ServiceKey = keyof typeof SERVICE_LABELS;

/** The switches shown when onboarding a retailer; mirrors frontend/src/lib/services.ts. */
export const SERVICES = [
  { key: 'aeps', label: 'AEPS', hint: 'Cash withdrawal, deposit, Aadhaar Pay' },
  { key: 'matm', label: 'Micro ATM', hint: 'Card withdrawals on a mATM device' },
  { key: 'dmt', label: 'DMT', hint: 'Domestic money transfer' },
  { key: 'payout', label: 'Direct Payout', hint: 'Pay any bank account' },
  { key: 'recharge', label: 'Recharge', hint: 'Mobile & DTH' },
  { key: 'bbps', label: 'BBPS', hint: 'Utility bill payments' },
  { key: 'collect', label: 'Collect Payments', hint: 'Payment links' },
  { key: 'pan', label: 'PAN Card', hint: 'PSA & PAN applications' },
  { key: 'itr', label: 'TaxSuite Filing', hint: 'Income tax returns' },
  { key: 'lead', label: 'Lead Generation', hint: 'Loans & credit cards' },
] as const;

/** Which service each navigator route belongs to. Routes not listed are never gated. */
export const ROUTE_SERVICE: Record<string, ServiceKey> = {
  AEPS: 'aeps',
  MATM: 'matm',
  DMT: 'dmt',
  Recharge: 'recharge',
  BBPS: 'bbps',
  BbpsService: 'bbps',
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
  if (!key || user?.role !== 'retailer') return true;
  return !user.disabledServices?.includes(key);
};

/** Icchhamati onboarding steps, as the backend records them, in plain words. */
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

type WithAepsStep = { icchhamatiAeps?: { step?: string | null } | null };

/** Whether the retailer's AEPS KYC is done: the Icchhamati step is past eKYC. */
export const aepsKycDone = (r: WithAepsStep | null | undefined) =>
  ['twofa', 'ready'].includes(String(r?.icchhamatiAeps?.step));

/** Where the retailer stands, for following up. A retailer never seen on Icchhamati has not started. */
export const aepsStepLabel = (r: WithAepsStep | null | undefined) =>
  AEPS_STEP_LABELS[String(r?.icchhamatiAeps?.step)] || AEPS_STEP_LABELS.register;
