import React from 'react';
import { TransactionReport } from '@/components/ui/TransactionReport';
import { money, shortDate } from '@/components/ui/Screen';
import api from '@/services/api';

const txnSearch = (i: any) =>
  [i?.transactionId, i?.type, i?.status, i?.metadata?.caNumber, i?.metadata?.benename, i?.userId?.name, txnReason(i)]
    .filter(Boolean)
    .join(' ');

/** Transactions filtered by `type` prefix on /api/dashboard/recent-transactions. */
const byType = (type: string) => async (range: { startDate?: string; endDate?: string }) =>
  (await api.getRecentTransactions({ type, limit: 1000, ...range })).data ?? [];

/**
 * Why a transaction ended the way it did. The AEPS and PAN flows write the
 * gateway message to `metadata.gatewayMessage`; resolveTransaction and the
 * reconciliation worker write `metadata.apiMessage`. The old accessor read
 * `apiResponse.message`, which no transaction document has — so a failed AEPS
 * row showed nothing but FAILED and the retailer had to ask support why.
 */
const txnReason = (i: any) =>
  i?.metadata?.gatewayMessage || i?.metadata?.apiMessage || i?.metadata?.note || '';

/** Rows the gateway rejected — the ones whose reason is worth surfacing. */
const txnFailed = (i: any) => /FAIL|REJECT/i.test(String(i?.status ?? ''));

const txnDetails = [
  { label: 'Reference', value: (i: any) => i?.transactionId ?? '—' },
  { label: 'Type', value: (i: any) => String(i?.type ?? '—').replace(/_/g, ' ') },
  { label: 'Consumer', value: (i: any) => i?.metadata?.caNumber ?? i?.metadata?.mobile ?? '—' },
  { label: 'Reason', value: (i: any) => txnReason(i) || '—' },
];

/**
 * Aadhaar is shown masked to the last four digits — the same form the receipt
 * and the ledger narration use, and the only form an AePS outlet is allowed to
 * display back.
 */
const maskAadhaar = (v: any) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : '—';
};

export const AepsReport: React.FC = () => (
  <TransactionReport
    fetcher={byType('AEPS')}
    searchFields={txnSearch}
    titleOf={(i) => String(i?.type ?? 'AEPS').replace(/_/g, ' ')}
    subtitleOf={(i) => (txnFailed(i) && txnReason(i)) || i?.transactionId || ''}
    details={[
      ...txnDetails,
      { label: 'Customer', value: (i: any) => i?.metadata?.name || '—' },
      { label: 'Aadhaar', value: (i: any) => maskAadhaar(i?.metadata?.aadhaar) },
      { label: 'Bank', value: (i: any) => i?.metadata?.bankName || '—' },
      {
        label: 'Bank balance after',
        value: (i: any) =>
          i?.metadata?.bankBalance != null ? money(Number(i.metadata.bankBalance)) : '—',
      },
    ]}
    emptyIcon="fingerprint"
    emptyTitle="No AEPS transactions"
  />
);

export const DmtReport: React.FC = () => (
  <TransactionReport
    fetcher={byType('DMT')}
    searchFields={txnSearch}
    titleOf={(i) => i?.metadata?.benename ?? 'Money transfer'}
    subtitleOf={(i) => i?.transactionId ?? ''}
    details={[
      ...txnDetails,
      { label: 'Beneficiary A/C', value: (i: any) => i?.metadata?.beneaccount ?? '—' },
      { label: 'IFSC', value: (i: any) => i?.metadata?.ifsc ?? '—' },
    ]}
    emptyIcon="bank-transfer"
    emptyTitle="No DMT transfers"
  />
);

export const RechargeReport: React.FC = () => (
  <TransactionReport
    fetcher={byType('RECHARGE')}
    searchFields={txnSearch}
    titleOf={(i) => i?.metadata?.caNumber ?? 'Recharge'}
    subtitleOf={(i) => i?.metadata?.mode ?? i?.transactionId ?? ''}
    details={txnDetails}
    emptyIcon="cellphone"
    emptyTitle="No recharges yet"
  />
);

export const UpiReport: React.FC = () => (
  <TransactionReport
    fetcher={byType('WALLET_TOPUP')}
    searchFields={txnSearch}
    titleOf={(i) => i?.metadata?.mobile ?? 'UPI collection'}
    subtitleOf={(i) => i?.transactionId ?? ''}
    details={txnDetails}
    emptyIcon="qrcode"
    emptyTitle="No UPI collections"
  />
);

export const ItrReport: React.FC = () => (
  <TransactionReport
    fetcher={async () => (await api.getItrHistory()).data ?? []}
    searchFields={txnSearch}
    titleOf={(i) => i?.metadata?.client_name ?? 'ITR filing'}
    subtitleOf={(i) => i?.metadata?.pan ?? i?.transactionId ?? ''}
    details={[
      ...txnDetails,
      { label: 'PAN', value: (i: any) => i?.metadata?.pan ?? '—' },
      { label: 'Assessment year', value: (i: any) => i?.metadata?.ay ?? '—' },
    ]}
    emptyIcon="file-document-outline"
    emptyTitle="No ITR filings"
  />
);

export const PanReport: React.FC = () => (
  <TransactionReport
    fetcher={async () => (await api.getPanHistory()).data ?? []}
    searchFields={(i) =>
      [i?.transactionId, i?.type, i?.metadata?.application_number, i?.metadata?.psa_id]
        .filter(Boolean)
        .join(' ')
    }
    titleOf={(i) => String(i?.type ?? 'PAN').replace(/_/g, ' ')}
    subtitleOf={(i) => i?.metadata?.application_number ?? i?.transactionId ?? ''}
    details={[
      { label: 'Application', value: (i: any) => i?.metadata?.application_number ?? '—' },
      { label: 'PSA ID', value: (i: any) => i?.metadata?.psa_id ?? '—' },
      { label: 'Reference', value: (i: any) => i?.transactionId ?? '—' },
    ]}
    emptyIcon="card-account-details-outline"
    emptyTitle="No PAN applications"
  />
);

export const PayoutReport: React.FC = () => (
  <TransactionReport
    fetcher={async () => (await api.getSettlementHistory()).data ?? []}
    searchFields={(i) =>
      [i?.transactionId, i?.type, i?.status, i?.metadata?.accountNumber, i?.metadata?.bankName]
        .filter(Boolean)
        .join(' ')
    }
    titleOf={(i) =>
      i?.metadata?.accountHolderName ?? String(i?.type ?? 'Payout').replace(/_/g, ' ')
    }
    subtitleOf={(i) => i?.metadata?.bankName ?? i?.transactionId ?? ''}
    details={[
      { label: 'Reference', value: (i: any) => i?.transactionId ?? '—' },
      { label: 'Account', value: (i: any) => i?.metadata?.accountNumber ?? '—' },
      { label: 'IFSC', value: (i: any) => i?.metadata?.ifscCode ?? '—' },
      { label: 'Mode', value: (i: any) => i?.metadata?.mode ?? '—' },
      { label: 'UTR', value: (i: any) => i?.metadata?.utr ?? '—' },
    ]}
    emptyIcon="cash-fast"
    emptyTitle="No payouts yet"
  />
);

export const LeadReport: React.FC = () => (
  <TransactionReport
    fetcher={async () => (await api.getLeadHistory()).data ?? []}
    searchFields={(i) => [i?.name, i?.mobile_no, i?.product, i?.refid, i?.status].filter(Boolean).join(' ')}
    amountOf={() => 0}
    statusOf={(i) => i?.status ?? i?.executive_status}
    titleOf={(i) => i?.name ?? 'Lead'}
    subtitleOf={(i) => i?.product ?? ''}
    details={[
      { label: 'Mobile', value: (i: any) => i?.mobile_no ?? i?.mobile ?? '—' },
      { label: 'Email', value: (i: any) => i?.email ?? '—' },
      { label: 'Product', value: (i: any) => i?.product ?? '—' },
      { label: 'Reference', value: (i: any) => i?.refid ?? '—' },
      { label: 'Pincode', value: (i: any) => i?.pincode ?? '—' },
      { label: 'State', value: (i: any) => i?.state ?? '—' },
    ]}
    emptyIcon="account-plus-outline"
    emptyTitle="No leads generated"
  />
);


/** Signed amount: debits leave the wallet, so they subtract from the net. */
const ledgerAmount = (i: any) =>
  String(i?.TYPE).toLowerCase() === 'debit' ? -Number(i?.AMOUNT ?? 0) : Number(i?.AMOUNT ?? 0);

/**
 * Ledger totals mirror the web portal: net movement plus what was earned and
 * withheld. A "failed" count is meaningless here — a ledger only ever contains
 * money that actually moved.
 */
const ledgerSummary = (rows: any[]) => {
  const sum = (key: string) => rows.reduce((acc, r) => acc + Number(r?.[key] ?? 0), 0);
  const net = rows.reduce((acc, r) => acc + ledgerAmount(r), 0);
  return [
    { label: 'Net amount', value: money(net), tone: net >= 0 ? ('success' as const) : ('error' as const) },
    { label: 'Commission', value: money(sum('COMMISSION')), tone: 'success' as const },
    { label: 'TDS', value: money(sum('TDS')), tone: 'warning' as const },
    { label: 'GST', value: money(sum('GST')), tone: 'warning' as const },
  ];
};

/** Ledger rows carry a direction, not a transaction status. */
const LEDGER_STATUSES = ['ALL', 'CREDIT', 'DEBIT'] as const;

/** Rows the gateway rejected — the ones whose REASON is worth surfacing. */
const ledgerFailed = (i: any) => /FAIL|REJECT/i.test(String(i?.remarks ?? ''));

/**
 * Both ledger endpoints answer with PaySprint's uppercase column names
 * (UTR/WALLET/AMOUNT/TYPE/NARRATION/remarks/DATE), not the camelCase
 * transaction shape the other reports use. Reading the wrong keys left every
 * field blank — amounts at ₹0.00 and an UNKNOWN pill on every row.
 */
export const WalletLedgerReport: React.FC = () => (
  <TransactionReport
    fetcher={async (range) => (await api.getWalletLedger(range)).data ?? []}
    searchFields={(i) =>
      [i?.UTR, i?.TXNTYPE, i?.WALLET, i?.NARRATION, i?.remarks, i?.REASON]
        .filter(Boolean)
        .join(' ')
    }
    // Signed: a ledger that renders debits as positive does not add up.
    amountOf={ledgerAmount}
    summary={ledgerSummary}
    statuses={LEDGER_STATUSES}
    // Direction is what a ledger row is filtered and coloured by; the
    // underlying transaction status stays available in the detail sheet.
    statusOf={(i) => i?.TYPE}
    dateOf={(i) => i?.DATE}
    titleOf={(i) => i?.NARRATION || i?.TXNTYPE || 'Ledger entry'}
    // A failed row without its reason is a mystery debit; show it on the card
    // so the retailer does not have to open every red entry to find out why.
    subtitleOf={(i) =>
      [i?.WALLET, i?.TXNTYPE, ledgerFailed(i) ? i?.REASON : ''].filter(Boolean).join(' · ')
    }
    details={[
      { label: 'Reference', value: (i: any) => i?.UTR || '—' },
      { label: 'Wallet', value: (i: any) => i?.WALLET || '—' },
      { label: 'Direction', value: (i: any) => (i?.TYPE ? String(i.TYPE).toUpperCase() : '—') },
      { label: 'Transaction status', value: (i: any) => i?.remarks || '—' },
      { label: 'Reason', value: (i: any) => i?.REASON || '—' },
      { label: 'Opening', value: (i: any) => (i?.OPENING != null ? money(i.OPENING) : '—') },
      { label: 'Closing', value: (i: any) => (i?.CLOSING != null ? money(i.CLOSING) : '—') },
      { label: 'Commission', value: (i: any) => (i?.COMMISSION ? money(i.COMMISSION) : '—') },
      { label: 'TDS', value: (i: any) => (i?.TDS ? money(i.TDS) : '—') },
      { label: 'GST', value: (i: any) => (i?.GST ? money(i.GST) : '—') },
    ]}
    emptyIcon="notebook-outline"
    emptyTitle="No ledger entries"
  />
);
