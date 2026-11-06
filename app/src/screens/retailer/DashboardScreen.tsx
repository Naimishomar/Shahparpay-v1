import React, { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import {
  Screen,
  EmptyState,
  Grid,
  Skeleton,
  SkeletonCard,
  SkeletonGrid,
  SkeletonRows,
  SkeletonTitle,
  money,
  isoDate,
} from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { IconTile, GradientFill } from '@/components/ui/Gradient';
import { useResponsive } from '@/hooks/useResponsive';
import { isRouteEnabled } from '@/constants/services';
import api from '@/services/api';

// Mirrors frontend/src/pages/Dashboard.tsx: same range options, stats, quick
// actions and recent activity, all from GET /api/dashboard/retailer.

export const RANGE_TYPES = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Custom Range'];

/** The web's applyDateFilter, as a pure function (see DashboardScreen.test.mjs). */
export const rangeFor = (type: string, today = new Date()) => {
  let start = new Date(today);
  let end = new Date(today);
  switch (type) {
    case 'Yesterday':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case 'Last 7 Days':
      start.setDate(today.getDate() - 7);
      break;
    case 'Last 30 Days':
      start.setDate(today.getDate() - 30);
      break;
    case 'This Month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'Last Month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
  }
  return { start: isoDate(start), end: isoDate(end) };
};

/** Bucket i of `n` evenly splitting [start, end] — the web's (and backend's) binning. */
export const bucketLabel = (start: Date, end: Date, i: number, n: number) => {
  // `end` is 23:59:59.999; +1ms makes buckets land on whole hours (20:00, not 19:59).
  const span = end.getTime() + 1 - start.getTime();
  const at = (k: number) => new Date(start.getTime() + (span * k) / n);
  const short = span <= 2 * 86400000;
  const fmt = (d: Date) =>
    short
      ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return { from: fmt(at(i)), to: fmt(at(i + 1)), edge: fmt(at(i)) };
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const QUICK_ACTIONS = [
  { title: 'AEPS Services', hint: 'Cash withdrawal & inquiry', route: 'AEPS', icon: 'fingerprint' },
  { title: 'Lead Generation', hint: 'Credit cards & loans', route: 'LeadGeneration', icon: 'account-group-outline' },
  { title: 'PAN Card', hint: 'Apply NSDL PAN', route: 'PAN', icon: 'card-account-details-outline' },
  { title: 'ITR Filing', hint: 'Income tax return', route: 'ITR', icon: 'file-document-outline' },
];

const SALE_ICON: Record<string, string> = {
  DMT: 'bank-transfer',
  AEPS: 'fingerprint',
  'Trade Wallet Settlement': 'bank-outline',
  'Direct Payout': 'bank-outline',
  'Wallet Topup': 'wallet-outline',
  'Recharge / BBPS': 'cellphone',
};

const STATUS_TONE: Record<string, 'success' | 'destructive'> = { SUCCESS: 'success', FAILED: 'destructive' };

const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { padding, contentWidth } = useResponsive();
  const [walletPage, setWalletPage] = useState(0);

  const [range, setRange] = useState(() => rangeFor('Today'));
  const [dateRangeText, setDateRangeText] = useState('Today');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDateType, setTempDateType] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hover, setHover] = useState<number | null>(null);

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const dashboard = useAsync<any>(
    async () => (await api.getRetailerDashboard({ startDate: range.start, endDate: range.end })).data,
    [range.start, range.end]
  );

  const stats = dashboard.data?.stats;
  const recentSales: any[] = dashboard.data?.recentSales ?? [];
  const loading = dashboard.loading;

  const refresh = () => {
    balances.refresh();
    dashboard.refresh();
  };

  const applyDateFilter = () => {
    if (tempDateType === 'Custom Range') {
      if (!isYmd(customStart) || !isYmd(customEnd)) return;
      setDateRangeText(tempDateType);
      setRange({ start: customStart, end: customEnd });
    } else {
      setDateRangeText(tempDateType);
      setRange(rangeFor(tempDateType));
    }
    setHover(null);
    setPickerOpen(false);
  };

  const initials = (user?.name || 'R')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const firstName = String(user?.name || '').trim().split(/\s+/)[0];

  const volume = Number(stats?.TotalTransactionsAmount) || 0;
  const rangeLabel =
    dateRangeText === 'Custom Range' && customStart && customEnd ? `${customStart} → ${customEnd}` : dateRangeText;

  const points: number[] = stats?.graphData?.length ? stats.graphData : new Array(12).fill(0);
  const chartStart = new Date(stats?.graphRange?.start || `${range.start}T00:00:00+05:30`);
  const chartEnd = new Date(stats?.graphRange?.end || `${range.end}T23:59:59.999+05:30`);
  const peak = Math.max(...points, 0);
  const n = points.length;
  const tip = hover === null ? null : bucketLabel(chartStart, chartEnd, hover, n);

  const service = (title: string, key: string, icon: string) => {
    const value = Number(stats?.[key]) || 0;
    return { title, icon, value: money(value), share: volume > 0 ? Math.round((value / volume) * 100) : 0 };
  };
  const cards: { title: string; icon: string; value: string; share?: number; hint?: string }[] = [
    service('Total Success DMT', 'DMT', 'bank-transfer'),
    service('Total Success Recharge', 'RECHARGE', 'cellphone'),
    service('Total Success AEPS', 'AEPS_WITHDRAWAL', 'fingerprint'),
    service('Total Success Payout', 'AEPS_SETTLEMENT', 'bank-outline'),
    service('Total Success BBPS', 'BILL_PAYMENT', 'receipt'),
    service('Total Success UPI', 'WALLET_TOPUP', 'wallet-outline'),
    { title: 'Total Earnings', icon: 'currency-inr', value: money(Number(stats?.TotalCommission) || 0), hint: 'Credited to wallet, after TDS' },
    { title: 'Total Commission', icon: 'currency-inr', value: money(Number(stats?.TotalGrossCommission) || 0), hint: 'Gross, before TDS' },
  ];

  const go = (route: string, params?: object) => () => navigation.navigate(route, params);

  const b = balances.data;
  const wallets = [
    { key: 'aeps', icon: 'wallet-outline', label: 'Trade Wallet', amount: b?.aepsBalance },
    { key: 'main', icon: 'wallet-outline', label: 'Utility Wallet', amount: b?.mainBalance },
    // QR payments now credit Utility; the card stays only while an old QR balance remains.
    ...(user?.role === 'retailer' && Number(b?.qrBalance) > 0
      ? [{ key: 'qr', icon: 'wallet-outline', label: 'QR Wallet', amount: b?.qrBalance }]
      : []),
  ];
  const quickActions = QUICK_ACTIONS.filter((a) => isRouteEnabled(user, a.route));

  return (
    <Screen
      loading={balances.loading}
      refreshing={balances.refreshing || dashboard.refreshing}
      onRefresh={refresh}
      error={balances.error}
      onRetry={balances.reload}
      skeleton={<HomeSkeleton width={contentWidth} />}
    >
      {/* Top row: avatar opens the profile drawer, search goes to Services. */}
      <View style={styles.topRow}>
        <Pressable
          onPress={go('Profile')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open profile — ${user?.name || 'Retailer'}`}
        >
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={go('Services')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
          accessibilityRole="search"
          accessibilityLabel="Search services"
        >
          <Ionicons name="search-outline" size={22} color={colors.foreground} />
          <Text style={styles.searchText} numberOfLines={1}>
            Search services
          </Text>
        </Pressable>
        <NotificationBell />
      </View>

      <View style={styles.greetRow}>
        <Text style={styles.greet} numberOfLines={1}>
          {greeting()}
          {firstName ? `, ${firstName}` : ''} 👋
        </Text>
      </View>

      {/* Wallets: the web header's balances, one card per wallet. */}
      <View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setWalletPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(contentWidth, 1)))
          }
        >
          {wallets.map((w) => (
            <View key={w.key} style={[styles.walletCard, { width: contentWidth }]}>
              <View style={styles.walletIcon}>
                <MaterialCommunityIcons name={w.icon as any} size={22} color={colors.highlight} />
              </View>
              <View style={styles.walletMain}>
                <Text style={styles.walletLabel} numberOfLines={1}>
                  {w.label}
                </Text>
                <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(w.amount)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
          {wallets.map((w, i) => (
            <View key={w.key} style={[styles.dot, i === walletPage && styles.dotOn]} />
          ))}
        </View>
      </View>

      <View style={[styles.sheet, { marginHorizontal: -padding, paddingHorizontal: padding }]}>
        <View style={styles.sheetEdge} pointerEvents="none">
          <GradientFill stops={[colors.glowWarm, colors.border, colors.glowGreen]} />
        </View>

        {/* Hero: volume, customers, range picker and volume trend. */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={[styles.earnLabel, styles.upper]} numberOfLines={1}>
              Transaction volume · {rangeLabel}
            </Text>
          </View>
          {loading ? (
            <Skeleton width={180} height={28} style={{ marginTop: space.sm }} />
          ) : (
            <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(volume)}
            </Text>
          )}
          {loading ? (
            <Skeleton width={110} height={14} style={{ marginTop: space.sm }} />
          ) : (
            <Text style={styles.earnLabel}>
              <Text style={styles.strong}>{stats?.TotalCustomers || 0}</Text> customers served
            </Text>
          )}
          <Pressable
            onPress={() => {
              setTempDateType(dateRangeText);
              setPickerOpen(true);
            }}
            style={({ pressed }) => [styles.rangeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Date range: ${rangeLabel}`}
          >
            <MaterialCommunityIcons name="calendar-blank-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.linkText}>{rangeLabel}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>

          {loading && !stats ? (
            <Skeleton height={64} style={{ marginTop: space.lg }} />
          ) : (
            <>
              <View style={styles.strip}>
                {points.map((v, i) => (
                  <Pressable
                    key={i}
                    style={styles.stripDay}
                    onPress={() => setHover(hover === i ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${bucketLabel(chartStart, chartEnd, i, n).from}: ${money(v)}`}
                  >
                    <View style={styles.stripTrack}>
                      <View
                        style={[
                          styles.stripFill,
                          { height: `${peak > 0 ? Math.max((v / peak) * 100, v > 0 ? 3 : 0) : 0}%` },
                          hover === i && styles.stripFillToday,
                        ]}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
              <View style={styles.edges}>
                {[0, Math.floor(n / 2), n].map((k) => (
                  <Text key={k} style={styles.stripLetter}>
                    {bucketLabel(chartStart, chartEnd, k, n).edge}
                  </Text>
                ))}
              </View>
              {tip && hover !== null && (
                <Text style={styles.earnLabel}>
                  {tip.from} – {tip.to} · <Text style={styles.strong}>{money(points[hover])}</Text>
                </Text>
              )}
            </>
          )}
        </View>

        <Grid columns={2}>
          {cards.map((card) => (
            <View key={card.title} style={[styles.card, styles.statCard]}>
              <View style={styles.cardHead}>
                <Text style={[styles.earnLabel, styles.flex]} numberOfLines={2}>
                  {card.title}
                </Text>
                <MaterialCommunityIcons name={card.icon as any} size={18} color={colors.highlight} />
              </View>
              {loading ? (
                <Skeleton width={100} height={20} />
              ) : (
                <Text style={styles.earnValue} numberOfLines={1} adjustsFontSizeToFit>
                  {card.value}
                </Text>
              )}
              {card.share !== undefined ? (
                <View style={{ gap: 6 }}>
                  <View style={styles.shareTrack}>
                    <View style={[styles.shareFill, { width: `${loading ? 0 : card.share}%` }]} />
                  </View>
                  <Text style={styles.stripLetter}>{loading ? ' ' : `${card.share}% of total volume`}</Text>
                </View>
              ) : (
                <Text style={styles.stripLetter}>{card.hint}</Text>
              )}
            </View>
          ))}
        </Grid>

        {quickActions.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, styles.cardTitleGap]} accessibilityRole="header">
              Quick actions
            </Text>
            <View style={styles.grid}>
              {quickActions.map((item) => (
                <Pressable
                  key={item.route}
                  onPress={go(item.route)}
                  style={({ pressed }) => [styles.act, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <IconTile icon={item.icon} size={56} iconSize={26} />
                  <Text style={styles.actLabel} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.actHint} numberOfLines={2}>
                    {item.hint}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, styles.cardTitleGap]} accessibilityRole="header">
            Recent activity
          </Text>
          {loading ? (
            <SkeletonRows count={4} />
          ) : dashboard.error ? (
            <EmptyState icon="alert-circle-outline" title={dashboard.error} action={{ label: 'Retry', onPress: dashboard.reload }} />
          ) : recentSales.length ? (
            recentSales.map((sale, index) => (
              <View key={index} style={[styles.sale, index === recentSales.length - 1 && styles.saleLast]}>
                <IconTile icon={SALE_ICON[sale.service] || 'receipt'} size={44} iconSize={20} />
                <View style={styles.saleInfo}>
                  <Text style={styles.saleTitle} numberOfLines={1}>
                    {sale.service || sale.name}
                  </Text>
                  <Text style={styles.saleMeta} numberOfLines={1}>
                    {sale.name} · {sale.details || sale.email}
                  </Text>
                </View>
                <View style={styles.saleRight}>
                  <Text style={styles.saleAmount} numberOfLines={1}>
                    {sale.amount}
                  </Text>
                  <Text style={styles.saleMeta} numberOfLines={1}>
                    {sale.date
                      ? `${new Date(sale.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · `
                      : ''}
                    <Text style={[styles.tag, { color: colors[STATUS_TONE[sale.status] ?? 'warning'] }]}>{sale.status}</Text>
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="inbox-outline" title="No activity in this period" />
          )}
        </View>
      </View>

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Date range"
        footer={
          <View style={styles.footerRow}>
            <Button style={styles.flex} onPress={applyDateFilter}>
              Apply
            </Button>
            <Button style={styles.flex} variant="ghost" onPress={() => setPickerOpen(false)}>
              Cancel
            </Button>
          </View>
        }
      >
        {RANGE_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setTempDateType(type)}
            style={({ pressed }) => [styles.option, tempDateType === type && styles.optionOn, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: tempDateType === type }}
          >
            <Text style={[styles.saleTitle, tempDateType === type && styles.strong]}>{type}</Text>
          </Pressable>
        ))}
        {tempDateType === 'Custom Range' && (
          <View style={{ gap: space.md, marginTop: space.sm }}>
            <Input label="Start date" placeholder="YYYY-MM-DD" value={customStart} onChangeText={setCustomStart} maxLength={10} keyboardType="numbers-and-punctuation" />
            <Input label="End date" placeholder="YYYY-MM-DD" value={customEnd} onChangeText={setCustomEnd} maxLength={10} keyboardType="numbers-and-punctuation" />
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

/** Home's first paint: the same blocks, in the same places, as grey shapes. */
const HomeSkeleton: React.FC<{ width: number }> = ({ width }) => (
  <View style={styles.skel}>
    <View style={styles.topRow}>
      <Skeleton width={48} height={48} radius={24} />
      <Skeleton height={48} radius={radius.pill} style={{ flex: 1 }} />
      <Skeleton width={28} height={28} radius={14} />
    </View>
    <View style={styles.greetRow}>
      <Skeleton width={170} height={22} />
    </View>
    <View style={[styles.walletCard, { width }]}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={styles.walletMain}>
        <Skeleton width={90} height={12} />
        <Skeleton width={150} height={22} />
      </View>
    </View>
    <SkeletonCard title style={styles.skelCard}>
      <Skeleton height={64} />
    </SkeletonCard>
    <SkeletonCard title style={styles.skelCard}>
      <SkeletonGrid count={4} />
    </SkeletonCard>
    <SkeletonTitle />
    <SkeletonCard>
      <SkeletonRows count={4} />
    </SkeletonCard>
  </View>
);

const styles = themed((c) => ({
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  strong: { fontWeight: '600', color: c.foreground },
  upper: { textTransform: 'uppercase', letterSpacing: 0.5 },
  skel: { gap: space.lg },
  skelCard: { paddingVertical: space.lg },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: t.bodyLg, fontWeight: '600', color: c.foreground },
  search: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  searchText: { flex: 1, fontSize: t.body, color: c.mutedForeground },

  greetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  greet: { flex: 1, fontSize: t.title, fontWeight: '400', color: c.foreground },

  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletMain: { flex: 1, minWidth: 0, gap: 2 },
  walletLabel: { fontSize: t.small, color: c.mutedForeground },
  walletValue: { fontSize: t.title + 2, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },
  dotOn: { width: 22, backgroundColor: c.foreground },

  sheet: {
    marginTop: space.sm,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
    backgroundColor: c.background,
    overflow: 'hidden',
  },
  // The sheet's lit top edge: orange fading to green, BHIM's tricolour hint.
  sheetEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, opacity: 0.9 },

  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  statCard: { gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  cardTitleGap: { marginBottom: space.lg },
  linkText: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 36,
    marginTop: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  act: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  actLabel: { fontSize: t.small, fontWeight: '400', color: c.foreground, textAlign: 'center', lineHeight: 17 },
  actHint: { fontSize: t.micro, color: c.mutedForeground, textAlign: 'center', marginTop: -4 },

  earnLabel: { fontSize: t.caption, color: c.mutedForeground },
  earnValue: { fontSize: t.title, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: space.lg },
  stripDay: { flex: 1, alignItems: 'center' },
  // Fixed track so every column shares a baseline and the bars stay comparable.
  stripTrack: {
    width: '100%',
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: c.surface,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stripFill: { width: '100%', borderRadius: radius.sm, backgroundColor: c.borderStrong },
  stripFillToday: { backgroundColor: c.highlight },
  stripLetter: { fontSize: t.micro, color: c.mutedForeground },
  edges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: space.sm },
  shareTrack: { height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: 'hidden' },
  shareFill: { height: '100%', borderRadius: 3, backgroundColor: c.highlight },

  sale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  saleLast: { borderBottomWidth: 0 },
  saleInfo: { flex: 1, minWidth: 0, gap: 3 },
  saleTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  saleMeta: { fontSize: t.caption, color: c.mutedForeground },
  saleRight: { alignItems: 'flex-end', gap: 3 },
  saleAmount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  tag: { fontSize: t.caption, fontWeight: '500' },

  option: { paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md },
  optionOn: { backgroundColor: c.surfaceAlt },
  footerRow: { flexDirection: 'row', gap: space.md },
}));

export default DashboardScreen;
