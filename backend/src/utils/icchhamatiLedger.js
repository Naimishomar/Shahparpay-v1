/**
 * Reading Icchhamati's wallet statement.
 *
 * A statement line carries no structured reference, only a `details` string
 * such as "CW - Transaction 568948004766" or "Bill Payment - 67000290849". The
 * reference inside it is whatever Icchhamati keyed the entry by: the bank RRN
 * for AEPS, the order id for UPI cash withdrawal and the payment gateway, the
 * customer number for a recharge or bill, the account number for a payout.
 * These rules turn a line into { label, role, ref } so it can be matched to one
 * of our transactions.
 *
 * role: principal (the money of the service itself), commission, charge,
 *       refund, tds, internal (moves inside our own account, no reference).
 */

const AEPS_CODES = {
  CW: 'AEPS cash withdrawal',
  CD: 'AEPS cash deposit',
  MS: 'AEPS mini statement',
  BE: 'AEPS balance enquiry',
  AP: 'Aadhaar Pay',
  MATM: 'Micro ATM',
  UPICW: 'UPI cash withdrawal',
};

const RULES = [
  [/^MOVE_TO Failed & Refund\s*-\s*(?<ref>\S+)/i, () => 'Payout', 'refund'],
  [/^Refund of Move to Charge\s*-?\s*(?<ref>\S+)/i, () => 'Payout charge', 'refund'],
  [/^MOVE_TO Charge\s*-?\s*(?<ref>\S+)/i, () => 'Payout charge', 'charge'],
  [/^MOVE_TO\s*-\s*(?<ref>\S+)/i, () => 'Payout', 'principal'],
  [/^(?<code>[A-Z]{2,5})\s*-\s*Transaction\s+(?<ref>\S+)/, (g) => AEPS_CODES[g.code] || g.code, 'principal'],
  [/^(?<code>[A-Z]{2,5})\s*-\s*Commission\s+(?<ref>\S+)/, (g) => AEPS_CODES[g.code] || g.code, 'commission'],
  [/^Easebuzz Payment TxnID:\s*(?<ref>\S+)/i, () => 'Payment gateway', 'principal'],
  [/^(?<label>Account|Pan|Aadhar|Aadhaar) Verification\s*-\s*(?<ref>\S+)/i, (g) => `${g.label} verification`, 'charge'],
  [/^(?<label>[A-Za-z ]+?) Failed & Refunded?\s*-\s*(?<ref>\S+)/i, (g) => g.label, 'refund'],
  [/^(?<label>[A-Za-z ]+?) Commission\s*-\s*(?<ref>\S+)/i, (g) => g.label, 'commission'],
  [/^(?<label>[A-Za-z ]+?)\s*-\s*(?<ref>[A-Za-z0-9]{6,})$/, (g) => g.label, 'principal'],
];

export const parseLedgerDetails = (details) => {
  const text = String(details ?? '').trim();
  if (/^TDS\b/i.test(text)) return { label: 'TDS', role: 'tds', ref: null };
  for (const [pattern, label, role] of RULES) {
    const m = text.match(pattern);
    if (m) return { label: label(m.groups), role, ref: m.groups.ref };
  }
  if (/charge/i.test(text)) return { label: text, role: 'charge', ref: null };
  return { label: text || 'Entry', role: 'internal', ref: null };
};

/** Icchhamati stamps entries in IST without a zone: "2026-11-28 20:26:49". */
export const istDate = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).trim().replace(' ', 'T')}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Where our transactions keep the references Icchhamati writes into a statement line. */
export const MATCH_FIELDS = [
  'transactionId',
  'metadata.bankRRN',
  'metadata.fpTransactionId',
  'metadata.rrn',
  'metadata.providerRef',
  'metadata.providerTxnId',
  'metadata.orderId',
  'metadata.operatorTxnId',
  'metadata.partnerRequestId',
  'metadata.fingpayTxnId',
  'metadata.caNumber',
  'metadata.utr',
  'metadata.refid',
  'metadata.beneficiaryAccount',
  'metadata.bankAccount',
];

const valueAt = (doc, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), doc);

export const refsOf = (txn) =>
  [...new Set(MATCH_FIELDS.map((f) => valueAt(txn, f)).filter((v) => v !== undefined && v !== null && v !== '').map(String))];

/** Values to look a reference up by: stored as text, or as a number by older flows. */
export const refVariants = (refs) =>
  refs.flatMap((r) => (/^\d{1,15}$/.test(r) ? [r, Number(r)] : [r]));

/**
 * The transaction of ours a statement line is about, from `txns` (candidates
 * that share any reference with the batch). A customer number or bank account
 * repeats across transactions, so the closest in time wins, and for money lines
 * the one with the same amount first. `used` keeps two lines from claiming the
 * same transaction.
 */
export const pickMatch = (entry, txns, used = new Set()) => {
  if (!entry.ref) return null;
  const at = istDate(entry.date)?.getTime() ?? Date.now();
  const sameAmount = (t) => Math.abs(Number(t.amount) - Number(entry.amount)) < 0.01;
  const candidates = txns
    .filter((t) => !used.has(String(t._id)) && refsOf(t).includes(String(entry.ref)))
    .sort((a, b) => {
      if (entry.role === 'principal' && sameAmount(a) !== sameAmount(b)) return sameAmount(a) ? -1 : 1;
      return Math.abs(new Date(a.createdAt) - at) - Math.abs(new Date(b.createdAt) - at);
    });
  return candidates[0] || null;
};
