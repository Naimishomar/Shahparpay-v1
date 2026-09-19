import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Grid,
  Row,
  StatusPill,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

/**
 * Category name -> glyph, matched on a keyword rather than an exact string.
 *
 * The categories are the provider's, not ours: they add and rename them, and
 * they spell the same thing several ways ("Electricity", "Electricity Bill",
 * "ELECTRICITY"). A keyword list keeps a renamed category looking right
 * instead of silently falling back to a generic receipt, and an unmatched one
 * still renders — just with the default.
 *
 * Order matters: the first match wins, so the more specific words come first.
 */
const CATEGORY_ICONS: [RegExp, string][] = [
  [/fastag|toll/i, 'car'],
  [/lpg|cylinder/i, 'gas-cylinder'],
  [/gas/i, 'fire'],
  [/electric|power/i, 'flash'],
  [/water/i, 'water'],
  [/broadband|internet|wifi/i, 'router-wireless'],
  [/landline/i, 'phone-classic'],
  [/dth|cable|tv|television/i, 'satellite-uplink'],
  [/mobile|postpaid|prepaid|recharge/i, 'cellphone'],
  [/insur/i, 'shield-check-outline'],
  [/loan|emi|credit card/i, 'bank-outline'],
  [/municipal|tax|housing/i, 'city'],
  [/education|fee|school/i, 'school-outline'],
  [/hospital|health/i, 'hospital-box-outline'],
  [/rent/i, 'home-city-outline'],
  [/subscription|club|association/i, 'cash-multiple'],
];

interface Category {
  key: string;
  label: string;
  /** The provider lists the category but has no biller behind it yet. */
  available: boolean;
}

export const categoryIcon = (name: string) =>
  CATEGORY_ICONS.find(([pattern]) => pattern.test(String(name ?? '')))?.[1] ?? 'receipt';

/**
 * BBPS hub: one card per category the provider currently bills for, each
 * opening its own screen.
 *
 * It used to be a single screen with every category on a horizontal strip
 * above one shared form. With twenty-odd categories the strip scrolled past
 * the edge, and picking one silently reset the biller, the fetched bill and
 * the amount underneath — the form looked untouched but was not. A category is
 * its own task, so it gets its own screen and its own back button.
 */
export const BbpsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const categories = useAsync<Category[]>(async () => {
    const res = await api.getBillCategories();
    // A refused list is not an empty list: swallowing it left the screen with
    // no categories and nothing to explain why.
    if (!res.success) throw new Error(res.message || 'Could not load bill categories.');
    return (res.data ?? [])
      .map((c: any) => ({
        key: c.id || c.category || c.name || c.code,
        label: c.name || c.category || c.code,
        // The backend already asked the provider for each category's billers
        // and reports whether any came back. Dropping the flag here is what
        // let a dead category open onto a form that could only fail.
        available: c.available !== false,
      }))
      // Live services lead; the rest still show, so a retailer can see the
      // service exists and is coming rather than assume it was dropped.
      .sort((a: Category, b: Category) => Number(b.available) - Number(a.available));
  }, []);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const items = categories.data ?? [];

  return (
    <Screen
      loading={categories.loading}
      refreshing={categories.refreshing || history.refreshing}
      onRefresh={() => {
        categories.refresh();
        history.refresh();
        balances.refresh();
      }}
      error={categories.error}
      onRetry={categories.reload}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(balances.data?.mainBalance)} mono last />
        </CardContent>
      </Card>

      {!categories.loading && !categories.error && !items.length && (
        <Banner
          tone="warning"
          message="No bill categories are available from the provider right now. Please try again later."
        />
      )}

      {!!items.length && (
        <Grid columns={2}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              // Not navigable while the provider has no biller behind it: the
              // form would load an empty picker and refuse every payment.
              disabled={!item.available}
              onPress={() =>
                navigation.navigate('BbpsService', { category: item.key, title: item.label })
              }
              style={({ pressed }) => [
                styles.tile,
                !item.available && styles.tileOff,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !item.available }}
              accessibilityLabel={
                item.available
                  ? `${item.label}. Pay a bill`
                  : `${item.label}. Coming soon, not live on our BBPS provider yet`
              }
            >
              <View style={[styles.tileIcon, !item.available && styles.tileIconOff]}>
                <MaterialCommunityIcons
                  name={categoryIcon(item.label) as any}
                  size={22}
                  color={item.available ? colors.accent : colors.mutedForeground}
                />
              </View>
              <Text
                style={[styles.tileLabel, !item.available && styles.tileLabelOff]}
                numberOfLines={2}
              >
                {item.label}
              </Text>
              {/* Said in words, not by dimming alone — the grey reads as a
                  rendering glitch on its own, and not at all to a colour-blind
                  reader. */}
              {!item.available && <Text style={styles.tileSoon}>COMING SOON</Text>}
            </Pressable>
          ))}
        </Grid>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Consumer" value={txn.metadata?.caNumber} />
                <Row label="Mode" value={txn.metadata?.mode} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState icon="receipt" title="No bill payments yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c, isDark) => ({
  tile: {
    minHeight: 104,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: space.sm,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, backgroundColor: c.accentSubtle },
  tileOff: { backgroundColor: c.secondary, borderStyle: 'dashed' },
  tileIconOff: { backgroundColor: c.secondary },
  tileLabelOff: { color: c.mutedForeground },
  tileSoon: {
    fontSize: t.micro,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: c.mutedForeground,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: isDark ? c.surfaceAlt : c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: t.small, fontWeight: '700', color: c.foreground },

  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default BbpsScreen;
