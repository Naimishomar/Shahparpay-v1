import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { WalletBalances } from '@/types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  /** Avatar opens Account — it replaced the bottom bar's Account tab. */
  onAccount?: () => void;
  /** Safe-area top inset, applied as the header's own padding. */
  topInset?: number;
  /**
   * Render on the brand band. Only Home does: its screen opens with a band of
   * the same ink, so the two read as one block. Everywhere else the band was a
   * black slab pinned above a white page, which is why this is opt-in.
   */
  onBand?: boolean;
}

const money = (value?: number) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Where the popover is pinned, measured from the button that opened it. */
interface Anchor {
  top: number;
  left: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onAccount,
  topInset = 0,
  onBand = false,
}) => {
  const { user, token } = useAuth();
  const [balances, setBalances] = useState<WalletBalances>({
    aepsBalance: 0,
    mainBalance: 0,
    adminBalance: 0,
  });
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [loading, setLoading] = useState(false);
  const menuButton = useRef<View>(null);

  const loadBalances = useCallback(async () => {
    if (!user || !token) return;
    try {
      const res = await api.getWalletBalance();
      if (res?.success && res.data) setBalances((prev) => ({ ...prev, ...res.data }));
    } catch {
      // A transient balance failure must not blank the header.
    }
  }, [user, token]);

  const wallets =
    user?.role === 'admin'
      ? [{ label: 'Admin wallet', amount: balances.adminBalance, icon: 'shield-account' }]
      : [
          { label: 'AEPS wallet', amount: balances.aepsBalance, icon: 'fingerprint' },
          { label: 'Main wallet', amount: balances.mainBalance, icon: 'wallet' },
        ];

  const openMenu = () => {
    // Measured on press rather than assumed: the header's offset changes with
    // the safe-area inset and whether the back button is showing.
    menuButton.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ top: y + height + space.xs, left: x });
    });
    setLoading(true);
    loadBalances().finally(() => setLoading(false));
  };

  // The inset is the header's own top padding rather than a spacer view above
  // it: two stacked paddings pushed the title a visible step further down than
  // the safe area actually requires.
  return (
    <View style={[styles.header, onBand ? styles.headerBand : styles.headerPlain, { paddingTop: topInset }]}>
      <View style={styles.row}>
        {/* Balance peek, reachable from every screen so checking a wallet never
            means navigating back to Home. */}
        <Pressable
          ref={menuButton}
          onPress={openMenu}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Show wallet balances"
          accessibilityState={{ expanded: !!anchor }}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="menu"
            size={22}
            color={onBand ? colors.bandForeground : colors.foreground}
          />
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={[styles.title, onBand && styles.titleOnBand]} numberOfLines={1}>
            {title || 'Shahparpay'}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, onBand && styles.subtitleOnBand]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <Pressable
          onPress={onAccount}
          disabled={!onAccount}
          style={({ pressed }) => [styles.avatar, onBand && styles.avatarOnBand, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={user?.name ? `Account — ${user.name}` : 'Account'}
          hitSlop={8}
        >
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitial, onBand && styles.avatarInitialOnBand]}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={!!anchor}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAnchor(null)}
      >
        {/* Tapping anywhere outside closes it — the popover has no other
            dismiss affordance, so this backdrop covers the whole screen. */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setAnchor(null)}
          accessibilityRole="button"
          accessibilityLabel="Close wallet balances"
        >
          <View
            style={[styles.popover, { top: anchor?.top ?? 0, left: anchor?.left ?? 0 }]}
            // Stops a tap on the panel itself from closing it.
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverTitle}>Wallet balances</Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Pressable
                  onPress={openMenu}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh balances"
                >
                  <MaterialCommunityIcons name="refresh" size={17} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {wallets.map((w, index) => (
              <View
                key={w.label}
                style={[styles.popoverRow, index === wallets.length - 1 && styles.popoverRowLast]}
              >
                <MaterialCommunityIcons name={w.icon as any} size={17} color={colors.accent} />
                <Text style={styles.popoverLabel} numberOfLines={1}>
                  {w.label}
                </Text>
                <Text style={styles.popoverAmount} numberOfLines={1}>
                  {money(w.amount)}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = themed((c) => ({
  header: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    zIndex: 50,
  },
  /** Default chrome: the page's own ground with a hairline under it. */
  headerPlain: {
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  /** Home only. No bottom border — the screen's band continues this ink, and a
   *  rule between them would draw a seam through one continuous block. */
  headerBand: { backgroundColor: c.band },
  row: {
    // 44 rather than 48: the controls inside are 40pt with hitSlop, so the tap
    // targets still clear the minimum while the bar sits tighter to the top.
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  titleBlock: { flex: 1, minWidth: 0, paddingLeft: space.xs },
  title: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  titleOnBand: { color: c.bandForeground },
  subtitle: { fontSize: t.caption, color: c.mutedForeground, marginTop: 1 },
  subtitleOnBand: { color: c.bandForeground, opacity: 0.75 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSubtle,
    borderWidth: 1,
    borderColor: c.accent,
    overflow: 'hidden',
  },
  avatarImage: { width: 36, height: 36 },
  avatarInitial: { fontSize: t.small, fontWeight: '700', color: c.accent },
  avatarOnBand: { backgroundColor: 'rgba(127,127,127,0.28)', borderColor: 'transparent' },
  avatarInitialOnBand: { color: c.bandForeground },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
  popover: {
    position: 'absolute',
    minWidth: 232,
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
    borderRadius: radius.lg,
    backgroundColor: c.popover,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  popoverHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingTop: space.sm,
  },
  popoverTitle: { fontSize: t.caption, fontWeight: '700', color: c.mutedForeground },
  popoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  popoverRowLast: { borderBottomWidth: 0 },
  popoverLabel: { flex: 1, fontSize: t.small, color: c.foreground },
  popoverAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default Header;
