import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import {
  Screen,
  Segmented,
  SectionTitle,
  StatusPill,
  money,
  dateTime,
  isoDate,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { REPORT_ITEMS, ReportEntry, SERVICE_METRICS } from '@/constants';
import api from '@/services/api';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

/** Start of the selected window, in the API's local YYYY-MM-DD. */
const rangeFor = (period: Period) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(1);
  if (period === 'year') start.setMonth(0, 1);
  return { startDate: isoDate(start), endDate: isoDate(now) };
};

const SIZE = 230;
const STROKE = 24;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Arc gap in px along the circumference — the reference leaves daylight. */
const GAP = 14;

export const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');

  // Only retailers have per-service totals; the same tab serves admin and
  // distributor, whose stats come from other endpoints entirely.
  const isRetailer = user?.role !== 'admin' && user?.role !== 'distributor';

  const summary = useAsync<any>(
    async () => (isRetailer ? (await api.getRetailerDashboard(rangeFor(period))).data : null),
    [period, isRetailer]
  );
  const recent = useAsync<any>(
    async () =>
      isRetailer
        ? (await api.getRecentTransactions({ limit: 8, ...rangeFor(period) })).data
        : null,
    [period, isRetailer]
  );

  const stats = summary.data?.stats;
  const segments = SERVICE_METRICS.map((metric, index) => ({
    label: metric.label,
    icon: metric.icon,
    value: Number(stats?.[metric.key] ?? 0),
    color: colors.chart[index % colors.chart.length],
  })).filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  // Each arc starts where the previous one ended, so one running offset walks
  // the ring; the gap is taken off the arc, not added between them, which
  // keeps the total at exactly one revolution.
  let walked = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.value / total) * CIRCUMFERENCE;
    const arc = { ...segment, length: Math.max(length - GAP, 2), offset: walked };
    walked += length;
    return arc;
  });

  const transactions: any[] = Array.isArray(recent.data)
    ? recent.data
    : (recent.data?.transactions ?? []);

  return (
    <Screen
      refreshing={summary.refreshing || recent.refreshing}
      onRefresh={() => {
        summary.refresh();
        recent.refresh();
      }}
      error={summary.error}
      onRetry={summary.reload}
    >
      {isRetailer && (
        <>
          <View style={styles.donutWrap}>
            <Svg width={SIZE} height={SIZE}>
              {/* Track: without it an empty period renders as nothing at all. */}
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={colors.secondary}
                strokeWidth={STROKE}
                fill="none"
              />
              {arcs.map((arc) => (
                <Circle
                  key={arc.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={arc.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                  strokeDashoffset={-arc.offset}
                  // Start at twelve o'clock rather than three.
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              ))}
            </Svg>
            <View style={styles.donutCentre} pointerEvents="none">
              <Text style={styles.donutLabel}>
                {period === 'day' ? 'Today' : `This ${period}`}
              </Text>
              <Text style={styles.donutValue} numberOfLines={1} adjustsFontSizeToFit>
                {money(total)}
              </Text>
            </View>
          </View>

          <Segmented options={PERIODS} value={period} onChange={setPeriod} scroll={false} />

          {!!segments.length && (
            <View style={styles.legend}>
              {segments.map((segment) => (
                <View key={segment.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {segment.label}
                  </Text>
                  <Text style={styles.legendValue} numberOfLines={1}>
                    {money(segment.value)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <SectionTitle>Transactions</SectionTitle>
          <View style={styles.card}>
            {transactions.length ? (
              transactions.slice(0, 8).map((tx: any, index: number) => (
                <View key={tx.id ?? tx._id ?? index} style={styles.tx}>
                  <View
                    style={[
                      styles.txAvatar,
                      { backgroundColor: colors.chart[index % colors.chart.length] },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={(ICON_FOR[String(tx.type || '').toUpperCase()] ??
                        'swap-horizontal') as any}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.description || tx.service || tx.type || 'Transaction'}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {dateTime(tx.createdAt || tx.date)}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txAmount} numberOfLines={1}>
                      {money(tx.amount)}
                    </Text>
                    <StatusPill status={tx.status} />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No transactions in this period.</Text>
            )}
          </View>
        </>
      )}

      <SectionTitle>All reports</SectionTitle>
      <View style={styles.list}>
        {REPORT_ITEMS.map((item, index) => (
          <ReportRow
            key={item.route}
            item={item}
            last={index === REPORT_ITEMS.length - 1}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </View>
    </Screen>
  );
};

/** Transaction type -> glyph. Anything unknown falls back to a generic swap. */
const ICON_FOR: Record<string, string> = {
  AEPS: 'fingerprint',
  AEPS_WITHDRAWAL: 'fingerprint',
  AEPS_SETTLEMENT: 'cash-fast',
  DMT: 'bank-transfer',
  RECHARGE: 'cellphone',
  BILL_PAYMENT: 'receipt',
  WALLET_TOPUP: 'qrcode',
  PAYOUT: 'cash-fast',
};

const ReportRow: React.FC<{ item: ReportEntry; last: boolean; onPress: () => void }> = ({
  item,
  last,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
    accessibilityRole="button"
    accessibilityLabel={`${item.name}. ${item.hint}`}
  >
    <View style={styles.rowIcon}>
      <MaterialCommunityIcons name={item.icon as any} size={19} color={colors.foreground} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowName}>{item.name}</Text>
      <Text style={styles.rowHint} numberOfLines={1}>
        {item.hint}
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
  </Pressable>
);

const styles = themed((c) => ({
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
  },
  donutCentre: { position: 'absolute', alignItems: 'center', gap: 4, paddingHorizontal: space.xl },
  donutLabel: { fontSize: t.small, color: c.mutedForeground },
  donutValue: {
    fontSize: 30,
    fontWeight: '800',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  legend: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legendDot: { width: 10, height: 10, borderRadius: radius.pill },
  legendLabel: { flex: 1, minWidth: 0, fontSize: t.small, color: c.mutedForeground },
  legendValue: {
    fontSize: t.small,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg },
  empty: { fontSize: t.small, color: c.mutedForeground, paddingVertical: space.sm },
  tx: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  txAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1, minWidth: 0, gap: 2 },
  txTitle: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  txMeta: { fontSize: t.micro, color: c.mutedForeground },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  list: {
    borderRadius: radius.lg,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: c.secondary },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  rowHint: { fontSize: t.caption, color: c.mutedForeground },
}));

export default ReportsScreen;
