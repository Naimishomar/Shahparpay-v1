import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { Screen, SectionTitle, Grid } from '@/components/ui/Screen';
import { SERVICE_ITEMS, MenuEntry } from '@/constants';

/**
 * Second-level hub. The old drawer listed 17 flat items; grouping them here by
 * what the retailer is trying to do keeps the bottom bar at five destinations.
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
            <SectionTitle>{group}</SectionTitle>
            <Grid>
              {items.map((item) => (
                <ServiceTile
                  key={item.route}
                  item={item}
                  onPress={() => navigation.navigate(item.route)}
                />
              ))}
            </Grid>
          </View>
        );
      })}
    </Screen>
  );
};

const ServiceTile: React.FC<{ item: MenuEntry; onPress: () => void }> = ({ item, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    accessibilityRole="button"
    accessibilityLabel={item.hint ? `${item.name}. ${item.hint}` : item.name}
  >
    <View style={styles.tileIcon}>
      <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.accent} />
    </View>
    <Text style={styles.tileName} numberOfLines={2}>
      {item.name}
    </Text>
    {!!item.hint && (
      <Text style={styles.tileHint} numberOfLines={2}>
        {item.hint}
      </Text>
    )}
  </Pressable>
);

const styles = themed((c) => ({
  group: { gap: space.md },
  tile: {
    minHeight: 118,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  tilePressed: { opacity: 0.75 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  tileHint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 15 },
}));

export default ServicesScreen;
