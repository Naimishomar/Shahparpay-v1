import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Screen, EmptyState, dateTime } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

/** Announcement kind -> glyph. Each tone carries its own shape, not just colour. */
const ICON: Record<string, { icon: string; tone: 'accent' | 'warning' }> = {
  info: { icon: 'information', tone: 'accent' },
  success: { icon: 'check-circle', tone: 'accent' },
  warning: { icon: 'alert', tone: 'warning' },
  urgent: { icon: 'alert-octagon', tone: 'warning' },
};

/**
 * Platform announcements, as a screen of its own.
 *
 * It was a modal over Home, which meant the back gesture dismissed it instead
 * of going anywhere, it could not be reached from a deep link, and a long
 * announcement scrolled inside a panel inside a scrolling page. As a route it
 * gets the back stack, the header and pull-to-refresh for free.
 */
export const NotificationsScreen: React.FC = () => {
  const feed = useAsync<{ items: any[]; unread: number }>(async () => {
    const res = await api.getNotifications();
    return { items: res.data ?? [], unread: Number(res.unreadCount ?? 0) };
  }, []);

  const items = feed.data?.items ?? [];

  const markRead = async (item: any) => {
    if (item.isRead) return;
    // Optimistic: the row settles on the tap rather than a round trip later.
    // The POST flushes the response cache, so the bell re-reads the truth.
    feed.setData({
      items: items.map((row) => (row._id === item._id ? { ...row, isRead: true } : row)),
      unread: Math.max(0, (feed.data?.unread ?? 0) - 1),
    });
    await api.markNotificationRead(item._id).catch(() => undefined);
  };

  return (
    <Screen
      loading={feed.loading}
      refreshing={feed.refreshing}
      onRefresh={feed.refresh}
      error={feed.error}
      onRetry={feed.reload}
    >
      {items.length ? (
        <Card padding={0}>
          <CardContent style={styles.list}>
            {items.map((item: any, index: number) => {
              const spec = ICON[item.kind] ?? ICON.info;
              return (
                <Pressable
                  key={item._id}
                  onPress={() => markRead(item)}
                  disabled={item.isRead}
                  style={({ pressed }) => [
                    styles.row,
                    index === items.length - 1 && styles.rowLast,
                    !item.isRead && styles.rowUnread,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.message}${
                    item.isRead ? '' : '. Unread, tap to mark as read'
                  }`}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      spec.tone === 'warning' && { backgroundColor: colors.warningSubtle },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={spec.icon as any}
                      size={18}
                      color={spec.tone === 'warning' ? colors.warning : colors.accent}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowMessage}>{item.message}</Text>
                    <Text style={styles.rowTime}>{dateTime(item.createdAt)}</Text>
                  </View>
                  {!item.isRead && <View style={styles.dot} />}
                </Pressable>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon="bell-outline"
          title="Nothing new"
          subtitle="Announcements from ShahparPay appear here"
        />
      )}
    </Screen>
  );
};

const styles = themed((c) => ({
  list: { paddingHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowUnread: { backgroundColor: c.accentSubtle },
  pressed: { opacity: 0.6 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: t.body, fontWeight: '700', color: c.foreground },
  rowMessage: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  rowTime: { fontSize: t.micro, color: c.mutedForeground, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.accent, marginTop: 8 },
}));

export default NotificationsScreen;
