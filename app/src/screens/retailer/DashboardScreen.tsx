import React, { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import {
  Screen,
  EmptyState,
  SectionTitle,
  Skeleton,
  SkeletonCard,
  SkeletonGrid,
  SkeletonRows,
  SkeletonTitle,
  money,
  isoDate,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { IconTile, GradientFill } from '@/components/ui/Gradient';
import { useResponsive } from '@/hooks/useResponsive';
import { isRouteEnabled } from '@/constants/services';
import api from '@/services/api';
import { CREDIT_TYPES, typeOf, txnIcon, txnTitle, txnSubtitle } from '../transactionText';

/** Days of history the activity query and the earnings lookup read. */
const WINDOW_DAYS = 7;

/** Rows Home lists. The rest are one tap away in the ledger. */
const LIST_LIMIT = 5;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The trailing WINDOW_DAYS, today last. */
const windowRange = () => {
  const now = new Date();
  const start = startOfDay(now);
  start.setDate(start.getDate() - (WINDOW_DAYS - 1));
  return { startDate: isoDate(start), endDate: isoDate(now) };
};

const timeOf = (value?: string) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Buckets rows into the given local day keys, and folds in the per-day earnings
 * the server aggregated. Pure so the arithmetic can be checked without a
 * renderer (see DashboardScreen.test.mjs).
 *
 * Earnings are NOT summed from the rows. This list is capped at a row limit and
 * sorted newest first, so on a busy day the earlier days of the window fall off
 * the end and would read as zero — a wrong number, not a missing one. The
 * commission-by-day endpoint aggregates every row server-side, net of TDS, so
 * that is the only figure trusted for money here. The rows still drive the list
 * and its per-day count of what is on screen.
 */
export const bucketByDay = (
  transactions: any[],
  keys: string[],
  commissionByDay: Record<string, { commission?: number; count?: number }> = {}
) => {
  const byDay = new Map<string, { commission: number; count: number; rows: any[] }>();
  for (const key of keys) {
    byDay.set(key, {
      commission: Number(commissionByDay?.[key]?.commission || 0),
      count: Number(commissionByDay?.[key]?.count || 0),
      rows: [],
    });
  }

  for (const tx of transactions) {
    const day = byDay.get(isoDate(new Date(tx.createdAt || tx.date)));
    if (!day) continue;
    day.rows.push(tx);
  }
  return byDay;
};

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { padding, contentWidth } = useResponsive();
  // Balance hidden on request, for a counter where customers stand close.
  const [hidden, setHidden] = useState(false);
  const [walletPage, setWalletPage] = useState(0);

  // The balance is the number a retailer opens the app to read, so it is its
  // own call and never waits on the activity query.
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const activity = useAsync<any>(
    async () => (await api.getRecentTransactions({ limit: 60, ...windowRange() })).data,
    []
  );
  // Earnings come from their own aggregation rather than from the rows above,
  // which are capped and would understate a busy day.
  const earnings = useAsync<Record<string, { commission: number; count: number }>>(
    async () => (await api.getCommissionByDay(WINDOW_DAYS)).data ?? {},
    []
  );

  const transactions: any[] = Array.isArray(activity.data)
    ? activity.data
    : (activity.data?.transactions ?? []);

  const refresh = () => {
    balances.refresh();
    activity.refresh();
    earnings.refresh();
  };

  const initials = (user?.name || 'R')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const firstName = String(user?.name || 'there').split(' ')[0];

  const recent = transactions.slice(0, LIST_LIMIT);

  // Commission, day by day, oldest first: the number a retailer checks before
  // closing the shop. Server-aggregated, net of TDS (see bucketByDay).
  const week = Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - (WINDOW_DAYS - 1 - index));
    const key = isoDate(date);
    return {
      key,
      letter: date.toLocaleDateString('en-IN', { weekday: 'narrow' }),
      label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      commission: Number(earnings.data?.[key]?.commission || 0),
    };
  });
  const weekTotal = week.reduce((sum, day) => sum + day.commission, 0);
  const todayCommission = week[week.length - 1]?.commission ?? 0;
  const peak = Math.max(...week.map((day) => day.commission), 1);

  const shown = (value: any) => (hidden ? '₹ ••••••' : money(value));
  const go = (route: string, params?: object) => () => navigation.navigate(route, params);

  const wallets = [
    { key: 'main', icon: 'wallet-outline', label: 'Main wallet', amount: balances.data?.mainBalance, action: 'Add money', onPress: go('AddMoney') },
    { key: 'aeps', icon: 'fingerprint', label: 'AEPS wallet', amount: balances.data?.aepsBalance, action: 'Withdraw', onPress: go('AepsSettlement') },
  ];

  return (
    <Screen
      loading={balances.loading}
      refreshing={balances.refreshing}
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
          Hello, {firstName}
        </Text>
        <Pressable
          onPress={() => setHidden((v) => !v)}
          style={styles.idPill}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'}
        >
          <Ionicons
            name={hidden ? 'eye-off-outline' : 'eye-outline'}
            size={17}
            color={colors.mutedForeground}
          />
          {!!user?.retailerId && <Text style={styles.idText}>{user.retailerId}</Text>}
        </Pressable>
      </View>

      {/* Wallets: one card per wallet, swiped like BHIM's bank cards. */}
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
                  {shown(w.amount)}
                </Text>
              </View>
              <View style={styles.walletDivider} />
              <Pressable
                onPress={w.onPress}
                style={({ pressed }) => [styles.walletAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={w.action}
              >
                <Text style={styles.walletActionText} numberOfLines={2}>
                  {w.action}
                </Text>
                <View style={styles.walletArrow}>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.highlightForeground} />
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
          {wallets.map((w, i) => (
            <View key={w.key} style={[styles.dot, i === walletPage && styles.dotOn]} />
          ))}
        </View>
      </View>

      {/* The lower sheet, as in BHIM: a rounded black panel holding the grids. */}
      <View style={[styles.sheet, { marginHorizontal: -padding, paddingHorizontal: padding }]}>
        <View style={styles.sheetEdge} pointerEvents="none">
          <GradientFill stops={[colors.glowWarm, colors.border, colors.glowGreen]} />
        </View>

        <ServiceCard
          title="Banking & payments"
          items={[
            { icon: 'fingerprint', label: 'AEPS', route: 'AEPS' },
            { icon: 'credit-card-outline', label: 'Micro ATM', route: 'MATM' },
            { icon: 'bank-transfer', label: 'Money transfer', route: 'DMT' },
            { icon: 'cellphone', label: 'Mobile recharge', route: 'Recharge' },
            { icon: 'receipt', label: 'Bills & payments', route: 'BBPS' },
            { icon: 'qrcode', label: 'Collect by UPI', route: 'Collect' },
            { icon: 'wallet-plus-outline', label: 'Add money', route: 'AddMoney' },
            { icon: 'hand-coin-outline', label: 'Fund request', route: 'FundRequest' },
          ]}
        />

        <ServiceCard
          title="Government services"
          items={[
            { icon: 'card-account-details-outline', label: 'PAN card', route: 'PAN' },
            { icon: 'file-document-outline', label: 'ITR filing', route: 'ITR' },
            { icon: 'account-plus-outline', label: 'Leads', route: 'LeadGeneration' },
            { icon: 'shield-check-outline', label: 'KYC status', route: 'KycStatus' },
          ]}
        />

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Commission</Text>
            <Pressable onPress={go('Reports')} hitSlop={12} accessibilityRole="button" style={styles.link}>
              <Text style={styles.linkText}>Details</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.earnRow}>
            <View style={styles.earnCol}>
              <Text style={styles.earnLabel}>Today</Text>
              <Text style={[styles.earnValue, styles.credit]} numberOfLines={1}>
                {money(todayCommission)}
              </Text>
            </View>
            <View style={styles.earnCol}>
              <Text style={styles.earnLabel}>Last 7 days</Text>
              <Text style={styles.earnValue} numberOfLines={1}>
                {money(weekTotal)}
              </Text>
            </View>
          </View>
          <View style={styles.strip}>
            {week.map((day, index) => {
              const isToday = index === week.length - 1;
              return (
                <View
                  key={day.key}
                  style={styles.stripDay}
                  accessibilityRole="text"
                  accessibilityLabel={`${day.label}: ${money(day.commission)}`}
                >
                  <Text style={styles.stripAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {day.commission > 0 ? Math.round(day.commission) : ''}
                  </Text>
                  <View style={styles.stripTrack}>
                    <View
                      style={[
                        styles.stripFill,
                        // Floor of 3% so a day with a token earning still shows.
                        { height: `${Math.max((day.commission / peak) * 100, day.commission > 0 ? 3 : 0)}%` },
                        isToday && styles.stripFillToday,
                      ]}
                    />
                  </View>
                  <Text style={[styles.stripLetter, isToday && styles.stripLetterToday]}>{day.letter}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <SectionTitle
          action={
            <Pressable onPress={go('Reports')} hitSlop={12} accessibilityRole="button" style={styles.link}>
              <Text style={styles.linkText}>View all</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.foreground} />
            </Pressable>
          }
        >
          Recent transactions
        </SectionTitle>
        <View style={styles.card}>
          {activity.loading ? (
            <SkeletonRows count={LIST_LIMIT} />
          ) : recent.length ? (
            recent.map((tx: any, index: number) => (
              <TransactionRow key={tx._id ?? tx.transactionId ?? index} tx={tx} last={index === recent.length - 1} />
            ))
          ) : (
            <EmptyState
              icon="text-box-outline"
              title="No transactions yet"
              subtitle={`Nothing in the last ${WINDOW_DAYS} days`}
              action={{ label: 'Browse services', onPress: go('Services') }}
            />
          )}
        </View>

        <View style={styles.footer} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.footerText}>Trusted by retailers across India</Text>
        </View>
      </View>
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
      <View style={{ flex: 1 }} />
      <Skeleton width={96} height={14} />
    </View>
    <View style={[styles.walletCard, { width }]}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={styles.walletMain}>
        <Skeleton width={90} height={12} />
        <Skeleton width={150} height={22} />
      </View>
      <Skeleton width={96} height={28} radius={14} />
    </View>
    <SkeletonCard title style={styles.skelCard}>
      <SkeletonGrid count={8} />
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

/** A titled card of round line-icon buttons, four to a row (BHIM's grid). */
const ServiceCard: React.FC<{ title: string; items: { icon: string; label: string; route: string }[] }> = ({
  title,
  items,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const shown = items.filter((item) => isRouteEnabled(user, item.route));
  if (!shown.length) return null;
  return (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, styles.cardTitleGap]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.grid}>
        {shown.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => navigation.navigate(item.route)}
            style={({ pressed }) => [styles.act, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <IconTile icon={item.icon} size={56} iconSize={26} />
            <Text style={styles.actLabel} numberOfLines={2}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

/** Success / Pending / Failed, as a small coloured caption. */
const TAG: Record<string, { label: string; tone: 'success' | 'warning' | 'destructive' }> = {
  SUCCESS: { label: 'Success', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
  REFUNDED: { label: 'Refunded', tone: 'destructive' },
};

const TransactionRow: React.FC<{ tx: any; last: boolean }> = ({ tx, last }) => {
  const credit = CREDIT_TYPES.has(typeOf(tx));
  const failed = tx.status === 'FAILED';
  const tag = TAG[tx.status] ?? { label: 'Pending', tone: 'warning' as const };
  return (
    <View style={[styles.sale, last && styles.saleLast]}>
      <IconTile icon={txnIcon(tx)} size={44} iconSize={20} />
      <View style={styles.saleInfo}>
        <Text style={styles.saleTitle} numberOfLines={1}>
          {txnTitle(tx)}
        </Text>
        <Text style={styles.saleMeta} numberOfLines={1}>
          {[txnSubtitle(tx), timeOf(tx.createdAt || tx.date)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.saleRight}>
        <Text
          style={[styles.saleAmount, credit && !failed && styles.credit, failed && styles.failed]}
          numberOfLines={1}
        >
          {failed ? '' : credit ? '+ ' : '− '}
          {money(tx.amount)}
        </Text>
        <Text style={[styles.tag, { color: colors[tag.tone] }]}>{tag.label}</Text>
      </View>
    </View>
  );
};

const styles = themed((c) => ({
  pressed: { opacity: 0.7 },
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
  idPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  idText: { fontSize: t.small, color: c.mutedForeground, fontVariant: ['tabular-nums'] },

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
  walletDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: c.borderStrong },
  walletAction: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, maxWidth: 110 },
  walletActionText: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  walletArrow: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: c.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },
  dotOn: { width: 22, backgroundColor: c.foreground },

  sheet: {
    marginTop: space.sm,
    paddingTop: space.xl,
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
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  cardTitleGap: { marginBottom: space.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  linkText: { fontSize: t.small, fontWeight: '500', color: c.foreground },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  act: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  actLabel: { fontSize: t.small, fontWeight: '400', color: c.foreground, textAlign: 'center', lineHeight: 17 },

  earnRow: { flexDirection: 'row', marginTop: space.md, gap: space.lg },
  earnCol: { flex: 1, gap: 2 },
  earnLabel: { fontSize: t.caption, color: c.mutedForeground },
  earnValue: { fontSize: t.title, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  credit: { color: c.success },
  failed: { color: c.destructive },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  stripDay: { flex: 1, alignItems: 'center', gap: 6 },
  stripAmount: { fontSize: 10, color: c.mutedForeground, fontVariant: ['tabular-nums'], height: 13 },
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
  stripLetterToday: { color: c.foreground, fontWeight: '600' },

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

  footer: { alignItems: 'center', paddingVertical: space.xl },
  footerText: { fontSize: t.title, fontWeight: '300', color: c.borderStrong },
}));

export default DashboardScreen;
