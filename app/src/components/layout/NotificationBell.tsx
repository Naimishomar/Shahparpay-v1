import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { EmptyState, dateTime } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

/** Announcement kind -> glyph. Warnings and urgent notices share the alert. */
const ICON: Record<string, string> = {
  info: 'information',
  success: 'check-circle',
  warning: 'alert',
  urgent: 'alert-octagon',
};

interface Props {
  /** Rendered on the brand band (Home), so the glyph flips to the band ink. */
  onBand?: boolean;
  /** Overrides the chip styling where the host row has its own button shape. */
  style?: any;
}

/**
 * Platform announcements, the app's half of the web portal's NotificationCenter.
 *
 * Not polled: a retailer's phone is on mobile data all day, and the list is
 * fetched on mount and again every time the panel opens, which is the only
 * moment the count is actually being read. The 30s cache TTL in api.ts keeps
 * mounting it on several screens from costing several requests.
 */
export const NotificationBell: React.FC<Props> = ({ onBand, style }) => {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const feed = useAsync<{ items: any[]; unread: number }>(async () => {
    const res = await api.getNotifications();
    return { items: res.data ?? [], unread: Number(res.unreadCount ?? 0) };
  }, []);

  const items = feed.data?.items ?? [];
  const unread = feed.data?.unread ?? 0;

  const markRead = async (item: any) => {
    if (item.isRead) return;
    // Optimistic: the badge must drop on the tap, not a round trip later. The
    // POST flushes the response cache, so the next open re-reads the truth.
    feed.setData({
      items: items.map((row) => (row._id === item._id ? { ...row, isRead: true } : row)),
      unread: Math.max(0, unread - 1),
    });
    await api.markNotificationRead(item._id).catch(() => undefined);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          feed.reload();
        }}
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
        >
          <View
            style={[styles.panel, { marginTop: insets.top + TOUCH }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleBlock}>
                <Text style={styles.panelTitle}>Notifications</Text>
                <Text style={styles.panelSubtitle}>Latest platform announcements</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView style={styles.list}>
              {items.length ? (
                items.map((item: any) => (
                  <Pressable
                    key={item._id}
                    onPress={() => markRead(item)}
                    style={({ pressed }) => [
                      styles.row,
                      !item.isRead && styles.rowUnread,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.message}`}
                  >
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons
                        name={(ICON[item.kind] ?? 'information') as any}
                        size={16}
                        color={colors.accent}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowMessage}>{item.message}</Text>
                      <Text style={styles.rowTime}>{dateTime(item.createdAt)}</Text>
                    </View>
                    {!item.isRead && <View style={styles.dot} />}
                  </Pressable>
                ))
              ) : (
                <EmptyState
                  icon="bell-outline"
                  title="Nothing new"
                  subtitle="Announcements from ShahparPay appear here"
                />
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
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

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay, alignItems: 'center' },
  panel: {
    width: '92%',
    maxHeight: '70%',
    borderRadius: radius.lg,
    backgroundColor: c.popover,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  panelTitleBlock: { flex: 1, minWidth: 0, gap: 2 },
  panelTitle: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  panelSubtitle: { fontSize: t.micro, color: c.mutedForeground },
  list: { paddingHorizontal: space.lg },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowUnread: { backgroundColor: c.accentSubtle },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  rowMessage: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  rowTime: { fontSize: t.micro, color: c.mutedForeground, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.accent, marginTop: 6 },
}));

export default NotificationBell;
