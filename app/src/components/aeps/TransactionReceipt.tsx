import React from 'react';
import { View, Text, Share, Modal, ScrollView, StyleSheet } from 'react-native';
import { useModalInsets } from '@/hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { money } from '@/components/ui/Screen';
import { GradientFill } from '@/components/ui/Gradient';
import { ActionButton } from './BiometricCapture';

export interface ReceiptData {
  /** PENDING: the bank has not confirmed yet and the retailer must not retry. */
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
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

/** Success / Pending / Failed as a small coloured caption, as BHIM lists show it. */
export const StatusText: React.FC<{ status?: string }> = ({ status }) => {
  const key = String(status || '').toUpperCase();
  const tone = /^(SUCCESS|VERIFIED|ACTIVE|APPROVED)$/.test(key)
    ? colors.success
    : /^(FAILED|REFUNDED|REJECTED)$/.test(key)
      ? colors.destructive
      : colors.warning;
  const label = key ? key[0] + key.slice(1).toLowerCase() : 'Pending';
  return <Text style={[styles.status, { color: tone }]}>{label}</Text>;
};

const maskAadhaar = (value?: string) =>
  value ? `XXXX XXXX ${String(value).slice(-4)}` : undefined;

/** Headline amount: whole rupees drop the paise ("₹ 3,000"), anything else keeps them. */
const headline = (value: number | string) =>
  Number.isInteger(Number(value)) ? `₹\u00A0${Number(value).toLocaleString('en-IN')}` : money(value);

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
 * Full-screen outcome, BHIM's payment-successful screen: a full-bleed green
 * band (red on failure) with a white tick badge and the amount, then a dark
 * receipt card pulled up over its edge. Success and failure share the layout
 * so the retailer reads the same fields in the same places either way.
 */
export const TransactionReceipt: React.FC<{
  data: ReceiptData | null;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const insets = useModalInsets();
  if (!data) return null;
  const success = data.status === 'SUCCESS';
  const pending = data.status === 'PENDING';
  const kv = (label: string, value?: React.ReactNode) =>
    value === undefined || value === null || value === '' ? null : (
      <View style={styles.kv} key={label}>
        <Text style={styles.kvLabel}>{label}</Text>
        <Text style={styles.kvValue}>{value}</Text>
      </View>
    );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View
            style={[styles.band, success ? styles.bandSuccess : pending ? styles.bandPending : styles.bandFailed, { paddingTop: 40 + insets.top }]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.shade} />
            {/* The band melts into the ground behind the receipt card, as BHIM's does. */}
            <View style={styles.fade}>
              <GradientFill stops={['transparent', colors.background]} />
            </View>
            <View style={styles.tickWrap}>
              <View style={styles.halo} />
              <View style={styles.tick}>
                <Ionicons
                  name={success ? 'checkmark' : pending ? 'time-outline' : 'close'}
                  size={36}
                  color={success ? colors.success : pending ? colors.warning : colors.destructive}
                />
              </View>
            </View>
            <Text style={styles.bandTitle}>
              {data.service} {success ? 'successful' : pending ? 'pending' : 'failed'}
            </Text>
            {data.amount !== undefined && <Text style={styles.amount}>{headline(data.amount)}</Text>}
            <Text style={styles.bandDate}>{data.dateTime}</Text>
            {!success && !!data.message && <Text style={styles.bandMessage}>{data.message}</Text>}
          </View>

          <View style={styles.receipt}>
            {kv('Customer', data.customerName)}
            {kv('Mobile', data.customerMobile?.replace(/^(\d{5})(\d+)$/, '$1 $2'))}
            {kv('Aadhaar', maskAadhaar(data.aadhaarNumber))}
            {kv('Bank', data.bankName)}
            <View style={styles.dash} />
            {kv('Available balance', data.balanceAmount !== undefined ? money(data.balanceAmount) : undefined)}
            {kv('Bank ref (RRN)', data.rrn)}
            {kv('STAN', data.stan)}
            {kv('Agent', data.agentName)}
            {kv('Agent mobile', data.agentMobile)}
          </View>

          {!!data.miniStatement?.length && (
            <View style={[styles.receipt, styles.statement]}>
              <Text style={styles.statementTitle}>Last transactions</Text>
              {data.miniStatement.map((entry, index) => (
                <View key={index} style={styles.kv}>
                  <View style={styles.statementInfo}>
                    <Text style={styles.statementNarration} numberOfLines={2}>
                      {entry.narration || 'Transaction'}
                    </Text>
                    {!!entry.date && <Text style={styles.kvLabel}>{entry.date}</Text>}
                  </View>
                  <Text
                    style={[
                      styles.kvValue,
                      { color: /cr/i.test(String(entry.txnType)) ? colors.success : colors.foreground },
                    ]}
                  >
                    {money(entry.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: 16 + insets.bottom }]}>
          <ActionButton
            ghost
            icon="share-variant"
            label="Share"
            onPress={() => Share.share({ message: asText(data) })}
            style={styles.flex}
          />
          <ActionButton label="Done" onPress={onClose} style={styles.flex} />
        </View>
      </View>
    </Modal>
  );
};

const styles = themed((c, isDark) => ({
  page: { flex: 1, backgroundColor: c.background },
  scroll: { paddingBottom: space.xxl },
  band: { alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: 108, overflow: 'hidden' },
  bandSuccess: { backgroundColor: c.success },
  bandFailed: { backgroundColor: c.destructive },
  bandPending: { backgroundColor: c.warning },
  // Dark theme's status hues are tuned bright for text on black; a veil of
  // the ground deepens them to BHIM's band green / red under white type.
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    opacity: isDark ? 0.42 : 0,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 },
  tickWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  halo: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.primaryForeground,
    opacity: 0.16,
  },
  tick: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primaryForeground,
  },
  // primaryForeground is white in both themes.
  bandTitle: { fontSize: t.body, color: c.primaryForeground, opacity: 0.92, textAlign: 'center' },
  amount: {
    fontSize: 52,
    fontWeight: '300',
    marginTop: space.xs,
    color: c.primaryForeground,
    fontVariant: ['tabular-nums'],
  },
  bandDate: { fontSize: t.caption, marginTop: space.xs, color: c.primaryForeground, opacity: 0.8 },
  bandMessage: {
    fontSize: t.small,
    marginTop: space.md,
    color: c.primaryForeground,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  receipt: {
    marginTop: -72,
    marginHorizontal: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, paddingVertical: 7 },
  kvLabel: { fontSize: t.small, color: c.mutedForeground },
  kvValue: { flexShrink: 1, fontSize: t.small, fontWeight: '500', color: c.foreground, textAlign: 'right' },
  // A zero-height box with all four sides dashed: Android ignores
  // borderStyle on a single side and would draw it solid.
  dash: {
    height: 0,
    borderWidth: 0.75,
    borderRadius: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    marginVertical: space.md,
  },
  statement: { marginTop: space.lg },
  statementTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground, marginBottom: space.xs },
  statementInfo: { flex: 1, minWidth: 0 },
  statementNarration: { fontSize: t.small, color: c.foreground },
  status: { fontSize: t.caption, fontWeight: '500' },
  flex: { flex: 1 },
  foot: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
}));

export default TransactionReceipt;
