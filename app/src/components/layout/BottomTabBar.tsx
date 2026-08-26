import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, motion, radius, space, type as t, TOUCH } from '../../theme/colors';
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
      {tabs.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          active={tab.route === activeRoute}
          onPress={() => onNavigate(tab.route)}
        />
      ))}
    </View>
  );
};

/**
 * One tab. The active pill grows into place instead of snapping, which is what
 * makes the bar feel like a physical control rather than a set of links.
 */
const TabItem: React.FC<{ tab: TabEntry; active: boolean; onPress: () => void }> = ({
  tab,
  active,
  onPress,
}) => {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? motion.normal : motion.exit,
      // Scale and opacity only, so this stays on the UI thread.
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: active }}
      hitSlop={4}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.iconPill,
            {
              opacity: progress,
              transform: [
                { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
          ]}
        />
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
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sits behind the glyph so the pill can animate without moving the icon.
  iconPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: c.accentSubtle,
  },
  label: {
    fontSize: t.micro,
    fontWeight: '600',
    color: c.tabBarInactive,
  },
  labelActive: { color: c.tabBarActive, fontWeight: '700' },
}));

export default BottomTabBar;
