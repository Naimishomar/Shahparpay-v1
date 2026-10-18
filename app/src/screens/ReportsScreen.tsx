import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import {
  Screen,
  Segmented,
  SectionTitle,
  ErrorBanner,
  money,
  isoDate,
  Skeleton,
} from '@/components/ui/Screen';
import { IconTile } from '@/components/ui/Gradient';
import { TransactionReport } from '@/components/ui/TransactionReport';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { REPORT_ITEMS, ReportEntry, SERVICE_METRICS } from '@/constants';
import api from '@/services/api';
import { pagedTransactions } from './reports';
import { CREDIT_TYPES, typeOf, labelFor, txnTitle, txnSubtitle, txnIcon } from './transactionText';

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
/**
 * Width the centre label gets. The hole is `SIZE - STROKE * 2` across, and a
 * line of text is widest at its middle — which is exactly where the hole is
 * widest too, so the full diameter is usable, less a margin so a long amount
 * never touches the ring. Without an explicit width the block is absolutely
 * positioned and unconstrained, so it laid out at its natural width and a
 * crore-scale total printed straight over the arcs; `adjustsFontSizeToFit`
 * had no bound to shrink against.
 */
const CENTRE_WIDTH = SIZE - STROKE * 2 - 20;

export interface DonutArc {
  label: string;
  /** Distance along the circumference where this segment starts. */
  offset: number;
  /** Its true share of the circumference, gaps included. */
  span: number;
}

/** Touch slack either side of the band — a fingertip is wider than the stroke. */
const HIT_SLACK = 6;

/**
 * Which arc a touch at (x, y) landed on, or null for a miss.
 *
 * The arcs cannot carry their own onPress: every one of them is a full
 * <Circle> revealed through a dash pattern, so each one's hit area is the
 * entire ring and a tap would always report whichever was drawn last.
 * Resolving the angle is what makes it the arc actually under the finger.
 *
 * Matched against `span`, not the drawn `length`, so the daylight between two
 * arcs belongs to one of them rather than to nothing.
 */
export const arcAtPoint = <T extends DonutArc>(arcs: T[], x: number, y: number): T | null => {
  const dx = x - SIZE / 2;
  const dy = y - SIZE / 2;
  const distance = Math.hypot(dx, dy);
  // Only the band is a target. The hole belongs to the total printed in it,
  // and outside the ring is not part of the chart at all.
  if (
    distance < RADIUS - STROKE / 2 - HIT_SLACK ||
    distance > RADIUS + STROKE / 2 + HIT_SLACK
  ) {
    return null;
  }
  // atan2(dx, -dy) reads 0 at twelve o'clock and grows clockwise, matching the
  // rotate(-90) the arcs are drawn under.
  const theta = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
  const along = (theta / (2 * Math.PI)) * CIRCUMFERENCE;
  return arcs.find((arc) => along >= arc.offset && along < arc.offset + arc.span) ?? null;
};

/** Money into the wallet; everything else that moved went out. */
const startsWith = (...prefixes: string[]) => (i: any) => prefixes.some((p) => typeOf(i).startsWith(p));

/** The server-side type filter behind each chip (prefixes, comma-separated). */
const CHIP_TYPES: Record<string, string | undefined> = {
  all: undefined,
  aeps: 'AEPS,AADHAAR_PAY',
  dmt: 'DMT',
  bills: 'BILL_PAYMENT,RECHARGE',
};

const HISTORY_CHIPS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'aeps', label: 'AEPS', match: startsWith('AEPS', 'AADHAAR_PAY') },
  { key: 'dmt', label: 'DMT', match: startsWith('DMT') },
  { key: 'bills', label: 'Bills', match: startsWith('BILL_PAYMENT', 'RECHARGE') },
];

const historySearch = (i: any) =>
  [
    i?.transactionId,
    i?.type,
    i?.status,
    txnTitle(i),
    i?.metadata?.utr,
    i?.metadata?.rrn,
    i?.metadata?.caNumber,
    i?.metadata?.mobile,
    i?.metadata?.name,
  ]
    .filter(Boolean)
    .join(' ');

const historyDetails = [
  { label: 'Reference', value: (i: any) => i?.transactionId ?? '—' },
  { label: 'Type', value: (i: any) => labelFor(typeOf(i)) },
  { label: 'UTR', value: (i: any) => i?.metadata?.utr || i?.metadata?.rrn || '—' },
  {
    label: 'Reason',
    value: (i: any) => i?.metadata?.gatewayMessage || i?.metadata?.apiMessage || i?.metadata?.note || '—',
  },
];

/**
 * The retailer's History tab (mockup 15): every transaction, newest first,
 * narrowed by the type chips and the search, under the period breakdown ring
 * and the per-service reports (ledger first).
 */
const History: React.FC = () => {
  const navigation = useNavigation<any>();
  return (
    <TransactionReport
      pageFetcher={(args) => pagedTransactions(CHIP_TYPES[args.chip])(args)}
      searchFields={historySearch}
      searchPlaceholder="Search name, ID or UTR"
      chips={HISTORY_CHIPS}
      iconOf={txnIcon}
      flowOf={(i) => (!Number(i?.amount) ? undefined : CREDIT_TYPES.has(typeOf(i)) ? 'in' : 'out')}
      titleOf={txnTitle}
      subtitleOf={txnSubtitle}
      details={historyDetails}
      emptyIcon="history"
      emptyTitle="No transactions yet"
      header={
        <>
          <SectionTitle>By service</SectionTitle>
          <ServiceSummary />
          <ReportList onOpen={(route) => navigation.navigate(route)} />
        </>
      }
    />
  );
};

export const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  // Admin and distributor share this route; their totals come from their own
  // portals, so they keep the plain list of reports.
  const isRetailer = user?.role !== 'admin' && user?.role !== 'distributor';
  if (isRetailer) return <History />;
  return (
    <Screen>
      <ReportList onOpen={(route) => navigation.navigate(route)} />
    </Screen>
  );
};

const ReportList: React.FC<{ onOpen: (route: string) => void }> = ({ onOpen }) => (
  <>
    <SectionTitle>All reports</SectionTitle>
    <View style={styles.list}>
      {REPORT_ITEMS.map((item, index) => (
        <ReportRow
          key={item.route}
          item={item}
          last={index === REPORT_ITEMS.length - 1}
          onPress={() => onOpen(item.route)}
        />
      ))}
    </View>
  </>
);

/** Per-service totals for a period, as a tappable ring. Retailers only. */
const ServiceSummary: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  // Which service the ring is broken out for. Null shows the period total.
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useAsync<any>(
    async () => (await api.getRetailerDashboard(rangeFor(period))).data,
    [period]
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
  // keeps the total at exactly one revolution. A lone segment has nothing to
  // be separated from, so it closes into a full ring instead of a circle with
  // an arbitrary notch cut out of it.
  const gap = segments.length > 1 ? GAP : 0;
  let walked = 0;
  const arcs = segments.map((segment) => {
    const span = (segment.value / total) * CIRCUMFERENCE;
    // `span` is the segment's true share and `length` is what gets drawn; a
    // tap is resolved against the span so the daylight between two arcs
    // belongs to one of them rather than to nothing.
    const arc = { ...segment, span, length: Math.max(span - gap, 2), offset: walked };
    walked += span;
    return arc;
  });

  const active = arcs.find((arc) => arc.label === selected) ?? null;

  return (
        <View style={styles.summary}>
          {!!summary.error && <ErrorBanner message={summary.error} />}
          <View style={styles.donutWrap}>
            <Pressable
              onPress={(event) => {
                const { locationX, locationY } = event.nativeEvent;
                const hit = arcAtPoint(arcs, locationX, locationY);
                // Tapping the live arc again returns the ring to the total, so
                // the break-out never becomes a state you cannot get out of.
                setSelected((current) =>
                  !hit ? null : current === hit.label ? null : hit.label
                );
              }}
              style={styles.donutTarget}
              accessibilityRole="adjustable"
              accessibilityLabel={
                active
                  ? `${active.label}, ${money(active.value)}. Tap again for the period total`
                  : `${money(total)} across ${segments.length} services. Tap a segment for its share`
              }
            >
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
                  // The live arc grows into the gutter either side; the rest
                  // dim. Colour alone would not survive a colour-blind reader,
                  // and the centre label names it in words regardless.
                  strokeWidth={active?.label === arc.label ? STROKE + 8 : STROKE}
                  strokeOpacity={active && active.label !== arc.label ? 0.3 : 1}
                  strokeLinecap="butt"
                  fill="none"
                  strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                  strokeDashoffset={-arc.offset}
                  // Start at twelve o'clock rather than three.
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              ))}
            </Svg>
            {/* pointerEvents none so the centre never swallows a tap meant for
                the ring behind it. */}
            <View style={styles.donutCentre} pointerEvents="none">
              <Text style={styles.donutLabel} numberOfLines={1}>
                {active ? active.label : period === 'day' ? 'Today' : `This ${period}`}
              </Text>
              {summary.loading ? (
                // The total's own footprint while it loads — not a "₹ 0.00"
                // that reads as a real zero.
                <Skeleton width={120} height={26} style={{ marginTop: 6 }} />
              ) : (
                <Text
                  style={styles.donutValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  // Floor the shrink: past this the amount is smaller than the
                  // legend under it and stops being the thing the ring is for.
                  minimumFontScale={0.5}
                >
                  {money(active ? active.value : total)}
                </Text>
              )}
              {!!active && (
                <Text style={styles.donutShare} numberOfLines={1}>
                  {((active.value / total) * 100).toFixed(1)}% of {money(total)}
                </Text>
              )}
            </View>
            </Pressable>
          </View>

          <Segmented
            options={PERIODS}
            value={period}
            onChange={(next) => {
              setSelected(null);
              setPeriod(next);
            }}
            scroll={false}
          />

          {!!segments.length && (
            <View style={styles.legend}>
              {segments.map((segment) => (
                <Pressable
                  key={segment.label}
                  onPress={() =>
                    setSelected((current) => (current === segment.label ? null : segment.label))
                  }
                  style={({ pressed }) => [styles.legendItem, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === segment.label }}
                  accessibilityLabel={`${segment.label}, ${money(segment.value)}`}
                >
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <Text
                    style={[styles.legendLabel, selected === segment.label && styles.legendLabelOn]}
                    numberOfLines={1}
                  >
                    {segment.label}
                  </Text>
                  <Text style={styles.legendValue} numberOfLines={1}>
                    {money(segment.value)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
  );
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
    <IconTile icon={item.icon} size={44} iconSize={20} />
    <View style={styles.rowText}>
      <Text style={styles.rowName}>{item.name}</Text>
      <Text style={styles.rowHint} numberOfLines={1}>
        {item.hint}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
  </Pressable>
);

const styles = themed((c) => ({
  // The ring, its period tabs and the legend share one BHIM card.
  summary: {
    gap: space.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  donutTarget: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  donutCentre: {
    position: 'absolute',
    width: CENTRE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  donutLabel: { fontSize: t.small, color: c.mutedForeground, textAlign: 'center' },
  donutShare: { fontSize: t.caption, color: c.mutedForeground, textAlign: 'center' },
  // Big and light, as BHIM sets an amount.
  donutValue: {
    fontSize: 23,
    fontWeight: '300',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  legend: { gap: space.md, paddingTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 28 },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendLabel: { flex: 1, minWidth: 0, fontSize: t.small, color: c.mutedForeground },
  legendLabelOn: { color: c.foreground, fontWeight: '500' },
  legendValue: {
    fontSize: t.small,
    fontWeight: '500',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.7 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  rowHint: { fontSize: t.caption, color: c.mutedForeground },
}));

export default ReportsScreen;
