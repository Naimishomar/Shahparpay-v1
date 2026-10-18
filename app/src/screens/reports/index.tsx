import React from 'react';
import { TransactionReport, PageArgs, PageResult } from '@/components/ui/TransactionReport';
import { money, shortDate } from '@/components/ui/Screen';
import api from '@/services/api';

const txnSearch = (i: any) =>
  [i?.transactionId, i?.type, i?.status, i?.metadata?.caNumber, i?.metadata?.benename, i?.userId?.name, txnReason(i)]
    .filter(Boolean)
    .join(' ');

/** Transactions filtered by `type` prefix on /api/dashboard/recent-transactions. */
/** Rows per page. Enough to fill a tall phone twice over. */
export const PAGE_SIZE = 30;

/**
 * A server that predates paging answers without `page`: it ignored the paging,
 * search and status, and sent no totals. Until the new backend is deployed the
 * reports would otherwise show only the first rows and ₹ 0.00 tiles, so the
 * whole range is fetched once and filtered and totalled here instead.
 */
const isLegacy = (res: any) => res?.page === undefined;

const matches = (row: any, search: string, text: (r: any) => string) =>
  !search || text(row).toLowerCase().includes(search.toLowerCase());

/** One page of transactions of a type, filtered and totalled by the server. */
export const pagedTransactions =
  (type?: string) =>
  async ({ range, page, search, status }: PageArgs): Promise<PageResult> => {
    const res = await api.getRecentTransactions({
      ...range,
      type,
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      status: status === 'ALL' ? undefined : status,
    });
    if (!isLegacy(res)) return { rows: res.data ?? [], hasMore: !!res.hasMore, summary: res.summary };

    const all: any[] = (await api.getRecentTransactions({ ...range, type, limit: 1000 })).data ?? [];
    const rows = all.filter(
      (r) => (status === 'ALL' || String(r?.status).toUpperCase() === status) && matches(r, search, legacyTxnText)
    );
    const summary = rows.reduce(
      (acc, r) => {
        const amount = Number(r?.amount ?? 0);
        acc.count += 1;
        acc.volume += amount;
        if (r?.status === 'SUCCESS') acc.success += amount;
        if (r?.status === 'FAILED') acc.failed += 1;
        return acc;
      },
      { count: 0, volume: 0, success: 0, failed: 0 }
    );
    return { rows, hasMore: false, summary };
  };

const legacyTxnText = (i: any) =>
  [i?.transactionId, i?.type, i?.status, i?.metadata?.utr, i?.metadata?.rrn, i?.metadata?.mobile, i?.metadata?.name, i?.metadata?.beneficiaryName, i?.metadata?.caNumber, i?.metadata?.operatorName]
    .filter(Boolean)
    .join(' ');

const byType = pagedTransactions;

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

/** Wallet debits: the fee or amount a service takes out. */
const out = () => 'out' as const;

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
    pageFetcher={byType('AEPS')}
    searchFields={txnSearch}
    // A withdrawal credits the wallet; enquiries and statements carry no amount.
    flowOf={(i) => (Number(i?.amount) > 0 ? 'in' : undefined)}
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
    pageFetcher={byType('DMT')}
    searchFields={txnSearch}
    flowOf={out}
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
    pageFetcher={byType('RECHARGE')}
    searchFields={txnSearch}
    flowOf={out}
    titleOf={(i) => i?.metadata?.caNumber ?? 'Recharge'}
    subtitleOf={(i) => [i?.metadata?.operatorName, i?.metadata?.mode].filter(Boolean).join(' · ') || i?.transactionId || ''}
    details={[
      ...txnDetails,
      { label: 'Operator', value: (i: any) => i?.metadata?.operatorName || '—' },
      { label: 'Plan type', value: (i: any) => i?.metadata?.mode || '—' },
    ]}
    emptyIcon="cellphone"
    emptyTitle="No recharges yet"
  />
);

/**
 * Bill payments, split out of the recharge report the way the web portal
 * splits /reports/recharge from /reports/bbps: a retailer chasing a failed
 * electricity bill should not have to scroll past the day's mobile top-ups.
 */
export const BbpsReport: React.FC = () => (
  <TransactionReport
    pageFetcher={byType('BILL_PAYMENT')}
    searchFields={txnSearch}
    flowOf={out}
    titleOf={(i) => (i?.metadata?.mode ? `${i.metadata.mode} Bill` : 'Bill payment')}
    subtitleOf={(i) =>
      (txnFailed(i) && txnReason(i)) ||
      [i?.metadata?.billerName ?? i?.metadata?.operatorName, i?.metadata?.caNumber]
        .filter(Boolean)
        .join(' · ') ||
      i?.transactionId ||
      ''
    }
    details={[
      ...txnDetails,
      { label: 'Category', value: (i: any) => i?.metadata?.mode || '—' },
      { label: 'Biller', value: (i: any) => i?.metadata?.billerName ?? i?.metadata?.operatorName ?? '—' },
      { label: 'Bill number', value: (i: any) => i?.metadata?.billNumber ?? '—' },
    ]}
    emptyIcon="receipt"
    emptyTitle="No bill payments"
  />
);

export const UpiReport: React.FC = () => (
  <TransactionReport
    pageFetcher={byType('WALLET_TOPUP')}
    searchFields={txnSearch}
    flowOf={() => 'in'}
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
    flowOf={out}
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
    flowOf={out}
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
    flowOf={out}
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
 *
 * Commission is shown twice on purpose. The ledger's COMMISSION column is the
 * GROSS figure, but the wallet is credited net of 2% TDS, and Home's Earnings
 * tile reports that net (see retailerNetCommission on the backend). Showing
 * only the gross here left the two screens disagreeing by exactly the TDS with
 * nothing on either to explain the gap, so the earned line leads with the
 * number that actually reached the wallet and the gross sits beside it.
 */
const ledgerTiles = (s: { net?: number; commission?: number; tds?: number; gst?: number }) => {
  const net = Number(s.net ?? 0);
  const gross = Number(s.commission ?? 0);
  const tds = Number(s.tds ?? 0);
  return [
    { label: 'Net amount', value: money(net), tone: net >= 0 ? ('success' as const) : ('error' as const) },
    { label: 'Commission earned', value: money(gross - tds), tone: 'success' as const },
    { label: 'Commission (gross)', value: money(gross) },
    { label: 'TDS withheld', value: money(tds), tone: 'warning' as const },
    { label: 'GST', value: money(Number(s.gst ?? 0)), tone: 'warning' as const },
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
    pageFetcher={async ({ range, page, search, status }) => {
      const res = await api.getWalletLedger({
        ...range,
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        type: status === 'ALL' ? undefined : status.toLowerCase(),
      });
      if (!isLegacy(res)) return { rows: res.data ?? [], hasMore: !!res.hasMore, summary: res.summary };

      // Older server: it returned only the first rows and no totals.
      const all: any[] = (await api.getWalletLedger(range)).data ?? [];
      const rows = all.filter(
        (r) =>
          (status === 'ALL' || String(r?.TYPE).toUpperCase() === status) &&
          matches(r, search, (x) => [x?.UTR, x?.TXNTYPE, x?.WALLET, x?.NARRATION, x?.remarks, x?.REASON, x?.OPERATOR].join(' '))
      );
      const sum = (key: string) => rows.reduce((acc, r) => acc + Number(r?.[key] ?? 0), 0);
      return {
        rows,
        hasMore: false,
        summary: {
          net: rows.reduce((acc, r) => acc + ledgerAmount(r), 0),
          commission: sum('COMMISSION'),
          tds: sum('TDS'),
          gst: sum('GST'),
        },
      };
    }}
    summaryFrom={ledgerTiles}
    searchFields={(i) =>
      [i?.UTR, i?.TXNTYPE, i?.WALLET, i?.NARRATION, i?.remarks, i?.REASON]
        .filter(Boolean)
        .join(' ')
    }
    // Signed: a ledger that renders debits as positive does not add up.
    amountOf={ledgerAmount}
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
      { label: 'Operator', value: (i: any) => i?.OPERATOR || '—' },
      { label: 'Category', value: (i: any) => i?.CATEGORY || '—' },
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
