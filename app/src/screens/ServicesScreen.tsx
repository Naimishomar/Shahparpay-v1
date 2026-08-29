import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { Screen } from '@/components/ui/Screen';
import { SERVICE_ITEMS, MenuEntry } from '@/constants';

/**
 * Second-level hub. The old drawer listed 17 flat items; grouping them here by
 * what the retailer is trying to do keeps the bottom bar at five destinations.
 *
 * Rows rather than a tile grid: a row fits the name and its hint on one line
 * each at full size, where a 2-up tile had to clamp both to two lines and
 * still truncated "Wallet Transfer" and "Lead Generation". Rows also give the
 * whole width as the tap target instead of a half-width square.
 */
const GROUPS = ['Banking', 'Payments', 'Government', 'Account'];

export const ServicesScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      {GROUPS.map((group) => {
        const items = SERVICE_ITEMS.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
            <View style={styles.card}>
              {items.map((item, index) => (
                <ServiceRow
                  key={item.route}
                  item={item}
                  last={index === items.length - 1}
                  onPress={() => navigation.navigate(item.route)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
};

const ServiceRow: React.FC<{ item: MenuEntry; last: boolean; onPress: () => void }> = ({
  item,
  last,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
    accessibilityRole="button"
    accessibilityLabel={item.hint ? `${item.name}. ${item.hint}` : item.name}
  >
    <View style={styles.rowIcon}>
      <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.accent} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowName} numberOfLines={1}>
        {item.name}
      </Text>
      {!!item.hint && (
        <Text style={styles.rowHint} numberOfLines={1}>
          {item.hint}
        </Text>
      )}
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
  </Pressable>
);

const styles = themed((c) => ({
  group: { gap: space.sm },
  // Set apart from a SectionTitle: this labels a group of rows rather than
  // titling a section, so it stays quiet and lets the row names lead.
  groupLabel: {
    fontSize: t.micro,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: c.mutedForeground,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.md,
    overflow: 'hidden',
  },
  row: {
    // 56 keeps the row clear of the 44pt minimum even before the icon's own
    // padding, so the whole width is a comfortable target.
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: c.accentSubtle },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  rowHint: { fontSize: t.micro, color: c.mutedForeground },
}));

export default ServicesScreen;
