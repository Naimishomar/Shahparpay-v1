import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const dashboard = useAsync<DashboardData>(
    async () => (await api.getRetailerDashboard()).data,
    []
  );
  const stats = dashboard.data?.stats;
  const sales = dashboard.data?.recentSales ?? [];

  return (
    <Screen
      loading={dashboard.loading}
      refreshing={dashboard.refreshing}
      onRefresh={dashboard.refresh}
      error={dashboard.error}
      onRetry={dashboard.reload}
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingLabel}>Welcome back</Text>
        <Text style={styles.greetingName} numberOfLines={1}>
          {user?.name || 'Retailer'}
        </Text>
      </View>

      <Card variant="accent" padding={space.lg}>
        <Text style={styles.earningsLabel}>Total earnings</Text>
        <Text style={styles.earningsValue} numberOfLines={1} adjustsFontSizeToFit>
          {money(stats?.TotalCommission)}
        </Text>
        <View style={styles.earningsMeta}>
          <MetaItem label="Customers" value={String(stats?.TotalCustomers ?? 0)} />
          <View style={styles.metaDivider} />
          <MetaItem label="Volume" value={money(stats?.TotalTransactionsAmount)} />
        </View>
      </Card>

      <SectionTitle>Quick actions</SectionTitle>
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
              <MaterialCommunityIcons name={action.icon as any} size={21} color={colors.accent} />
            </View>
            <Text style={styles.quickLabel} numberOfLines={1}>
              {action.name}
            </Text>
          </Pressable>
        ))}
      </Grid>

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
  greeting: { gap: 2 },
  greetingLabel: { fontSize: t.small, color: c.mutedForeground },
  greetingName: { fontSize: t.h2, fontWeight: '700', color: c.foreground },
  earningsLabel: { fontSize: t.caption, fontWeight: '600', color: c.accentForeground, opacity: 0.85 },
  earningsValue: {
    fontSize: t.h1,
    fontWeight: '800',
    color: c.accentForeground,
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
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  metaItem: { flex: 1, minWidth: 0, gap: 1 },
  metaDivider: { width: 1, height: 26, backgroundColor: 'rgba(0,0,0,0.12)' },
  metaLabel: { fontSize: t.micro, color: c.accentForeground, opacity: 0.75 },
  metaValue: { fontSize: t.body, fontWeight: '700', color: c.accentForeground },
  quick: {
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  pressed: { opacity: 0.75 },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: t.micro, fontWeight: '600', color: c.foreground },
  link: { fontSize: t.small, fontWeight: '700', color: c.accent },
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
