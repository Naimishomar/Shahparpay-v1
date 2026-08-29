import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';

/** What the app does, in the order a retailer meets it at the counter. */
const SERVICES = [
  { icon: 'fingerprint', title: 'AEPS', line: 'Cash out on Aadhaar' },
  { icon: 'bank-transfer', title: 'Money transfer', line: 'To any bank account' },
  { icon: 'cellphone', title: 'Recharge', line: 'Mobile and DTH' },
  { icon: 'receipt', title: 'Bill payments', line: 'Every BBPS biller' },
  { icon: 'cash-fast', title: 'Payouts', line: 'Settled the same day' },
  { icon: 'card-account-details-outline', title: 'PAN & ITR', line: 'Government services' },
];

/** Pixels per second. Slow enough to read a card as it passes. */
const SPEED = 34;

/**
 * Continuously scrolling strip of what the app does, shown on the sign-in
 * screen where there is otherwise nothing to say.
 *
 * Built from the icon set rather than photography: the app ships no service
 * imagery, and a stock photo would fight the monochrome palette.
 *
 * The track is rendered twice and translated by exactly one copy's width, so
 * the reset is invisible. Purely decorative — hidden from the accessibility
 * tree, and it holds still under Reduce Motion, where an endlessly moving
 * band is the exact thing the setting exists to stop.
 */
export const ServiceMarquee: React.FC = () => {
  const offset = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!trackWidth || reduceMotion) {
      offset.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: -trackWidth,
        // Constant speed regardless of how many cards are in the track.
        duration: (trackWidth / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [trackWidth, reduceMotion, offset]);

  const track = (measured: boolean) => (
    <View
      style={styles.track}
      // Only the first copy is measured; the second is an identical filler.
      onLayout={measured ? (e) => setTrackWidth(e.nativeEvent.layout.width) : undefined}
    >
      {SERVICES.map((service) => (
        <View key={service.title} style={styles.card}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name={service.icon as any}
              size={18}
              color={colors.foreground}
            />
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {service.title}
            </Text>
            <Text style={styles.line} numberOfLines={1}>
              {service.line}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={styles.viewport}
      // Decorative: it repeats what the app does and carries nothing a person
      // signing in needs read out before reaching the username field.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.rail, { transform: [{ translateX: offset }] }]}>
        {track(true)}
        {track(false)}
      </Animated.View>
    </View>
  );
};

const styles = themed((c) => ({
  // Clips the rail so cards appear and leave at the screen edges.
  viewport: { overflow: 'hidden' },
  rail: { flexDirection: 'row' },
  track: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: c.secondary,
  },
  text: { gap: 1 },
  title: { fontSize: t.caption, fontWeight: '700', color: c.foreground },
  line: { fontSize: t.micro, color: c.mutedForeground },
}));

export default ServiceMarquee;
