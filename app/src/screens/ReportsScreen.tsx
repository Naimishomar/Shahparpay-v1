import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t, TOUCH } from '../theme/colors';
import { Screen, SectionTitle } from '@/components/ui/Screen';
import { REPORT_ITEMS, ReportEntry } from '@/constants';

export const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <SectionTitle>All reports</SectionTitle>
      <View style={styles.list}>
        {REPORT_ITEMS.map((item, index) => (
          <ReportRow
            key={item.route}
            item={item}
            last={index === REPORT_ITEMS.length - 1}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </View>
    </Screen>
  );
};

const ReportRow: React.FC<{ item: ReportEntry; last: boolean; onPress: () => void }> = ({
  item,
  last,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
    accessibilityRole="button"
    accessibilityLabel={`${item.name}. ${item.hint}`}
  >
    <View style={styles.rowIcon}>
      <MaterialCommunityIcons name={item.icon as any} size={19} color={colors.accent} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowName}>{item.name}</Text>
      <Text style={styles.rowHint} numberOfLines={1}>
        {item.hint}
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
  </Pressable>
);

const styles = themed((c) => ({
  list: {
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: c.secondary },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  rowHint: { fontSize: t.caption, color: c.mutedForeground },
}));

export default ReportsScreen;
