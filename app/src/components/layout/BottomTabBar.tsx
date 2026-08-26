import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { TabEntry } from '@/constants';

interface Props {
  tabs: TabEntry[];
  activeRoute: string;
  onNavigate: (route: string) => void;
}

/**
 * Five-destination bottom bar. Hand-rolled rather than pulling in
 * @react-navigation/bottom-tabs: the app already owns its stack, and this is
 * the only place the pattern is used.
 *
 * Every item carries an icon *and* a label (icon-only nav hurts
 * discoverability), reports its selected state to screen readers, and gets a
 * full-height 48dp target.
 */
export const BottomTabBar: React.FC<Props> = ({ tabs, activeRoute, onNavigate }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.route === activeRoute;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onNavigate(tab.route)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="tab"
            accessibilityLabel={tab.name}
            accessibilityState={{ selected: active }}
            hitSlop={4}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <MaterialCommunityIcons
                name={(active ? tab.iconActive : tab.icon) as any}
                size={22}
                color={active ? colors.tabBarActive : colors.tabBarInactive}
              />
            </View>
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              // The label repeats the tab name already announced by the row.
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {tab.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = themed((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.tabBar,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 12 },
    }),
  },
  item: {
    flex: 1,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  // Opacity only: a transform here would shift the neighbouring labels.
  itemPressed: { opacity: 0.6 },
  iconWrap: {
    minWidth: 44,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: c.accentSubtle },
  label: {
    fontSize: t.micro,
    fontWeight: '500',
    color: c.tabBarInactive,
  },
  labelActive: { color: c.tabBarActive, fontWeight: '700' },
}));

export default BottomTabBar;
