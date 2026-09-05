import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import {
  Screen,
  EmptyState,
  Grid,
  SectionTitle,
  StatusPill,
  money,
  isoDate,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { QUICK_ACTIONS, SERVICE_METRICS } from '@/constants';
import { DashboardStats } from '@/types';
import api from '@/services/api';

interface DashboardData {
  stats: DashboardStats;
  recentSales: any[];
}

/** Only the metrics a retailer acts on. The rest live in Reports. */
const METRICS = SERVICE_METRICS as { key: keyof DashboardStats; label: string; icon: string }[];

/** Days of history the commission strip and the grouped list both read from. */
const WINDOW_DAYS = 7;

/** Rows Home lists. The rest are one tap away in the ledger. */
const LIST_LIMIT = 10;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** First of the current month to today, as the API's YYYY-MM-DD range. */
const monthRange = () => {
  const now = new Date();
  return {
    startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: isoDate(now),
  };
};

/** The trailing WINDOW_DAYS, today last. */
const windowRange = () => {
  const now = new Date();
  const start = startOfDay(now);
  start.setDate(start.getDate() - (WINDOW_DAYS - 1));
  return { startDate: isoDate(start), endDate: isoDate(now) };
};

/** Credits add to a wallet; everything else spends from it. */
const CREDIT_TYPES = new Set([
  'WALLET_TOPUP',
  'FUND_REQUEST',
  'FUND_TRANSFER',
  'AEPSTOMAIN',
  'AEPS_DEPOSIT',
  'DIRECT_PAYOUT_REFUND',
  'AEPS_DEPOSIT_REFUND',
]);

/** Transaction type -> glyph. Anything unknown falls back to a generic swap. */
const ICON_FOR: Record<string, string> = {
  AEPS_WITHDRAWAL: 'fingerprint',
  AADHAAR_PAY: 'fingerprint',
  AEPS_SETTLEMENT: 'cash-fast',
  AEPS_DEPOSIT: 'cash-plus',
  AEPSTOMAIN: 'wallet-plus-outline',
  DMT: 'bank-transfer',
  RECHARGE: 'cellphone',
  BILL_PAYMENT: 'receipt',
  WALLET_TOPUP: 'qrcode',
  UPI_CASHOUT: 'qrcode',
  DIRECT_PAYOUT: 'cash-fast',
  DIRECT_PAYOUT_REFUND: 'cash-refund',
  FUND_REQUEST: 'hand-coin-outline',
  FUND_TRANSFER: 'swap-horizontal',
  PAN_CARD: 'card-account-details-outline',
  STD_PAN_CARD: 'card-account-details-outline',
  PAN_SERVICE: 'card-account-details-outline',
  PAN_COUPON: 'ticket-percent-outline',
  ITR: 'file-document-outline',
  GST_REGISTRATION: 'file-document-outline',
  DAILY_AUTH_CHARGE: 'shield-check-outline',
  MERCHANT_ONBOARDING_CHARGE: 'store-outline',
};

/** SCREAMING_SNAKE -> Title case, so an unmapped new type still reads. */
const labelFor = (type?: string) =>
  String(type || 'Transaction')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Who the transaction was for, when the metadata carries it. */
const partyFor = (tx: any) =>
  tx?.metadata?.name ||
  tx?.metadata?.customerName ||
  tx?.metadata?.beneficiaryName ||
  tx?.metadata?.operator ||
  (tx?.metadata?.aadhaar ? `Aadhaar *${String(tx.metadata.aadhaar).slice(-4)}` : '') ||
  (tx?.metadata?.beneficiaryAccount ? `A/C *${String(tx.metadata.beneficiaryAccount).slice(-4)}` : '') ||
  (tx?.metadata?.caNumber ? `No. ${tx.metadata.caNumber}` : '') ||
  tx?.transactionId ||
  '';

const timeOf = (value?: string) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

/** TODAY / YESTERDAY / 04 Sep — the reference's day separator. */
const dayHeading = (key: string) => {
  const today = isoDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return 'TODAY';
  if (key === isoDate(yesterday)) return 'YESTERDAY';
  return new Date(key)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    .toUpperCase();
};

/**
 * Buckets rows into the given local day keys, summing what the retailer
 * actually earned. Pure so the money arithmetic can be checked without a
 * renderer (see DashboardScreen.test.mjs).
 *
 * Only SUCCESS counts, and a refund is skipped: it reverses a sale whose
 * commission was already credited, so counting it would pay the day twice.
 */
export const bucketByDay = (transactions: any[], keys: string[]) => {
  const byDay = new Map<string, { commission: number; count: number; rows: any[] }>();
  for (const key of keys) byDay.set(key, { commission: 0, count: 0, rows: [] });

  for (const tx of transactions) {
    const day = byDay.get(isoDate(new Date(tx.createdAt || tx.date)));
    if (!day) continue;
    day.rows.push(tx);
    const isRefund = /^REF(UND)?-/.test(String(tx.transactionId || ''));
    if (tx.status === 'SUCCESS' && !isRefund) {
      day.commission += Number(tx.commissions?.retailerEarned || 0);
      day.count += 1;
    }
  }
  return byDay;
};

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  // The endpoint defaults to *today* when no range is sent, and this block is
  // labelled "this month" — so it asks for the month it claims to show.
  const dashboard = useAsync<DashboardData>(
    async () => (await api.getRetailerDashboard(monthRange())).data,
    []
  );
  // Separate from the dashboard call: the balance is the number a retailer
  // opens the app to read, so it must not wait on the slower stats query.
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  // Raw rows, not `recentSales`: that list is capped at five and carries no
  // commission or type, which is exactly what the day strip and the grouped
  // list need.
  const activity = useAsync<any>(
    async () => (await api.getRecentTransactions({ limit: 60, ...windowRange() })).data,
    []
  );

  const stats = dashboard.data?.stats;
  const transactions: any[] = Array.isArray(activity.data)
    ? activity.data
    : (activity.data?.transactions ?? []);

  const refresh = () => {
    dashboard.refresh();
    balances.refresh();
    activity.refresh();
  };

  const initials = (user?.name || 'R')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  // Month-to-date split, in the same order as the metric grid below, so the
  // bar and the tiles always tell the same story.
  const segments = METRICS.map((metric, index) => ({
    label: metric.label,
    value: Number(stats?.[metric.key] ?? 0),
    color: colors.chart[index % colors.chart.length],
  })).filter((segment) => segment.value > 0);
  const spent = segments.reduce((sum, segment) => sum + segment.value, 0);

  // One pass over the window feeds both the commission strip and the grouped
  // list: same rows, same day boundaries, so the two can never disagree.
  const today = startOfDay(new Date());
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (WINDOW_DAYS - 1 - index));
    return { key: isoDate(date), date };
  });
  const byDay = bucketByDay(transactions, days.map((day) => day.key));

  const strip = days.map(({ key, date }) => ({
    key,
    letter: date.toLocaleDateString('en-IN', { weekday: 'narrow' }),
    ...(byDay.get(key) as { commission: number; count: number; rows: any[] }),
  }));
  const peak = Math.max(...strip.map((day) => day.commission), 1);
  const todayCommission = strip[strip.length - 1]?.commission ?? 0;

  // Today's spend, split by service. Read off the rows already in hand rather
  // than a second stats call, and credits are left out: money coming into a
  // wallet is not spending.
  const todayRows = strip[strip.length - 1]?.rows ?? [];
  const todaySpend = METRICS.map((metric, index) => ({
    label: metric.label,
    value: todayRows
      .filter(
        (tx: any) =>
          tx.status === 'SUCCESS' &&
          String(tx.type || '').toUpperCase() === metric.key &&
          !CREDIT_TYPES.has(String(tx.type || '').toUpperCase())
      )
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0),
    color: colors.chart[index % colors.chart.length],
  })).filter((segment) => segment.value > 0);
  const spentToday = todaySpend.reduce((sum, segment) => sum + segment.value, 0);
  const todayCount = todayRows.filter((tx: any) => tx.status === 'SUCCESS').length;
  const windowCommission = strip.reduce((sum, day) => sum + day.commission, 0);

  // Newest day first for the list; a day with nothing in it is skipped. The
  // budget is spent across days, so Home shows the last LIST_LIMIT rows
  // however they fall — the day headings keep reporting the full day's totals.
  let budget = LIST_LIMIT;
  const grouped = [...strip]
    .reverse()
    .map((day) => {
      const shown = day.rows.slice(0, budget);
      budget -= shown.length;
      return { ...day, shown };
    })
    .filter((day) => day.shown.length);

  return (
    <Screen
      loading={dashboard.loading}
      refreshing={dashboard.refreshing}
      onRefresh={refresh}
      error={dashboard.error}
      onRetry={dashboard.reload}
    >
      {/* Identity row. No search field: nothing in the app is searchable yet,
          and a dead input at the top of Home is worse than none. */}
      <View style={styles.topRow}>
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Account — ${user?.name || 'Retailer'}`}
        >
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
          ) : (
            // Initials only until a photo is uploaded — an empty grey disc says
            // less about who is signed in than two letters do.
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>
        <View style={styles.identity}>
          <Text style={styles.identityName} numberOfLines={1}>
            {user?.name || 'Retailer'}
          </Text>
          {!!user?.retailerId && (
            <Text style={styles.identityCode} numberOfLines={1}>
              {user.retailerId}
            </Text>
          )}
        </View>
        <IconButton
          icon="bell-outline"
          label="Reports"
          onPress={() => navigation.navigate('Reports')}
        />
        <IconButton
          icon="cog-outline"
          label="Account"
          onPress={() => navigation.navigate('Profile')}
        />
      </View>

      {/* Wallet. The one card that never takes the page ground: it is the
          object the whole screen is about. */}
      <View style={styles.wallet}>
        {/* viewBox + preserveAspectRatio="none": a percentage-sized <Rect>
            resolves against the SVG's own default viewport, which left the
            gradient short of the card's right edge. In user units the fill
            stretches to whatever the card measures. */}
        <Svg
          style={StyleSheet.absoluteFill as any}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="walletSheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3A3A40" />
              <Stop offset="0.5" stopColor="#1C1C20" />
              <Stop offset="1" stopColor="#0E0E10" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#walletSheen)" />
        </Svg>

        <View style={styles.walletTop}>
          <Text style={styles.walletLabel}>Wallet</Text>
          <Pressable
            onPress={() => navigation.navigate('FundRequest')}
            style={({ pressed }) => [styles.walletAdd, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add money"
          >
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
          {money(balances.data?.mainBalance)}
        </Text>

        <View style={styles.walletFoot}>
          <Text style={styles.walletMeta} numberOfLines={1}>
            {user?.retailerId ? `Account ** ${String(user.retailerId).slice(-4)}` : 'Main wallet'}
          </Text>
          <Text style={styles.walletMeta} numberOfLines={1}>
            AEPS {money(balances.data?.aepsBalance)}
          </Text>
        </View>
      </View>

      {/* Two-up: where the month went, and what it earned. */}
      <View style={styles.duo}>
        <Pressable
          onPress={() => navigation.navigate('Reports')}
          style={({ pressed }) => [styles.tile, styles.tileHalf, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Spent today, ${money(spentToday)} across ${todayCount} transactions`}
        >
          <Text style={styles.tileTitle}>Spent today</Text>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(spentToday)}
          </Text>
          <Text style={styles.tileHint} numberOfLines={1}>
            {todayCount ? `${todayCount} transactions` : 'No transactions yet'}
          </Text>
          <View style={styles.bar}>
            {todaySpend.length ? (
              todaySpend.map((segment) => (
                <View
                  key={segment.label}
                  style={[
                    styles.barPart,
                    { flexGrow: segment.value / spentToday, backgroundColor: segment.color },
                  ]}
                />
              ))
            ) : (
              <View style={[styles.barPart, styles.barEmpty]} />
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Reports')}
          style={({ pressed }) => [styles.tile, styles.tileHalf, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Earnings this month. ${money(stats?.TotalCommission)}`}
        >
          <Text style={styles.tileTitle}>Earnings</Text>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(stats?.TotalCommission)}
          </Text>
          <View style={styles.dots}>
            {METRICS.slice(0, 4).map((metric, index) => (
              <View
                key={metric.key}
                style={[
                  styles.dot,
                  { backgroundColor: colors.chart[index % colors.chart.length], marginLeft: index ? -8 : 0 },
                ]}
              >
                <MaterialCommunityIcons name={metric.icon as any} size={13} color="#FFFFFF" />
              </View>
            ))}
          </View>
        </Pressable>
      </View>

      {/* Commission, day by day. The number a retailer checks before closing
          the shop, so it gets the headline and the week gets the bars. */}
      <View style={styles.card}>
        <View style={styles.commissionTop}>
          <View style={styles.commissionMain}>
            <Text style={styles.tileHint}>Commission today</Text>
            <Text style={styles.commissionValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(todayCommission)}
            </Text>
          </View>
          <View style={styles.commissionAside}>
            <Text style={styles.tileHint}>Last {WINDOW_DAYS} days</Text>
            <Text style={styles.commissionAsideValue} numberOfLines={1}>
              {money(windowCommission)}
            </Text>
          </View>
        </View>

        <View style={styles.strip}>
          {strip.map((day, index) => {
            const isToday = index === strip.length - 1;
            return (
              <View
                key={day.key}
                style={styles.stripDay}
                accessibilityRole="text"
                accessibilityLabel={`${dayHeading(day.key)}: ${money(day.commission)} from ${day.count} transactions`}
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
                <Text style={[styles.stripLetter, isToday && styles.stripLetterToday]}>
                  {day.letter}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.card}>
        <Grid columns={4}>
          {QUICK_ACTIONS.map((action, index) => (
            <Pressable
              key={action.route}
              onPress={() => navigation.navigate(action.route)}
              style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.name}
            >
              <View
                style={[
                  styles.quickIcon,
                  { backgroundColor: colors.chart[index % colors.chart.length] },
                ]}
              >
                <MaterialCommunityIcons name={action.icon as any} size={21} color="#FFFFFF" />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>
                {action.name}
              </Text>
            </Pressable>
          ))}
        </Grid>
      </View>

      {/* Shortcut mosaic: two stacked squares, then two wide tiles. */}
      <View style={styles.mosaic}>
        <View style={styles.mosaicColumn}>
          <SquareTile
            icon="qrcode-scan"
            label="UPI collect"
            onPress={() => navigation.navigate('UPIPayments')}
          />
          <SquareTile
            icon="plus"
            label="Add money"
            onPress={() => navigation.navigate('FundRequest')}
          />
        </View>
        <WideTile
          icon="bank-outline"
          title="Withdraw"
          subtitle="AEPS wallet to your bank"
          onPress={() => navigation.navigate('AepsSettlement')}
        />
        <WideTile
          icon="view-grid-outline"
          title="All services"
          onPress={() => navigation.navigate('Services')}
        />
      </View>

      <SectionTitle
        action={
          <Pressable
            onPress={() => navigation.navigate('Reports')}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.link}>All reports</Text>
          </Pressable>
        }
      >
        {spent > 0 ? `This month · ${money(spent)}` : 'This month'}
      </SectionTitle>
      <Grid columns={2}>
        {METRICS.map((metric, index) => (
          <View key={metric.key} style={styles.metric}>
            <View style={styles.metricTop}>
              <View
                style={[
                  styles.metricDot,
                  { backgroundColor: colors.chart[index % colors.chart.length] },
                ]}
              />
              <Text style={styles.metricLabel} numberOfLines={1}>
                {metric.label}
              </Text>
            </View>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(stats?.[metric.key])}
            </Text>
          </View>
        ))}
      </Grid>

      <SectionTitle
        action={
          <Pressable
            onPress={() => navigation.navigate('WalletLedgerReport')}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.link}>See all</Text>
          </Pressable>
        }
      >
        Transactions
      </SectionTitle>
      <View style={styles.card}>
        {grouped.length ? (
          grouped.map((day) => (
            <View key={day.key} style={styles.dayBlock}>
              <View style={styles.dayHead}>
                <Text style={styles.dayLabel}>{dayHeading(day.key)}</Text>
                <Text style={styles.dayMeta} numberOfLines={1}>
                  {day.rows.length} txn · {money(day.commission)} earned
                </Text>
              </View>
              {day.shown.map((tx: any, index: number) => (
                <TransactionRow key={tx._id ?? tx.transactionId ?? index} tx={tx} index={index} />
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            icon="text-box-outline"
            title="No transactions yet"
            subtitle={`Nothing in the last ${WINDOW_DAYS} days`}
            action={{ label: 'Browse services', onPress: () => navigation.navigate('Services') }}
          />
        )}
      </View>
    </Screen>
  );
};

const TransactionRow: React.FC<{ tx: any; index: number }> = ({ tx, index }) => {
  const type = String(tx.type || '').toUpperCase();
  const credit = CREDIT_TYPES.has(type);
  const party = partyFor(tx);
  return (
    <View style={styles.sale}>
      <View
        style={[styles.saleAvatar, { backgroundColor: colors.chart[index % colors.chart.length] }]}
      >
        <MaterialCommunityIcons
          name={(ICON_FOR[type] ?? 'swap-horizontal') as any}
          size={18}
          color="#FFFFFF"
        />
      </View>
      <View style={styles.saleInfo}>
        <Text style={styles.saleTitle} numberOfLines={1}>
          {labelFor(type)}
        </Text>
        {!!party && (
          <Text style={styles.saleMeta} numberOfLines={1}>
            {party}
          </Text>
        )}
      </View>
      <View style={styles.saleRight}>
        <Text style={[styles.saleAmount, credit && styles.saleCredit]} numberOfLines={1}>
          {credit ? '+' : ''}
          {money(tx.amount)}
        </Text>
        {tx.status === 'SUCCESS' ? (
          <Text style={styles.saleTime}>{timeOf(tx.createdAt || tx.date)}</Text>
        ) : (
          <StatusPill status={tx.status} />
        )}
      </View>
    </View>
  );
};

const IconButton: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={6}
  >
    <MaterialCommunityIcons name={icon as any} size={20} color={colors.foreground} />
  </Pressable>
);

const SquareTile: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.square, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <MaterialCommunityIcons name={icon as any} size={22} color={colors.foreground} />
  </Pressable>
);

const WideTile: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.tile, styles.tileWide, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
  >
    <View style={styles.wideIcon}>
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.foreground} />
    </View>
    <View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={styles.tileHint} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </View>
  </Pressable>
);

/** Height of the shortcut mosaic: two 60pt squares plus the gap between them. */
const MOSAIC_HEIGHT = 130;

const styles = themed((c) => ({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  identityName: { fontSize: t.body, fontWeight: '700', color: c.foreground },
  identityCode: { fontSize: t.micro, color: c.mutedForeground },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },

  wallet: {
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.sm,
    overflow: 'hidden',
    // The gradient paints the fill; this only matters for the split second
    // before the SVG mounts, and in light mode where the card stays dark.
    backgroundColor: '#1C1C20',
  },
  walletTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletLabel: { fontSize: t.small, fontWeight: '700', color: '#FFFFFF' },
  walletAdd: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  walletValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: space.xxl,
    fontVariant: ['tabular-nums'],
  },
  walletFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  walletMeta: { fontSize: t.caption, color: 'rgba(255,255,255,0.62)', fontVariant: ['tabular-nums'] },

  duo: { flexDirection: 'row', gap: space.md },
  tile: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  tileHalf: { flex: 1, minWidth: 0, minHeight: 132, gap: 6 },
  tileWide: { flex: 1, minWidth: 0, height: MOSAIC_HEIGHT, gap: space.sm },
  tileTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  tileHint: { fontSize: t.micro, color: c.mutedForeground },
  tileValue: {
    fontSize: t.title,
    fontWeight: '800',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  bar: { flexDirection: 'row', gap: 4, height: 10 },
  barPart: { flexBasis: 0, borderRadius: radius.pill, minWidth: 8 },
  barEmpty: { flexGrow: 1, backgroundColor: c.secondary },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.card,
  },

  commissionTop: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  commissionMain: { flex: 1, minWidth: 0, gap: 2 },
  commissionAside: { alignItems: 'flex-end', gap: 2 },
  commissionValue: {
    fontSize: t.h2,
    fontWeight: '800',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  commissionAsideValue: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  stripDay: { flex: 1, alignItems: 'center', gap: 6 },
  stripAmount: {
    fontSize: t.micro,
    color: c.mutedForeground,
    fontVariant: ['tabular-nums'],
    height: 14,
  },
  // Fixed track so every column shares a baseline and the bars stay comparable.
  stripTrack: {
    width: '100%',
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: c.secondary,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stripFill: { width: '100%', borderRadius: radius.sm, backgroundColor: c.chart[0] },
  stripFillToday: { backgroundColor: c.success },
  stripLetter: { fontSize: t.micro, color: c.mutedForeground },
  stripLetterToday: { color: c.foreground, fontWeight: '700' },

  mosaic: { flexDirection: 'row', gap: space.md, height: MOSAIC_HEIGHT },
  mosaicColumn: { width: 60, justifyContent: 'space-between' },
  square: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg },
  quick: {
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingVertical: space.xs,
    paddingHorizontal: 2,
    borderRadius: radius.md,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: t.micro,
    fontWeight: '600',
    color: c.foreground,
    textAlign: 'center',
    lineHeight: 13,
  },
  link: { fontSize: t.small, fontWeight: '700', color: c.mutedForeground },

  metric: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    gap: 8,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricDot: { width: 8, height: 8, borderRadius: radius.pill },
  metricLabel: { flex: 1, fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  metricValue: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  dayBlock: { gap: 2 },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingTop: space.md,
  },
  dayLabel: { fontSize: t.micro, fontWeight: '700', letterSpacing: 1.2, color: c.mutedForeground },
  dayMeta: { fontSize: t.micro, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  sale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  saleAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleInfo: { flex: 1, minWidth: 0, gap: 2 },
  saleTitle: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  saleMeta: { fontSize: t.micro, color: c.mutedForeground },
  saleRight: { alignItems: 'flex-end', gap: 4 },
  saleAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  saleCredit: { color: c.success },
  saleTime: { fontSize: t.micro, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
}));

export default DashboardScreen;
