import React, { useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius } from '../../theme/colors';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

interface Props {
  /** Rendered on the brand band (Home), so the glyph flips to the band ink. */
  onBand?: boolean;
  style?: any;
}

/**
 * Unread badge that opens the Notifications screen.
 *
 * Only the count lives here — the list is a route, so the back gesture works
 * and a long announcement is not scrolling inside a panel inside a page.
 *
 * Not polled: a retailer's phone is on mobile data all day. The count is read
 * on mount and again whenever the host screen regains focus, which is what
 * makes the badge drop after the list is read. The 30s cache TTL in api.ts
 * keeps the bell being mounted on several screens from costing several
 * requests, and marking one read flushes that cache.
 */
export const NotificationBell: React.FC<Props> = ({ onBand, style }) => {
  const navigation = useNavigation<any>();

  const feed = useAsync<number>(async () => {
    const res = await api.getNotifications();
    return Number(res.unreadCount ?? 0);
  }, []);

  // reload, not refresh: refresh() drops the whole response cache, and this
  // fires on every return to the screen.
  useFocusEffect(
    useCallback(() => {
      feed.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const unread = feed.data ?? 0;

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      style={({ pressed }) => [styles.button, onBand && styles.buttonOnBand, style, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={8}
    >
      <Ionicons
        name="notifications-outline"
        size={24}
        color={onBand ? colors.bandForeground : colors.foreground}
      />
      {/* A dot, not a count: the number is in the accessibility label. */}
      {unread > 0 && <View style={[styles.dot, onBand && styles.dotOnBand]} />}
    </Pressable>
  );
};

const styles = themed((c) => ({
  // A bare glyph, as in BHIM's top row — no chip behind it.
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOnBand: {},
  pressed: { opacity: 0.6 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: c.highlight,
    borderWidth: 2,
    borderColor: c.background,
  },
  dotOnBand: {},
}));

export default NotificationBell;
