import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Screen,
  EmptyState,
  Grid,
  SectionTitle,
  StatusPill,
  money,
  dateTime,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { QUICK_ACTIONS } from '@/constants';
import { DashboardStats } from '@/types';
import api from '@/services/api';

interface DashboardData {
  stats: DashboardStats;
  recentSales: any[];
}

/** Only the metrics a retailer acts on. The rest live in Reports. */
const METRICS: { key: keyof DashboardStats; label: string; icon: string }[] = [
  { key: 'AEPS_WITHDRAWAL', label: 'AEPS', icon: 'fingerprint' },
  { key: 'DMT', label: 'Money transfer', icon: 'bank-transfer' },
  { key: 'RECHARGE', label: 'Recharge', icon: 'cellphone' },
  { key: 'BILL_PAYMENT', label: 'Bill payments', icon: 'receipt' },
  { key: 'AEPS_SETTLEMENT', label: 'Payouts', icon: 'cash-fast' },
  { key: 'WALLET_TOPUP', label: 'UPI collected', icon: 'qrcode' },
];

/** How far the balance card rides up into the brand band. Deep enough that the
 *  ink reads as a ground behind the card rather than a line above it. */
const BALANCE_OVERLAP = 52;

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const dashboard = useAsync<DashboardData>(
    async () => (await api.getRetailerDashboard()).data,
    []
  );
  // Separate from the dashboard call: the balance is the number a retailer
  // opens the app to read, so it must not wait on the slower stats query.
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const stats = dashboard.data?.stats;
  const sales = dashboard.data?.recentSales ?? [];

  const refresh = () => {
    dashboard.refresh();
    balances.refresh();
  };

  const initials = (user?.name || 'R')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <Screen
      loading={dashboard.loading}
      refreshing={dashboard.refreshing}
      onRefresh={refresh}
      error={dashboard.error}
      onRetry={dashboard.reload}
      headerOverlap={BALANCE_OVERLAP}
      header={
        <View style={styles.band}>
          <View style={styles.bandTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
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
          </View>
        </View>
      }
    >
      <Card padding={space.lg}>
        <View style={styles.balRow}>
          <View style={styles.balMain}>
            <Text style={styles.balLabel}>Main wallet</Text>
            <Text style={styles.balValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(balances.data?.mainBalance)}
            </Text>
          </View>
          <View style={styles.balAside}>
            <Text style={styles.balLabel}>AEPS</Text>
            <Text style={styles.balAsideValue} numberOfLines={1}>
              {money(balances.data?.aepsBalance)}
            </Text>
          </View>
        </View>
        <View style={styles.balActions}>
          <Pressable
            onPress={() => navigation.navigate('FundRequest')}
            style={({ pressed }) => [styles.balBtn, styles.balBtnPrimary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.balBtnPrimaryText}>Add money</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('AepsSettlement')}
            style={({ pressed }) => [styles.balBtn, styles.balBtnGhost, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.balBtnGhostText}>Withdraw</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <CardHeader
          action={
            <Pressable
              onPress={() => navigation.navigate('Services')}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text style={styles.link}>All services</Text>
            </Pressable>
          }
        >
          <CardTitle icon="apps">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Grid columns={4}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.route}
                onPress={() => navigation.navigate(action.route)}
                style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={action.name}
              >
                <View style={styles.quickIcon}>
                  <MaterialCommunityIcons
                    name={action.icon as any}
                    size={21}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.quickLabel} numberOfLines={2}>
                  {action.name}
                </Text>
              </Pressable>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="chart-line">Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={styles.earningsLabel}>Total earnings</Text>
          <Text style={styles.earningsValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(stats?.TotalCommission)}
          </Text>
          <View style={styles.earningsMeta}>
            <MetaItem label="Customers" value={String(stats?.TotalCustomers ?? 0)} />
            <View style={styles.metaDivider} />
            <MetaItem label="Volume" value={money(stats?.TotalTransactionsAmount)} />
          </View>
        </CardContent>
      </Card>

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
        This month
      </SectionTitle>
      <Grid columns={2}>
        {METRICS.map((metric) => (
          <View key={metric.key} style={styles.metric}>
            <View style={styles.metricTop}>
              <MaterialCommunityIcons
                name={metric.icon as any}
                size={16}
                color={colors.mutedForeground}
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

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length ? (
            sales.slice(0, 8).map((sale: any, index: number) => (
              <View
                key={sale.id ?? sale._id ?? index}
                style={[styles.sale, index === Math.min(sales.length, 8) - 1 && styles.saleLast]}
              >
                <View style={styles.saleAvatar}>
                  <Text style={styles.saleAvatarText}>
                    {(sale.service || sale.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.saleInfo}>
                  <Text style={styles.saleTitle} numberOfLines={1}>
                    {sale.service || sale.name}
                  </Text>
                  <Text style={styles.saleMeta} numberOfLines={1}>
                    {sale.details || dateTime(sale.date)}
                  </Text>
                </View>
                <View style={styles.saleRight}>
                  <Text style={styles.saleAmount} numberOfLines={1}>
                    {typeof sale.amount === 'number' ? money(sale.amount) : sale.amount}
                  </Text>
                  <StatusPill status={sale.status} />
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="text-box-outline"
              title="No transactions yet"
              subtitle="Your most recent sales will appear here"
              action={{ label: 'Browse services', onPress: () => navigation.navigate('Services') }}
            />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const MetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metaItem}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  // Continues the app header's band in the same ink, so the two read as one
  // block. `band` is deliberately not `accent`: accent inverts to near-white
  // in dark mode, which is right for a button and glare for a full-width band.
  band: {
    backgroundColor: c.band,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg + BALANCE_OVERLAP,
  },
  bandTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(127,127,127,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: t.small, fontWeight: '700', color: c.bandForeground },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  identityName: { fontSize: t.body, fontWeight: '700', color: c.bandForeground },
  identityCode: { fontSize: t.micro, color: c.bandForeground, opacity: 0.75 },

  earningsLabel: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  earningsValue: {
    fontSize: t.h1,
    fontWeight: '800',
    color: c.foreground,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  earningsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  metaItem: { flex: 1, minWidth: 0, gap: 1 },
  metaDivider: { width: 1, height: 26, backgroundColor: c.border },
  metaLabel: { fontSize: t.micro, color: c.mutedForeground },
  metaValue: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  metric: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricLabel: { flex: 1, fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  metricValue: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },

  balRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  balMain: { flex: 1, minWidth: 0, gap: 1 },
  balAside: { alignItems: 'flex-end', gap: 1 },
  balLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  balValue: {
    fontSize: t.h1,
    fontWeight: '800',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  balAsideValue: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  balActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  balBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balBtnPrimary: { backgroundColor: c.accent },
  balBtnPrimaryText: { fontSize: t.small, fontWeight: '700', color: c.bandForeground },
  balBtnGhost: { backgroundColor: c.card, borderWidth: 1, borderColor: c.borderStrong },
  balBtnGhostText: { fontSize: t.small, fontWeight: '700', color: c.foreground },

  quick: {
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingVertical: space.xs,
    paddingHorizontal: 2,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.75 },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: t.micro, fontWeight: '600', color: c.foreground, textAlign: 'center', lineHeight: 13 },
  link: { fontSize: t.small, fontWeight: '700', color: c.accent },
  sale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  saleLast: { borderBottomWidth: 0, paddingBottom: 0 },
  saleAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleAvatarText: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  saleInfo: { flex: 1, minWidth: 0, gap: 2 },
  saleTitle: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  saleMeta: { fontSize: t.micro, color: c.mutedForeground },
  saleRight: { alignItems: 'flex-end', gap: 4 },
  saleAmount: {
    fontSize: t.small,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default DashboardScreen;
