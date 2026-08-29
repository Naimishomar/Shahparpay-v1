import React from 'react';
import { View, Text, Share } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Row, money } from '@/components/ui/Screen';

export interface ReceiptData {
  status: 'SUCCESS' | 'FAILED';
  /** "Cash withdrawal", "Balance enquiry"… — shown as the receipt heading. */
  service: string;
  message?: string;
  agentName?: string;
  agentMobile?: string;
  customerName?: string;
  customerMobile?: string;
  /** Full number: the receipt masks it, callers should not pre-mask. */
  aadhaarNumber?: string;
  bankName?: string;
  amount?: number | string;
  balanceAmount?: number | string;
  rrn?: string;
  stan?: string;
  dateTime: string;
  miniStatement?: { date?: string; narration?: string; amount?: string | number; txnType?: string }[];
}

const maskAadhaar = (value?: string) =>
  value ? `XXXX XXXX ${String(value).slice(-4)}` : undefined;

/** Plain-text receipt for WhatsApp/SMS — the mobile counterpart of the web PDF. */
const asText = (data: ReceiptData) =>
  [
    'SHAHPARPAY — TRANSACTION RECEIPT',
    '',
    `Status       : ${data.status}`,
    `Service      : ${data.service}`,
    `Date         : ${data.dateTime}`,
    data.customerName && `Customer     : ${data.customerName}`,
    data.customerMobile && `Mobile       : ${data.customerMobile}`,
    data.aadhaarNumber && `Aadhaar      : ${maskAadhaar(data.aadhaarNumber)}`,
    data.bankName && `Bank         : ${data.bankName}`,
    data.amount !== undefined && `Amount       : ${money(data.amount)}`,
    data.balanceAmount !== undefined && `Balance      : ${money(data.balanceAmount)}`,
    data.rrn && `RRN          : ${data.rrn}`,
    data.stan && `STAN         : ${data.stan}`,
    data.agentName && `Agent        : ${data.agentName}`,
    '',
    'System generated receipt.',
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Outcome sheet for a completed AEPS call. Success and failure use the same
 * layout so the retailer reads the same fields in the same places either way —
 * only the status band and the copy change.
 */
export const TransactionReceipt: React.FC<{
  data: ReceiptData | null;
  onClose: () => void;
}> = ({ data, onClose }) => {
  if (!data) return null;
  const success = data.status === 'SUCCESS';

  return (
    <Sheet
      visible
      onClose={onClose}
      title={success ? 'Transaction successful' : 'Transaction failed'}
      subtitle={data.service}
      icon={success ? 'check-decagram' : 'alert-decagram'}
      footer={
        <View style={styles.footerRow}>
          <Button variant="secondary" onPress={onClose} style={styles.flex}>
            Close
          </Button>
          <Button
            icon="share-variant"
            onPress={() => Share.share({ message: asText(data) })}
            style={styles.flex}
          >
            Share
          </Button>
        </View>
      }
    >
      <View
        style={[styles.band, success ? styles.bandSuccess : styles.bandFailed]}
        accessibilityLiveRegion="polite"
      >
        <MaterialCommunityIcons
          name={success ? 'check-circle' : 'close-circle'}
          size={30}
          color={success ? colors.success : colors.destructive}
        />
        {data.amount !== undefined && (
          <Text style={[styles.amount, { color: success ? colors.success : colors.destructive }]}>
            {money(data.amount)}
          </Text>
        )}
        <Text style={styles.bandMessage}>
          {data.message || (success ? 'Completed by the bank.' : 'The bank declined this request.')}
        </Text>
      </View>

      <View style={styles.details}>
        <Row label="Date & time" value={data.dateTime} />
        {!!data.customerName && <Row label="Customer" value={data.customerName} />}
        {!!data.customerMobile && <Row label="Mobile" value={data.customerMobile} mono />}
        {!!data.aadhaarNumber && <Row label="Aadhaar" value={maskAadhaar(data.aadhaarNumber)} mono />}
        {!!data.bankName && <Row label="Bank" value={data.bankName} />}
        {data.balanceAmount !== undefined && (
          <Row label="Available balance" value={money(data.balanceAmount)} mono />
        )}
        {!!data.rrn && <Row label="RRN" value={data.rrn} mono />}
        {!!data.stan && <Row label="STAN" value={data.stan} mono />}
        {!!data.agentName && <Row label="Agent" value={data.agentName} last={!data.agentMobile} />}
        {!!data.agentMobile && <Row label="Agent mobile" value={data.agentMobile} mono last />}
      </View>

      {!!data.miniStatement?.length && (
        <View style={styles.statement}>
          <Text style={styles.statementTitle}>Last transactions</Text>
          {data.miniStatement.map((entry, index) => (
            <View key={index} style={styles.statementRow}>
              <View style={styles.statementInfo}>
                <Text style={styles.statementNarration} numberOfLines={2}>
                  {entry.narration || 'Transaction'}
                </Text>
                {!!entry.date && <Text style={styles.statementDate}>{entry.date}</Text>}
              </View>
              <Text
                style={[
                  styles.statementAmount,
                  { color: /cr/i.test(String(entry.txnType)) ? colors.success : colors.foreground },
                ]}
              >
                {money(entry.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
};

const styles = themed((c) => ({
  band: { alignItems: 'center', gap: 6, padding: space.xl, borderRadius: radius.lg },
  bandSuccess: { backgroundColor: c.successSubtle },
  bandFailed: { backgroundColor: c.destructiveSubtle },
  amount: { fontSize: t.h2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bandMessage: { fontSize: t.small, color: c.foreground, textAlign: 'center', lineHeight: 19 },
  details: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  statement: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    gap: space.sm,
  },
  statementTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  statementInfo: { flex: 1, minWidth: 0, gap: 2 },
  statementNarration: { fontSize: t.small, color: c.foreground },
  statementDate: { fontSize: t.micro, color: c.mutedForeground },
  statementAmount: { fontSize: t.small, fontWeight: '700', fontVariant: ['tabular-nums'] },
  footerRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
}));

export default TransactionReceipt;
