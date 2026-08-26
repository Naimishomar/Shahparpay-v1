import React from 'react';
import { TransactionReport } from '@/components/ui/TransactionReport';
import { money, shortDate } from '@/components/ui/Screen';
import api from '@/services/api';

const txnSearch = (i: any) =>
  [i?.transactionId, i?.type, i?.status, i?.metadata?.caNumber, i?.metadata?.benename, i?.userId?.name]
    .filter(Boolean)
    .join(' ');

/** Transactions filtered by `type` prefix on /api/dashboard/recent-transactions. */
const byType = (type: string) => async (range: { startDate?: string; endDate?: string }) =>
  (await api.getRecentTransactions({ type, limit: 1000, ...range })).data ?? [];

const txnDetails = [
  { label: 'Reference', value: (i: any) => i?.transactionId ?? '—' },
  { label: 'Type', value: (i: any) => String(i?.type ?? '—').replace(/_/g, ' ') },
  { label: 'Consumer', value: (i: any) => i?.metadata?.caNumber ?? i?.metadata?.mobile ?? '—' },
  { label: 'Remark', value: (i: any) => i?.metadata?.note ?? i?.apiResponse?.message ?? '—' },
];

export const AepsReport: React.FC = () => (
  <TransactionReport
    fetcher={byType('AEPS')}
    searchFields={txnSearch}
    titleOf={(i) => String(i?.type ?? 'AEPS').replace(/_/g, ' ')}
    subtitleOf={(i) => i?.transactionId ?? ''}
    details={txnDetails}
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
      { label: 'UTR', value: (i: any) => i?.metadata?.utr ?? i?.apiResponse?.utr ?? '—' },
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
      [i?.UTR, i?.TXNTYPE, i?.WALLET, i?.NARRATION, i?.remarks].filter(Boolean).join(' ')
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
    subtitleOf={(i) => [i?.WALLET, i?.TXNTYPE].filter(Boolean).join(' · ')}
    details={[
      { label: 'Reference', value: (i: any) => i?.UTR || '—' },
      { label: 'Wallet', value: (i: any) => i?.WALLET || '—' },
      { label: 'Direction', value: (i: any) => (i?.TYPE ? String(i.TYPE).toUpperCase() : '—') },
      { label: 'Transaction status', value: (i: any) => i?.remarks || '—' },
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

export const PaysprintLedgerReport: React.FC = () => (
  <TransactionReport
    fetcher={async (range) => {
      const res = await api.getPaysprintCreditLedger(range);
      return res.data ?? res.ledger ?? [];
    }}
    searchFields={(i) => [i?.SNO, i?.NARRATION, i?.TXNTYPE, i?.remarks].filter(Boolean).join(' ')}
    amountOf={ledgerAmount}
    summary={ledgerSummary}
    statuses={LEDGER_STATUSES}
    // The upstream ledger carries no status column — credit/debit is the only
    // per-row state, and StatusPill colours both.
    statusOf={(i) => i?.TYPE}
    titleOf={(i) => i?.NARRATION || i?.TXNTYPE || 'Ledger entry'}
    subtitleOf={(i) => [i?.TXNTYPE, i?.remarks].filter(Boolean).join(' · ')}
    dateOf={(i) => i?.DATE}
    details={[
      { label: 'Reference', value: (i: any) => i?.SNO || '—' },
      { label: 'Direction', value: (i: any) => (i?.TYPE ? String(i.TYPE).toUpperCase() : '—') },
      { label: 'Opening', value: (i: any) => (i?.OPENING != null ? money(i.OPENING) : '—') },
      { label: 'Closing', value: (i: any) => (i?.CLOSING != null ? money(i.CLOSING) : '—') },
      { label: 'Commission', value: (i: any) => (i?.COMMISSION ? money(i.COMMISSION) : '—') },
      { label: 'Remarks', value: (i: any) => i?.remarks || '—' },
      { label: 'Date', value: (i: any) => shortDate(i?.DATE) },
    ]}
    emptyIcon="swap-horizontal"
    emptyTitle="No upstream ledger entries"
  />
);
