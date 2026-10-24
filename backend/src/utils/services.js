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
  itr: 'ITR Filing',
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

/** The AEPS providers a retailer can be onboarded with; PaySprint is the default. */
export const AEPS_PROVIDERS = ['paysprint', 'icchhamati'];

export const aepsProviderOf = (retailer) => retailer?.aepsProvider || 'paysprint';

/** null for anything that is not a known provider. */
export const parseAepsProvider = (value) => (AEPS_PROVIDERS.includes(value) ? value : null);

/**
 * The body of a retailer services update: either field may be sent alone.
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
  if (body.aepsProvider !== undefined) {
    const aepsProvider = parseAepsProvider(body.aepsProvider);
    if (!aepsProvider) return { error: 'Invalid AEPS provider' };
    set.aepsProvider = aepsProvider;
    summary.push(`AEPS provider: ${aepsProvider}`);
  }
  if (!summary.length) return { error: 'Nothing to update' };
  return { set, summary: summary.join('; ') };
};
