import React from 'react';
import { View, Pressable, Text, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GradientFill } from '../ui/Gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, space, type as t, TOUCH } from '../../theme/colors';
import { TabEntry } from '@/constants';

interface Props {
  tabs: TabEntry[];
  activeRoute: string;
  onNavigate: (route: string) => void;
}

/**
 * BHIM's home nav: a dark bar with rounded shoulders and a notch in the middle,
 * where the raised orange button (AEPS, BHIM's Scan) sits. The other tabs are
 * line icons with captions; the active one turns orange.
 *
 * Hand-rolled rather than @react-navigation/bottom-tabs: the app already owns
 * its stack, and this is the only place the pattern is used.
 */
export const BottomTabBar: React.FC<Props> = ({ tabs, activeRoute, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hasFab = tabs.some((tab) => tab.raised);
  const bottom = Math.max(insets.bottom, space.sm);

  return (
    <View style={[styles.wrap, { height: BAR + bottom, paddingBottom: bottom }]} accessibilityRole="tablist">
      <Svg width={width} height={BAR + bottom} style={styles.shape} pointerEvents="none">
        <Path d={barPath(width, BAR + bottom, hasFab)} fill={colors.tabBar} stroke={colors.border} strokeWidth={1} />
      </Svg>
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

/** The bar outline: rounded top corners and, with a FAB, a round notch. */
const barPath = (w: number, h: number, notch: boolean) => {
  const r = 24;
  const cx = w / 2;
  const n = FAB / 2 + 7;
  const top = notch
    ? `L ${cx - n - 10} 0 Q ${cx - n} 0 ${cx - n + 2} 6 A ${n} ${n} 0 0 0 ${cx + n - 2} 6 Q ${cx + n} 0 ${cx + n + 10} 0`
    : '';
  return `M 0 ${r} Q 0 0 ${r} 0 ${top} L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h} L 0 ${h} Z`;
};

const TabItem: React.FC<{ tab: TabEntry; active: boolean; onPress: () => void }> = ({
  tab,
  active,
  onPress,
}) => {
  const tint = active ? colors.tabBarActive : colors.tabBarInactive;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: active }}
      hitSlop={4}
    >
      {tab.raised ? (
        <View style={styles.fab}>
          <GradientFill stops={colors.activeGradient} diagonal radius={FAB / 2} />
          <TabIcon name={tab.iconActive} size={30} color={colors.primaryForeground} />
        </View>
      ) : (
        <>
          <TabIcon name={active ? tab.iconActive : tab.icon} size={26} color={tint} />
          <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
            {tab.name}
          </Text>
        </>
      )}
    </Pressable>
  );
};

/** Ionicons when the name exists there (the retailer bar), MCI otherwise. */
const TabIcon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) =>
  name in Ionicons.glyphMap ? (
    <Ionicons name={name as any} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons name={name as any} size={size} color={color} />
  );

const BAR = 66;
const FAB = 62;

const styles = themed((c) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.xs,
  },
  shape: { position: 'absolute', left: 0, bottom: 0 },
  item: {
    flex: 1,
    minHeight: TOUCH + 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingBottom: 6,
  },
  // Opacity only: a transform here would shift the neighbouring items.
  itemPressed: { opacity: 0.6 },
  label: { fontSize: t.caption, fontWeight: '500' },
  // Sits in the notch, half above the bar.
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    // Centre on the bar's top edge, inside the notch.
    marginBottom: BAR - FAB / 2 - 6,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
