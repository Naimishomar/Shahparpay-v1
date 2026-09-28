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
