import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import {
  Screen,
  Banner,
  SectionTitle,
  money,
  shortDate,
  SkeletonRows,
  SkeletonCard,
  SkeletonGrid,
} from '@/components/ui/Screen';
import { StatusText } from './RechargeScreen';
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
  [/electric|power/i, 'lightbulb-outline'],
  [/water/i, 'water-outline'],
  [/broadband|internet|wifi/i, 'wifi'],
  [/landline/i, 'phone-in-talk-outline'],
  [/dth/i, 'satellite-variant'],
  [/cable|tv|television/i, 'television'],
  [/mobile|postpaid|prepaid|recharge/i, 'cellphone'],
  [/insur/i, 'shield-plus-outline'],
  [/credit card/i, 'credit-card-outline'],
  [/loan|emi/i, 'hand-coin-outline'],
  [/municipal|tax|housing/i, 'city'],
  [/education|fee|school/i, 'school-outline'],
  [/hospital|health/i, 'hospital-box-outline'],
  [/rent/i, 'home-city-outline'],
  [/subscription|club|association/i, 'cash-multiple'],
];

/**
 * The MCI glyph above, drawn as BHIM's thin Ionicons outline. Keyed by the
 * glyph so the keyword table (and its test) stays the single source.
 */
const LINE: Record<string, string> = {
  car: 'car-outline',
  'gas-cylinder': 'flask-outline',
  fire: 'flame-outline',
  'lightbulb-outline': 'bulb-outline',
  'water-outline': 'water-outline',
  wifi: 'wifi-outline',
  'phone-in-talk-outline': 'call-outline',
  'satellite-variant': 'radio-outline',
  television: 'tv-outline',
  cellphone: 'phone-portrait-outline',
  'shield-plus-outline': 'shield-checkmark-outline',
  'credit-card-outline': 'card-outline',
  'hand-coin-outline': 'cash-outline',
  city: 'business-outline',
  'school-outline': 'school-outline',
  'hospital-box-outline': 'medkit-outline',
  'home-city-outline': 'home-outline',
  'cash-multiple': 'repeat-outline',
  receipt: 'receipt-outline',
};

/** Grey circle with a thin line glyph — Home's icon tile, for a bill category. */
export const CategoryTile: React.FC<{ icon: string; size?: number; off?: boolean }> = ({ icon, size = 56, off }) => (
  <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }, off && styles.tileOff]}>
    <Ionicons
      name={(LINE[icon] ?? 'receipt-outline') as any}
      size={Math.round(size * 0.46)}
      color={off ? colors.mutedForeground : colors.tileForeground}
    />
  </View>
);

interface Category {
  key: string;
  label: string;
  /** The provider lists the category but has no biller behind it yet. */
  available: boolean;
}

export const categoryIcon = (name: string) =>
  CATEGORY_ICONS.find(([pattern]) => pattern.test(String(name ?? '')))?.[1] ?? 'receipt';

/**
 * Display groups for the hub, by keyword like the icons — the provider's
 * category names, not ours. Anything unmatched lands in Utilities.
 */
const GROUPS: [string, RegExp | null][] = [
  ['Finance', /fastag|toll|loan|emi|credit|insur/i],
  ['More', /municipal|tax|housing|education|fee|school|hospital|health|rent|subscription|club|association/i],
  ['Utilities', null],
];
const groupOf = (label: string) =>
  GROUPS.find(([, pattern]) => !pattern || pattern.test(label))![0];
const GROUP_ORDER = ['Utilities', 'Finance', 'More'];

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
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => groupOf(item.label) === group),
  })).filter((g) => g.items.length);

  return (
    <Screen
      loading={categories.loading}
      skeleton={<View style={{ gap: 16 }}><SkeletonCard><SkeletonRows count={1} amount={false} /></SkeletonCard><SkeletonCard title><SkeletonGrid count={8} /></SkeletonCard><SkeletonCard title><SkeletonGrid count={4} /></SkeletonCard></View>}
      refreshing={categories.refreshing || history.refreshing}
      onRefresh={() => {
        categories.refresh();
        history.refresh();
        balances.refresh();
      }}
      error={categories.error}
      onRetry={categories.reload}
    >
      {/* The wallet bills are paid from, as Home draws a wallet card. */}
      <View style={styles.wallet}>
        <View style={styles.walletIcon}>
          <Ionicons name="wallet-outline" size={22} color={colors.highlight} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.walletLabel}>Paid from main wallet</Text>
          <Text style={styles.walletValue} numberOfLines={1}>
            {money(balances.data?.mainBalance)}
          </Text>
        </View>
        <Text style={styles.walletNote}>Earn commission{'\n'}on every bill</Text>
      </View>

      {!categories.loading && !categories.error && !items.length && (
        <Banner
          tone="warning"
          message="No bill categories are available from the provider right now. Please try again later."
        />
      )}

      {groups.map(({ group, items: groupItems }) => (
        <View key={group} style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {group}
          </Text>
          <View style={styles.grid}>
            {groupItems.map((item) => {
              const icon = categoryIcon(item.label);
              return (
                <Pressable
                  key={item.key}
                  // Not navigable while the provider has no biller behind it: the
                  // form would load an empty picker and refuse every payment.
                  disabled={!item.available}
                  onPress={() => navigation.navigate('BbpsService', { category: item.key, title: item.label })}
                  style={({ pressed }) => [styles.act, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !item.available }}
                  accessibilityLabel={
                    item.available
                      ? `${item.label}. Pay a bill`
                      : `${item.label}. Coming soon, not live on our BBPS provider yet`
                  }
                >
                  <CategoryTile icon={icon} off={!item.available} />
                  <Text style={[styles.label, !item.available && styles.labelOff]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {/* Said in words, not by dimming alone — the grey reads as a
                      rendering glitch on its own, and not at all to a colour-blind
                      reader. */}
                  {!item.available && <Text style={styles.soon}>Coming soon</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <SectionTitle>Recent payments</SectionTitle>
      <View style={styles.list}>
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          history.data.slice(0, 20).map((txn: any, i: number, all: any[]) => (
            <View key={txn._id || txn.transactionId} style={[styles.rowI, i === all.length - 1 && styles.rowLast]}>
              <CategoryTile icon={categoryIcon(txn.metadata?.mode)} size={44} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {txn.metadata?.caNumber || txn.transactionId}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[txn.metadata?.operatorName || txn.metadata?.mode, shortDate(txn.createdAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>{money(txn.amount)}</Text>
                <StatusText status={txn.status} />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No bill payments yet</Text>
        )}
      </View>
    </Screen>
  );
};

const styles = themed((c) => ({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },

  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: { fontSize: t.small, color: c.mutedForeground },
  walletValue: { fontSize: t.title + 2, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'], marginTop: 2 },
  walletNote: { fontSize: t.caption, color: c.mutedForeground, textAlign: 'right', lineHeight: 17 },

  // Home's service card: title, then round line icons four to a row.
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  act: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.tileGradient[0] },
  tileOff: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong },
  label: { fontSize: t.small, fontWeight: '400', color: c.foreground, textAlign: 'center', lineHeight: 17 },
  labelOff: { color: c.mutedForeground },
  soon: { fontSize: t.micro, color: c.mutedForeground, marginTop: -4 },

  list: { paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  rowI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  rowMeta: { fontSize: t.caption, color: c.mutedForeground, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowAmount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  empty: { fontSize: t.small, color: c.mutedForeground, paddingVertical: space.lg, textAlign: 'center' },
}));

export default BbpsScreen;
