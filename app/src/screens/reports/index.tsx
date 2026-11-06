import React, { useState } from 'react';
import { Share, View, Linking } from 'react-native';
import { TransactionReport, FilterGroup, PageArgs, PageResult, ReportColumn } from '@/components/ui/TransactionReport';
import { Button } from '@/components/ui/Button';
import { money, dateTime, Segmented, Toast } from '@/components/ui/Screen';
import api from '@/services/api';

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

// ---------------------------------------------------------------------------
// Every report below mirrors its web page (frontend/src/pages/*Report.tsx):
// the same endpoint and query, the same search fields and filters, the same
// totals and export columns. A table row is too wide for a phone, so the card
// shows the lead columns and the detail sheet carries the rest.
// ---------------------------------------------------------------------------

/**
 * Why a transaction ended the way it did — the web's reasonOf
 * (TransactionDetailModal). The AEPS and PAN flows write the gateway message
 * to `metadata.gatewayMessage`; resolveTransaction and the reconciliation
 * worker write `metadata.apiMessage`.
 */
const txnReason = (i: any) =>
  i?.metadata?.gatewayMessage || i?.metadata?.apiMessage || i?.metadata?.message || i?.metadata?.note || '';

/** Rows the gateway rejected — the ones whose reason is worth surfacing. */
const txnFailed = (i: any) => /FAIL|REJECT/i.test(String(i?.status ?? ''));

/**
 * Aadhaar is shown masked to the last four digits — the only form an AePS
 * outlet is allowed to display back.
 */
const maskAadhaar = (v: any) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : '—';
};

const NA = (v: any) => (v === undefined || v === null || v === '' ? 'N/A' : v);
const when = (v: any) => (v ? new Date(v).toLocaleString() : 'N/A');
const col = (label: string, value: (i: any) => any): ReportColumn => ({ label, value });

/** camelCase / snake_case key to a readable label, as the web modal prints metadata. */
const labelOf = (key: string) =>
  key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** Metadata the web modal shows above, or never shows to the outlet. */
const HIDDEN = new Set([
  'name', 'customerName', 'mobile', 'bankName', 'rrn', 'bankRRN', 'utr', 'orderId', 'apiProvider',
  'aadhaar', 'aadhar', 'aadhaarLast4', 'bankBalance', 'charges',
  'gatewayMessage', 'apiMessage', 'message', 'note',
  'latitude', 'longitude', 'qrImageUrl', 'paymentUrl',
]);

/**
 * The web's TransactionDetailModal, row for row. Date, amount and status sit in
 * the sheet's own header, so they are not repeated here.
 */
export const receiptRows = (tx: any): [string, string][] => {
  const m = tx?.metadata || {};
  const digits = String(m.aadhaar || m.aadhar || '').replace(/\D/g, '');
  const aadhaar =
    digits.length >= 4 ? `XXXX-XXXX-${digits.slice(-4)}` : m.aadhaarLast4 ? `XXXX-XXXX-${m.aadhaarLast4}` : '';
  const rows: [string, any][] = [
    ['Txn ID', tx?.transactionId || tx?._id],
    ['Order ID', m.orderId],
    ['RRN', m.rrn || m.bankRRN || m.utr],
    ['Provider', m.apiProvider],
    ['Type', tx?.type?.replace(/_/g, ' ')],
    ['Customer', m.name || m.customerName],
    ['Mobile', m.mobile],
    ['Aadhaar', aadhaar],
    ['Bank', m.bankName],
    ['Charges', m.charges != null ? `₹ ${m.charges}` : null],
    ['Bank Balance', m.bankBalance != null ? `₹ ${m.bankBalance}` : null],
    ...Object.entries(m)
      .filter(([k, v]) => !HIDDEN.has(k) && v !== '' && v != null && typeof v !== 'object')
      .map(([k, v]) => [labelOf(k), String(v)] as [string, any]),
    ...(Array.isArray(m.ministatement)
      ? m.ministatement.map(
          (r: any, n: number) =>
            [`Mini Statement ${n + 1}`, Object.values(r ?? {}).map((v) => String(v ?? '')).join(' | ')] as [string, any]
        )
      : []),
    ['Message', txnReason(tx)],
  ];
  // One row per label: a metadata key can spell the same label as a fixed row.
  const seen = new Set<string>();
  return rows.filter(([k, v]) => v != null && v !== '' && !seen.has(k) && !!seen.add(k)) as [string, string][];
};

const receiptDetails = (tx: any): ReportColumn[] => receiptRows(tx).map(([k, v]) => col(k, () => v));

/** Plain-text receipt for WhatsApp/SMS — the mobile counterpart of the web's Print / Download PDF. */
const receiptText = (tx: any) =>
  [
    'SHAHPARPAY — TRANSACTION DETAILS',
    '',
    `Date & Time: ${dateTime(tx?.createdAt)}`,
    `Amount: ₹ ${tx?.amount || 0}`,
    `Transaction Status: ${tx?.status || 'UNKNOWN'}`,
    ...receiptRows(tx).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');

const shareReceipt = (tx: any) => (
  <Button
    variant="outline"
    icon="share-variant"
    onPress={() => Share.share({ message: receiptText(tx) }).catch(() => {})}
    fullWidth
  >
    Share receipt
  </Button>
);

/** /api/dashboard/recent-transactions?limit=1000[&type=…], as every web transaction report calls it. */
const recent =
  (type?: string) =>
  async (range: { startDate?: string; endDate?: string }) =>
    (
      await api.getRecentTransactions({
        limit: 1000,
        type,
        // The web sends the range only once both ends are picked.
        ...(range.startDate && range.endDate ? range : {}),
      })
    ).data ?? [];

/** The web's search on the transaction reports: ID, mobile, customer name. */
const idMobileName = (i: any) =>
  [i?.transactionId, i?.metadata?.mobile, i?.metadata?.name].filter(Boolean).join(' ');

/** Card for a wallet transaction: customer first, bank / mobile under it, the reason when it failed. */
const customerTitle = (i: any) => i?.metadata?.name || i?.metadata?.customerName || i?.transactionId || 'N/A';
const bankMobile = (i: any) =>
  (txnFailed(i) && txnReason(i)) ||
  [i?.metadata?.bankName, i?.metadata?.mobile].filter(Boolean).join(' · ') ||
  i?.transactionId ||
  '';

/** AEPS withdrawal money is credited only after bank success. */
const displayStatus = (tx: any) => {
  if (tx?.type === 'AEPS_WITHDRAWAL' && tx?.status !== 'SUCCESS') {
    return tx?.status === 'PROCESSING' ? 'PENDING - NOT CREDITED' : 'DECLINED - NOT CREDITED';
  }
  return tx?.status || 'UNKNOWN';
};

/** The web's getCrDr for each page, as a + / − on the card. */
type CrDr = 'CR' | 'DR' | 'NONE';
const flowOfCrDr = (crDr: (tx: any) => CrDr) => (tx: any) => {
  const d = crDr(tx);
  return d === 'CR' ? ('in' as const) : d === 'DR' ? ('out' as const) : undefined;
};
const guardedCrDr =
  (credits: string[], debits: string[], refunds: boolean) =>
  (tx: any): CrDr => {
    // Balance enquiry and mini statement are ₹0 rows; they move no money.
    if (!Number(tx?.amount)) return 'NONE';
    if (tx?.type === 'AEPS_WITHDRAWAL' && tx?.status !== 'SUCCESS') return 'NONE';
    if (refunds && String(tx?.transactionId ?? '').startsWith('REF-')) return 'CR';
    if (credits.includes(tx?.type)) return 'CR';
    if (debits.includes(tx?.type)) return 'DR';
    return 'CR';
  };
const allCrDr = guardedCrDr(
  ['AEPS_WITHDRAWAL', 'WALLET_TOPUP', 'REFUND'],
  ['BILL_PAYMENT', 'RECHARGE', 'AEPS_SETTLEMENT', 'DMT', 'DIRECT_PAYOUT'],
  true
);
const aepsCrDr = guardedCrDr(['AEPS_WITHDRAWAL', 'WALLET_TOPUP'], ['BILL_PAYMENT', 'RECHARGE', 'AEPS_SETTLEMENT', 'AEPS'], false);
/** DMT / Payout / UPI: no ₹0 or pending guard on those pages. */
const simpleCrDr = (tx: any): CrDr =>
  ['BILL_PAYMENT', 'RECHARGE', 'AEPS_SETTLEMENT', 'DMT'].includes(tx?.type) ? 'DR' : 'CR';

/** Credit / Debit columns of the web CSV for a direction. */
const crDrCells = (tx: any, d: CrDr) => [d === 'CR' ? tx?.amount || 0 : 0, d === 'DR' ? tx?.amount || 0 : 0];

const noTotals = () => [];

/** All Reports (/reports/ledger): every transaction, with the web's date range. */
export const LedgerReport: React.FC = () => (
  <TransactionReport
    fetcher={recent()}
    searchFields={idMobileName}
    searchPlaceholder="Search ID or Mobile..."
    statuses={['ALL']}
    summary={noTotals}
    flowOf={flowOfCrDr(allCrDr)}
    statusOf={displayStatus}
    titleOf={customerTitle}
    subtitleOf={bankMobile}
    details={(tx) => [
      ...(tx?.userId?.name ? [col('By', () => tx.userId.name)] : []),
      ...receiptDetails(tx),
    ]}
    detailActions={shareReceipt}
    exportCsv={{
      filename: `LedgerReport_${Date.now()}.csv`,
      headers: ['S.No.', 'Transaction ID', 'Date', 'Customer', 'Mobile', 'Credit', 'Debit', 'Status'],
      row: (tx, n) => [
        n + 1,
        tx.transactionId || tx._id || 'N/A',
        when(tx.createdAt),
        tx.metadata?.name || tx.metadata?.customerName || 'N/A',
        tx.metadata?.mobile || 'N/A',
        ...crDrCells(tx, allCrDr(tx)),
        displayStatus(tx),
      ],
    }}
    emptyIcon="file-document-multiple-outline"
    emptyTitle="No transactions found."
  />
);

export const AepsReport: React.FC = () => (
  <TransactionReport
    fetcher={recent('AEPS')}
    dateFilter={false}
    searchFields={(i) => [idMobileName(i), txnReason(i)].filter(Boolean).join(' ')}
    searchPlaceholder="Search ID or Mobile..."
    statuses={['ALL']}
    summary={noTotals}
    flowOf={flowOfCrDr(aepsCrDr)}
    statusOf={displayStatus}
    titleOf={customerTitle}
    subtitleOf={(i) =>
      (txnFailed(i) && txnReason(i)) ||
      [String(i?.type ?? '').replace(/_/g, ' '), i?.metadata?.bankName].filter(Boolean).join(' · ')
    }
    details={receiptDetails}
    detailActions={shareReceipt}
    exportCsv={{
      filename: `AepsReport_${Date.now()}.csv`,
      headers: ['S.No.', 'Transaction ID', 'Type', 'Date', 'Customer', 'Aadhaar', 'Mobile', 'Credit', 'Debit', 'Bank Balance', 'Status', 'Reason'],
      row: (tx, n) => {
        const balance = Number(tx.metadata?.bankBalance);
        const aadhaar = maskAadhaar(tx.metadata?.aadhaar || tx.metadata?.aadhar);
        return [
          n + 1,
          tx.transactionId || tx._id || 'N/A',
          tx.type?.replace(/_/g, ' ') || 'N/A',
          when(tx.createdAt),
          tx.metadata?.name || tx.metadata?.customerName || 'N/A',
          aadhaar === '—' ? 'N/A' : aadhaar,
          tx.metadata?.mobile || 'N/A',
          ...crDrCells(tx, aepsCrDr(tx)),
          tx.metadata?.bankBalance != null && Number.isFinite(balance) ? balance : 'N/A',
          displayStatus(tx),
          txnReason(tx) || 'N/A',
        ];
      },
    }}
    emptyIcon="fingerprint"
    emptyTitle="No transactions found."
  />
);

/** DMT, Payout and UPI are one web page with a different `type`. */
const simpleReport = (type: string, file: string, icon: string): React.FC => {
  const Report: React.FC = () => (
    <TransactionReport
      fetcher={recent(type)}
      dateFilter={false}
      searchFields={idMobileName}
      searchPlaceholder="Search ID or Mobile..."
      statuses={['ALL']}
      summary={noTotals}
      flowOf={flowOfCrDr(simpleCrDr)}
      titleOf={customerTitle}
      subtitleOf={bankMobile}
      details={receiptDetails}
      detailActions={shareReceipt}
      exportCsv={{
        filename: `${file}_${Date.now()}.csv`,
        headers: ['S.No.', 'Transaction ID', 'Date', 'Customer', 'Mobile', 'Credit', 'Debit', 'Status'],
        row: (tx, n) => [
          n + 1,
          tx.transactionId || tx._id || 'N/A',
          when(tx.createdAt),
          tx.metadata?.name || tx.metadata?.customerName || 'N/A',
          tx.metadata?.mobile || 'N/A',
          ...crDrCells(tx, simpleCrDr(tx)),
          tx.status || 'UNKNOWN',
        ],
      }}
      emptyIcon={icon}
      emptyTitle="No transactions found."
    />
  );
  return Report;
};

export const DmtReport = simpleReport('DMT', 'DmtReport', 'bank-transfer');
/** The web's Payout report lists AEPS settlements from the transaction log. */
export const PayoutReport = simpleReport('AEPS_SETTLEMENT', 'PayoutReport', 'cash-fast');
export const UpiReport = simpleReport('UPI', 'UpiReport', 'qrcode');

/** Recharge and BBPS: the web's ServiceReport. */
const SERVICE_STATUSES = ['ALL', 'SUCCESS', 'PROCESSING', 'FAILED', 'REFUNDED'];
const SERVICE_STATUS_LABELS = { ALL: 'All Status', SUCCESS: 'Success', PROCESSING: 'Pending', FAILED: 'Failed', REFUNDED: 'Refunded' };

const serviceReport = (kind: 'recharge' | 'bbps'): React.FC => {
  const fallback = kind === 'recharge' ? 'Recharge' : 'BBPS';
  const service = (i: any) => i?.metadata?.mode || fallback;
  const operator = (i: any) => i?.metadata?.operator || 'N/A';
  const number = (i: any) => i?.metadata?.caNumber || i?.metadata?.mobile || 'N/A';
  const commission = (i: any) => Number(i?.commissions?.retailerEarned || 0);
  const Report: React.FC = () => (
    <TransactionReport
      fetcher={recent(kind === 'recharge' ? 'RECHARGE' : 'BILL_PAYMENT')}
      searchFields={(i) =>
        [i?.transactionId, i?.metadata?.caNumber, i?.metadata?.mobile, i?.metadata?.operator, i?.metadata?.mode]
          .filter(Boolean)
          .join(' ')
      }
      searchPlaceholder="Search ID, number, operator"
      statuses={SERVICE_STATUSES}
      statusLabels={SERVICE_STATUS_LABELS}
      summary={(rows) => [
        { label: 'Transactions', value: String(rows.length) },
        { label: 'Success', value: String(rows.filter((r) => r?.status === 'SUCCESS').length), tone: 'success' },
        { label: 'Commission', value: money(rows.reduce((sum, r) => sum + commission(r), 0)), tone: 'success' },
      ]}
      titleOf={number}
      subtitleOf={(i) =>
        (i?.status === 'FAILED' && txnReason(i)) || [service(i), operator(i)].join(' · ')
      }
      details={(tx) => [
        col('Service', service),
        col('Operator / Biller', operator),
        col('Customer Number', number),
        col('Commission', (i) => money(commission(i))),
        ...receiptDetails(tx),
      ]}
      detailActions={shareReceipt}
      exportCsv={{
        filename: `${fallback}Report_${Date.now()}.csv`,
        headers: ['S.No.', 'Transaction ID', 'Date', 'Service', 'Operator', 'Number', 'Amount', 'Commission', 'Status'],
        row: (tx, n) => [
          n + 1,
          tx.transactionId || tx._id || 'N/A',
          when(tx.createdAt),
          service(tx),
          operator(tx),
          number(tx),
          Number(tx.amount || 0).toFixed(2),
          commission(tx).toFixed(2),
          tx.status || 'UNKNOWN',
        ],
      }}
      emptyIcon={kind === 'recharge' ? 'cellphone' : 'receipt'}
      emptyTitle={`No ${kind} transactions found.`}
    />
  );
  return Report;
};

export const RechargeReport = serviceReport('recharge');
export const BbpsReport = serviceReport('bbps');

const PAN_TYPES = 'PAN_CARD,STD_PAN_CARD,PAN_SERVICE,PAN_COUPON';
const panTypeLabel = (type: string) =>
  ({
    PAN_CARD: 'Biometric PSA',
    STD_PAN_CARD: 'Standard Web PSA',
    PAN_SERVICE: 'eSevaTech PAN Service',
    PAN_COUPON: 'eSevaTech PAN Coupon',
  })[type] ?? type;
const panStatus = (i: any) => i?.metadata?.eseva_status || i?.status || 'UNKNOWN';
const psaOrApp = (i: any) => i?.metadata?.psa_id || i?.metadata?.application_number || 'N/A';
const panCustomer = (i: any) => i?.metadata?.name || i?.metadata?.shop_name || i?.metadata?.customerName || 'N/A';

export const PanReport: React.FC = () => (
  <TransactionReport
    fetcher={recent(PAN_TYPES)}
    dateFilter={false}
    searchFields={(i) =>
      [i?.transactionId, i?.metadata?.mobile, i?.metadata?.name, i?.metadata?.shop_name, i?.metadata?.application_number, i?.metadata?.psa_id]
        .filter((v) => v != null && v !== '')
        .join(' ')
    }
    searchPlaceholder="Search ID, PSA ID, or Mobile..."
    statuses={['ALL']}
    summary={noTotals}
    statusOf={panStatus}
    titleOf={(i) => panTypeLabel(i?.type)}
    subtitleOf={(i) => [psaOrApp(i), panCustomer(i)].join(' · ')}
    details={(tx) => [
      col('PAN Type', (i) => panTypeLabel(i?.type)),
      col('PSA ID / App No.', psaOrApp),
      col('Customer / Shop', panCustomer),
      ...receiptDetails(tx),
    ]}
    detailActions={shareReceipt}
    exportCsv={{
      filename: `PanReport_${Date.now()}.csv`,
      headers: ['S.No.', 'Transaction ID', 'Date', 'PAN Type', 'PSA ID', 'Customer', 'Mobile', 'Amount (₹)', 'Status'],
      row: (tx, n) => [
        n + 1,
        tx.transactionId || tx._id || 'N/A',
        when(tx.createdAt),
        panTypeLabel(tx.type),
        psaOrApp(tx),
        panCustomer(tx),
        tx.metadata?.mobile || 'N/A',
        tx.amount || 0,
        panStatus(tx),
      ],
    }}
    emptyIcon="card-account-details-outline"
    emptyTitle="No PAN transactions found."
  />
);

const ITR_STATUSES = ['ALL', 'SUCCESS', 'FAILED', 'REFUNDED', 'PROCESSING', 'PENDING'];
const itrDetails = (i: any) =>
  i?.metadata?.message ||
  `Fee: ₹${i?.metadata?.eseva_fee || 0} | Margin: ₹${i?.metadata?.partner_margin || 0} | GST: ₹${i?.metadata?.gst_amount || 0}`;

export const ItrReport: React.FC = () => {
  // The web's cards count the whole history, not the filtered rows.
  const [all, setAll] = useState<any[]>([]);
  return (
    <TransactionReport
      fetcher={async () => {
        const res = await api.getItrHistory();
        const rows = res.transactions ?? res.data ?? [];
        setAll(rows);
        return rows;
      }}
      dateFilter={false}
      searchFields={(i) =>
        [i?.transactionId, i?.metadata?.application_id, i?.metadata?.applicant_name, i?.metadata?.pan_number]
          .filter((v) => v != null && v !== '')
          .join(' ')
      }
      searchPlaceholder="Search App ID, Txn ID, PAN..."
      statuses={ITR_STATUSES}
      statusLabels={{ ALL: 'All Statuses' }}
      summary={() => [
        { label: 'Total Filings', value: String(all.length) },
        { label: 'Successful', value: String(all.filter((t) => t?.status === 'SUCCESS').length), tone: 'success' },
        { label: 'Refunded', value: String(all.filter((t) => t?.status === 'REFUNDED').length), tone: 'warning' },
        { label: 'Total Amount', value: `₹ ${all.reduce((s, t) => s + (t?.amount || 0), 0).toLocaleString('en-IN')}` },
      ]}
      titleOf={(i) => i?.metadata?.applicant_name || 'N/A'}
      subtitleOf={(i) => `#${i?.metadata?.application_id || 'N/A'} · ${i?.metadata?.pan_number || 'N/A'}`}
      details={[
        col('App ID', (i) => `#${i?.metadata?.application_id || 'N/A'}`),
        col('Txn ID', (i) => NA(i?.transactionId)),
        col('Applicant', (i) => NA(i?.metadata?.applicant_name)),
        col('PAN', (i) => NA(i?.metadata?.pan_number)),
        col('Details', itrDetails),
      ]}
      exportCsv={{
        filename: `ItrReport_${Date.now()}.csv`,
        headers: ['S.No.', 'Application ID', 'Transaction ID', 'Applicant', 'PAN', 'Amount (₹)', 'Status', 'Date', 'Details'],
        row: (t, n) => [
          n + 1,
          t.metadata?.application_id || 'N/A',
          t.transactionId || 'N/A',
          t.metadata?.applicant_name || 'N/A',
          t.metadata?.pan_number || 'N/A',
          t.amount || 0,
          t.status || 'UNKNOWN',
          when(t.createdAt),
          itrDetails(t),
        ],
      }}
      emptyIcon="file-document-outline"
      emptyTitle="No ITR filings found."
    />
  );
};

const LEAD_PRODUCTS: Record<string, string> = {
  CC: 'Credit Card',
  PL: 'Personal Loan',
  BL: 'Business Loan',
  IL: 'Instant Loan',
  SA: 'Savings Account',
};
const productName = (id: string) => LEAD_PRODUCTS[id] || id;
const leadStatus = (l: any) => l?.executive_status || 'PENDING';

export const LeadReport: React.FC = () => {
  const [nonce, setNonce] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' }>({ message: '', tone: 'info' });
  const checkStatus = async (refid: string, close: () => void) => {
    // The toast sits under the detail sheet's modal, so the sheet goes first.
    close();
    setToast({ message: `Checking status for ${refid}...`, tone: 'info' });
    try {
      const data = await api.getLeadStatus(refid);
      if (data.success) {
        setToast({ message: `Status updated: ${data.data?.executive_status || 'Pending'}`, tone: 'success' });
        setNonce((n) => n + 1);
      } else {
        setToast({ message: data.message || 'Failed to fetch status.', tone: 'error' });
      }
    } catch {
      setToast({ message: 'An error occurred while checking status.', tone: 'error' });
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <TransactionReport
        fetcher={async () => (await api.getLeadHistory()).data ?? []}
        fetchKey={String(nonce)}
        dateFilter={false}
        searchFields={(l) => [l?.name, l?.mobile_no, l?.refid, l?.email].filter(Boolean).join(' ')}
        searchPlaceholder="Search name, mobile, ref ID..."
        statuses={['ALL']}
        summary={noTotals}
        amountOf={() => 0}
        statusOf={leadStatus}
        titleOf={(l) => l?.name || 'N/A'}
        subtitleOf={(l) => [productName(l?.product), l?.refid].filter(Boolean).join(' · ')}
        details={[
          col('Customer', (l) => NA(l?.name)),
          col('Email', (l) => l?.email || '—'),
          col('Mobile', (l) => NA(l?.mobile_no)),
          col('Product', (l) => productName(l?.product)),
          col('Ref ID', (l) => NA(l?.refid)),
          col('State', (l) => NA(l?.state)),
        ]}
        detailActions={(l, close) => (
          <View style={{ gap: 8 }}>
            <Button variant="outline" icon="refresh" onPress={() => checkStatus(l.refid, close)} fullWidth>
              Check Status
            </Button>
            {!!l?.url && (
              // ponytail: the web POSTs `encdata` in a hidden form; a phone can only open the URL.
              <Button variant="outline" icon="open-in-new" onPress={() => Linking.openURL(l.url).catch(() => {})} fullWidth>
                Link
              </Button>
            )}
          </View>
        )}
        exportCsv={{
          filename: `LeadGenerationReport_${Date.now()}.csv`,
          headers: ['S.No.', 'Customer', 'Mobile', 'Email', 'Product', 'Ref ID', 'Pincode', 'State', 'Status', 'Date'],
          row: (l, n) => [
            n + 1,
            l.name || 'N/A',
            l.mobile_no || 'N/A',
            l.email || 'N/A',
            productName(l.product),
            l.refid || 'N/A',
            l.pincode || 'N/A',
            l.state || 'N/A',
            leadStatus(l),
            when(l.createdAt),
          ],
        }}
        emptyIcon="account-plus-outline"
        emptyTitle="No leads found."
      />
      <Toast message={toast.message} tone={toast.tone} onHide={() => setToast((s) => ({ ...s, message: '' }))} />
    </View>
  );
};

/** Signed amount: debits leave the wallet, so they subtract from the net. */
const ledgerAmount = (i: any) =>
  String(i?.TYPE).toLowerCase() === 'debit' ? -Number(i?.AMOUNT ?? 0) : Number(i?.AMOUNT ?? 0);

/** The web ledger's footer: Net Amount, Commission, TDS, GST (18%) over the filtered rows. */
const ledgerTotals = (rows: any[]) => {
  const sum = (key: string) => rows.reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0);
  return { net: rows.reduce((acc, r) => acc + (ledgerAmount(r) || 0), 0), commission: sum('COMMISSION'), tds: sum('TDS'), gst: sum('GST') };
};

const ledgerTiles = (s: { net?: number; commission?: number; tds?: number; gst?: number }) => {
  const net = Number(s.net ?? 0);
  return [
    { label: 'Net Amount', value: money(net), tone: net >= 0 ? ('success' as const) : ('error' as const) },
    { label: 'Commission', value: money(Number(s.commission ?? 0)), tone: 'success' as const },
    { label: 'TDS', value: money(Number(s.tds ?? 0)), tone: 'error' as const },
    { label: 'GST (18%)', value: money(Number(s.gst ?? 0)), tone: 'error' as const },
  ];
};

/** The web's Type select: a ledger row carries a direction, not a transaction status. */
const LEDGER_STATUSES = ['ALL', 'CREDIT', 'DEBIT', 'TRANSFER'] as const;
const LEDGER_LABELS = { ALL: 'All Types', CREDIT: 'Credit', DEBIT: 'Debit', TRANSFER: 'Transfer' };
const WALLETS = [
  { key: 'ALL', label: 'All Wallets' },
  { key: 'AEPS', label: 'Trade Wallet' },
  { key: 'MAIN', label: 'Utility Wallet' },
];

/** Rows the gateway rejected — the ones whose REASON is worth surfacing. */
const ledgerFailed = (i: any) => /FAIL|REJECT/i.test(String(i?.remarks ?? ''));

const fmt = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(2);

/**
 * Ledgar (/reports/wallet-ledger). The endpoint answers with PaySprint's
 * uppercase column names (UTR/WALLET/AMOUNT/TYPE/NARRATION/remarks/DATE), not
 * the camelCase transaction shape the other reports use.
 */
export const WalletLedgerReport: React.FC = () => {
  const [wallet, setWallet] = useState('ALL');
  const [txnType, setTxnType] = useState('ALL');
  const [balances, setBalances] = useState({ main: 0, aeps: 0 });
  return (
    <TransactionReport
      fetcher={async (range) => {
        const res = await api.getWalletLedger({
          ...(wallet !== 'ALL' ? { wallet } : {}),
          ...(range.startDate ? { startDate: range.startDate } : {}),
          ...(range.endDate ? { endDate: range.endDate } : {}),
        });
        setBalances({ main: Number(res.currentMain) || 0, aeps: Number(res.currentAeps ?? 0) || 0 });
        return res.data ?? [];
      }}
      fetchKey={wallet}
      rowFilter={txnType === 'ALL' ? undefined : (r) => r?.TXNTYPE === txnType}
      extraActive={(wallet !== 'ALL' ? 1 : 0) + (txnType !== 'ALL' ? 1 : 0)}
      onClearFilters={() => {
        setWallet('ALL');
        setTxnType('ALL');
      }}
      filterExtra={(_close, rows) => (
        <>
          <FilterGroup label="Wallet">
            <Segmented options={WALLETS} value={wallet} onChange={setWallet} />
          </FilterGroup>
          <FilterGroup label="Txn Type">
            <Segmented
              options={[
                { key: 'ALL', label: 'All Txn Types' },
                ...[...new Set(rows.map((r) => r?.TXNTYPE).filter(Boolean))].sort().map((t) => ({ key: t, label: t })),
              ]}
              value={txnType}
              onChange={setTxnType}
            />
          </FilterGroup>
        </>
      )}
      summary={(rows) => [
        { label: 'AEPS', value: `₹${fmt(balances.aeps)}` },
        { label: 'Main', value: `₹${fmt(balances.main)}` },
        ...(rows.length ? ledgerTiles(ledgerTotals(rows)) : []),
      ]}
      searchFields={(i) => [i?.UTR, i?.NARRATION, i?.REASON, i?.TXNTYPE].filter(Boolean).join(' ')}
      searchPlaceholder="Search UTR, narration, txn type..."
      // Signed: a ledger that renders debits as positive does not add up.
      amountOf={ledgerAmount}
      statuses={LEDGER_STATUSES}
      statusLabels={LEDGER_LABELS}
      statusTitle="Type"
      statusOf={(i) => i?.TYPE}
      dateOf={(i) => i?.DATE}
      titleOf={(i) => i?.NARRATION || '-'}
      // A failed row shows its reason under the narration, as on the web.
      subtitleOf={(i) =>
        [i?.WALLET || 'Utility', i?.TXNTYPE || 'N/A', ledgerFailed(i) ? i?.REASON : ''].filter(Boolean).join(' · ')
      }
      details={[
        col('UTR No', (i) => i?.UTR || 'N/A'),
        col('Wallet', (i) => i?.WALLET || 'Utility'),
        col('Opening', (i) => fmt(i?.OPENING)),
        col('Commission', (i) => (i?.COMMISSION ? fmt(i.COMMISSION) : '-')),
        col('TDS', (i) => (i?.TDS ? fmt(i.TDS) : '-')),
        col('GST', (i) => (i?.GST ? fmt(i.GST) : '-')),
        col('Closing', (i) => fmt(i?.CLOSING)),
        col('Type', (i) => String(i?.TYPE ?? '').toUpperCase() || '—'),
        col('Narration', (i) => i?.NARRATION || '-'),
        col('Txn Type', (i) => i?.TXNTYPE || 'N/A'),
        col('Reason', (i) => (ledgerFailed(i) && i?.REASON) || '—'),
      ]}
      exportCsv={{
        filename: `WalletLedger_${Date.now()}.csv`,
        headers: ['UTR', 'WALLET', 'OPENING', 'AMOUNT', 'COMMISSION', 'TDS', 'GST', 'CLOSING', 'TYPE', 'NARRATION', 'TXNTYPE', 'STATUS', 'REASON', 'DATE'],
        row: (r) => [
          r.UTR, r.WALLET, fmt(r.OPENING), fmt(r.AMOUNT), fmt(r.COMMISSION), fmt(r.TDS), fmt(r.GST), fmt(r.CLOSING),
          r.TYPE, r.NARRATION, r.TXNTYPE, r?.remarks || '', r.REASON || '', r.DATE,
        ],
      }}
      emptyIcon="notebook-outline"
      emptyTitle="No ledger entries found."
    />
  );
};
