import React, { useEffect, useRef } from 'react';
import { Animated, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, motion, radius, space, TOUCH } from '../../theme/colors';
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
 * Icon-only by design: the selected destination is carried by a filled
 * rounded-square behind the glyph. Every item still ships an
 * accessibilityLabel and a selected state, so nothing is lost to a screen
 * reader — only the visible caption goes.
 */
export const BottomTabBar: React.FC<Props> = ({ tabs, activeRoute, onNavigate }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}
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
 * One tab. The active square grows into place instead of snapping, which is
 * what makes the bar feel like a physical control rather than a set of links.
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
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            },
          ]}
        />
        <MaterialCommunityIcons
          name={(active ? tab.iconActive : tab.icon) as any}
          size={23}
          color={active ? colors.tabBarActive : colors.tabBarInactive}
        />
      </View>
    </Pressable>
  );
};

const styles = themed((c, isDark) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.tabBar,
    // Dark separates by fill, not by a rule: the bar is already flush black
    // and a hairline above it would read as a seam across the page.
    borderTopWidth: isDark ? 0 : 1,
    borderTopColor: c.border,
    paddingTop: space.md,
    paddingHorizontal: space.sm,
  },
  item: {
    flex: 1,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  // Opacity only: a transform here would shift the neighbouring items.
  itemPressed: { opacity: 0.6 },
  iconWrap: {
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sits behind the glyph so the square can animate without moving the icon.
  iconPill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: isDark ? c.surfaceAlt : c.accentSubtle,
  },
}));

export default BottomTabBar;
