import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

const ROTATE_MS = 6000;

/**
 * The web portal's "Latest Updates" marquee, as one line that cross-fades
 * between announcements.
 *
 * Not a scrolling marquee: text sliding past at a fixed speed is unreadable on
 * a phone-width line and pins an animation frame loop for as long as Home is
 * open. One notice at a time, held long enough to read, says the same thing.
 */
export const UpdatesTicker: React.FC = () => {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const updates = useAsync<any[]>(async () => (await api.getTickerUpdates()).data ?? [], []);
  const items = updates.data ?? [];

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setIndex((current) => (current + 1) % items.length);
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, opacity]);

  // Nothing published means nothing to say — the web's hard-coded filler
  // notices are worse than an empty strip, since they never stop being wrong.
  if (!items.length) return null;

  const current = items[index % items.length];

  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.tag}>
        <MaterialCommunityIcons name="bullhorn-outline" size={13} color={colors.accent} />
        <Text style={styles.tagText}>UPDATES</Text>
      </View>
      <Animated.Text style={[styles.message, { opacity }]} numberOfLines={2}>
        {current?.title ? `${current.title}: ` : ''}
        {current?.message}
      </Animated.Text>
    </View>
  );
};

const styles = themed((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: t.micro, fontWeight: '800', letterSpacing: 0.8, color: c.accent },
  message: { flex: 1, minWidth: 0, fontSize: t.caption, color: c.foreground, lineHeight: 17 },
}));

export default UpdatesTicker;
