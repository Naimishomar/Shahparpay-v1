/**
 * How a transaction row reads, shared by Home's recent list and History so the
 * two can never disagree on a title, an icon, or which way the money moved.
 */

/** Money into one of the retailer's wallets; everything else spends. */
export const CREDIT_TYPES = new Set([
  'AEPS_WITHDRAWAL',
  'AADHAAR_PAY',
  'WALLET_TOPUP',
  'FUND_REQUEST',
  'FUND_TRANSFER',
  'AEPSTOMAIN',
  'AEPS_DEPOSIT',
  'DIRECT_PAYOUT_REFUND',
  'AEPS_DEPOSIT_REFUND',
]);

export const ICON_FOR: Record<string, string> = {
  AEPS: 'fingerprint',
  AADHAAR_PAY: 'fingerprint',
  AEPS_SETTLEMENT: 'cash-fast',
  DMT: 'bank-transfer',
  RECHARGE: 'cellphone',
  BILL_PAYMENT: 'receipt',
  WALLET_TOPUP: 'qrcode',
  DIRECT_PAYOUT: 'cash-fast',
  FUND_REQUEST: 'hand-coin-outline',
  PAN: 'card-account-details-outline',
  ITR: 'file-document-outline',
};

export const typeOf = (i: any) => String(i?.type ?? '').toUpperCase();

/** SCREAMING_SNAKE -> "Aeps withdrawal" with the acronyms kept. */
export const labelFor = (type: string) => {
  const words = (type || 'TRANSACTION').toLowerCase().split('_');
  return words
    .map((w, n) => (['aeps', 'dmt', 'upi', 'pan', 'itr'].includes(w) ? w.toUpperCase() : n ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
};

const join = (...parts: any[]) => parts.filter(Boolean).join(' · ');

/** Mockup 15: who or what the row was for, and under it the service. */
export const txnTitle = (i: any) => {
  const type = typeOf(i);
  const m = i?.metadata ?? {};
  if (type.startsWith('DMT')) return m.benename || m.beneficiaryName || 'Money transfer';
  if (type === 'RECHARGE') return join(m.operatorName, m.caNumber || m.mobile) || 'Recharge';
  if (type === 'BILL_PAYMENT')
    return [m.billerName || m.operatorName, String(m.mode ?? '').toLowerCase()].filter(Boolean).join(' ') || 'Bill payment';
  if (type === 'WALLET_TOPUP') return 'UPI collected';
  return labelFor(type);
};

export const txnSubtitle = (i: any) => {
  const type = typeOf(i);
  const m = i?.metadata ?? {};
  if (type.startsWith('AEPS') || type === 'AADHAAR_PAY') {
    const last4 = String(m.aadhaar ?? '').replace(/\D/g, '').slice(-4);
    return [m.bankName, last4 && `·· ${last4}`].filter(Boolean).join(' ') || 'AEPS';
  }
  if (type.startsWith('DMT')) return join('DMT', m.mode);
  if (type === 'RECHARGE') return 'Recharge';
  if (type === 'BILL_PAYMENT') return 'BBPS';
  if (type === 'WALLET_TOPUP') return 'Wallet top-up';
  return i?.transactionId ?? '';
};

export const txnIcon = (i: any) =>
  ICON_FOR[typeOf(i)] ?? ICON_FOR[typeOf(i).split('_')[0]] ?? 'swap-horizontal';
