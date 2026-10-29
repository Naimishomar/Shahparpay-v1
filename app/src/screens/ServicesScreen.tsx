import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { IconTile } from '@/components/ui/Gradient';
import { Screen, EmptyState } from '@/components/ui/Screen';
import { isRouteEnabled } from '@/constants/services';
import { useAuth } from '@/context/AuthContext';

/**
 * Second-level hub: a pill search, then each group as a titled card of grey
 * line-icon circles, four to a row — the same grid as Home.
 */
const GROUPS: { title: string; items: { label: string; route: string; icon: string }[] }[] = [
  {
    title: 'Banking',
    items: [
      { label: 'AEPS', route: 'AEPS', icon: 'fingerprint' },
      { label: 'Micro ATM', route: 'MATM', icon: 'credit-card-outline' },
      { label: 'DMT', route: 'DMT', icon: 'bank-transfer' },
    ],
  },
  {
    title: 'Payments',
    items: [
      { label: 'Recharge', route: 'Recharge', icon: 'cellphone' },
      { label: 'BBPS', route: 'BBPS', icon: 'receipt' },
      { label: 'Collect', route: 'Collect', icon: 'qrcode' },
      // Add Money (Razorpay) hidden for now; uncomment to bring it back.
      // { label: 'Add money', route: 'AddMoney', icon: 'credit-card-plus-outline' },
      { label: 'Fund request', route: 'FundRequest', icon: 'cash-multiple' },
    ],
  },
  {
    title: 'Government',
    items: [
      { label: 'PAN card', route: 'PAN', icon: 'card-account-details-outline' },
      { label: 'ITR filing', route: 'ITR', icon: 'file-document-outline' },
      { label: 'Leads', route: 'LeadGeneration', icon: 'account-plus-outline' },
      { label: 'KYC status', route: 'KycStatus', icon: 'check-decagram-outline' },
    ],
  },
];

export const ServicesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => isRouteEnabled(user, item.route) && (!q || item.label.toLowerCase().includes(q))
    ),
  })).filter((group) => group.items.length);

  return (
    <Screen>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={22} color={colors.foreground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search services"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, noOutline]}
          accessibilityLabel="Search services"
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close" size={20} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {groups.map((group) => (
        <View key={group.title} style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            {group.title}
          </Text>
          <View style={styles.grid}>
            {group.items.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => navigation.navigate(item.route)}
                style={({ pressed }) => [styles.act, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <IconTile icon={item.icon} size={56} iconSize={26} />
                <Text style={styles.label} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {!groups.length && <EmptyState icon="magnify" title="No service found" subtitle={`Nothing matches "${query}"`} />}
    </Screen>
  );
};

// Web draws a focus ring around a bare TextInput; the pill border is the field.
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

/** Same card and grid as Home's ServiceCard. */
const styles = themed((c) => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: t.body, color: c.foreground, paddingVertical: space.sm },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  title: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  act: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  label: { fontSize: t.small, fontWeight: '400', color: c.foreground, textAlign: 'center', lineHeight: 17 },
}));

export default ServicesScreen;
