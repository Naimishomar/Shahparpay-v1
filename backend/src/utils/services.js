/**
 * Services a distributor can switch on or off per retailer. Keep in sync with
 * frontend/src/lib/services.ts and app/src/constants/services.ts — each UI
 * hides a switched-off service, and requireService() below refuses it here.
 */
export const SERVICES = {
  aeps: 'AEPS',
  matm: 'Micro ATM',
  dmt: 'DMT',
  payout: 'Direct Payout',
  recharge: 'Recharge',
  bbps: 'BBPS',
  collect: 'Collect Payments',
  pan: 'PAN Card',
  itr: 'TaxSuite Filing',
  lead: 'Lead Generation',
};

export const SERVICE_KEYS = Object.keys(SERVICES);

/** Accepts an array or a JSON string (multipart bodies); drops anything unknown. */
export const parseDisabledServices = (value) => {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  return [...new Set(list.filter((key) => SERVICE_KEYS.includes(key)))];
};

/**
 * The body of a retailer services update.
 * Returns `{ set, summary }` for the $set and the activity log, or `{ error }`.
 */
export const parseServicesUpdate = (body = {}) => {
  const set = {};
  const summary = [];
  if (body.disabledServices !== undefined) {
    const disabledServices = parseDisabledServices(body.disabledServices);
    if (!disabledServices) return { error: 'Invalid services list' };
    set.disabledServices = disabledServices;
    summary.push(disabledServices.length ? `Switched off: ${disabledServices.join(', ')}` : 'All services switched on');
  }
  if (!summary.length) return { error: 'Nothing to update' };
  return { set, summary: summary.join('; ') };
};

/**
 * Icchhamati onboarding steps after which the merchant's KYC is done: what is
 * left is only the daily login. This, not the older isMerchantKycComplete flag,
 * is what "KYC verified" means.
 */
export const AEPS_KYC_DONE_STEPS = ['twofa', 'ready'];

export const aepsKycDone = (retailer) => AEPS_KYC_DONE_STEPS.includes(retailer?.icchhamatiAeps?.step);

/** Mongo filters for the same rule; a retailer never seen on Icchhamati is pending. */
export const aepsKycDoneFilter = () => ({ 'icchhamatiAeps.step': { $in: AEPS_KYC_DONE_STEPS } });
export const aepsKycPendingFilter = () => ({ 'icchhamatiAeps.step': { $nin: AEPS_KYC_DONE_STEPS } });
