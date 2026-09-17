import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={8}
    >
      <MaterialCommunityIcons
        name="bell-outline"
        size={19}
        color={onBand ? colors.bandForeground : colors.foreground}
      />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = themed((c) => ({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: c.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
}));

export default NotificationBell;
