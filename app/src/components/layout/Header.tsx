import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { WalletBalances } from '@/types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Home shows the wallet strip; inner screens keep the bar to one line. */
  showWallets?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack,
  onBack,
  showWallets,
}) => {
  const { user, token } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [balances, setBalances] = useState<WalletBalances>({
    aepsBalance: 0,
    mainBalance: 0,
    adminBalance: 0,
  });

  const fetchBalances = useCallback(async () => {
    if (!user || !token || !showWallets) return;
    try {
      const res = await api.getWalletBalance();
      if (res?.success && res.data) setBalances((prev) => ({ ...prev, ...res.data }));
    } catch {
      // A transient balance failure must not blank the header.
    }
  }, [user, token, showWallets]);

  useEffect(() => {
    fetchBalances();
    if (!showWallets) return;
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [fetchBalances, showWallets]);

  const wallets =
    user?.role === 'admin'
      ? [{ label: 'Admin', amount: balances.adminBalance, icon: 'shield-account' }]
      : [
          { label: 'AEPS', amount: balances.aepsBalance, icon: 'fingerprint' },
          { label: 'Main', amount: balances.mainBalance, icon: 'wallet' },
        ];

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {showBack && (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Shahparpay'}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <Pressable
          onPress={toggleTheme}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          hitSlop={8}
        >
          <Ionicons
            name={resolvedTheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={21}
            color={colors.foreground}
          />
        </Pressable>

        <View style={styles.avatar} accessibilityLabel={user?.name || 'Account'}>
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          )}
        </View>
      </View>

      {showWallets && !!user && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.walletStrip}
        >
          {wallets.map((w) => (
            <View key={w.label} style={styles.walletChip}>
              <MaterialCommunityIcons name={w.icon as any} size={15} color={colors.accent} />
              <Text style={styles.walletLabel}>{w.label}</Text>
              <Text style={styles.walletAmount} numberOfLines={1}>
                ₹{Number(w.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themed((c) => ({
  header: {
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    gap: space.sm,
    zIndex: 50,
  },
  row: {
    minHeight: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  titleBlock: { flex: 1, minWidth: 0, paddingLeft: space.xs },
  title: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  subtitle: { fontSize: t.caption, color: c.mutedForeground, marginTop: 1 },
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
  walletStrip: { flexDirection: 'row', gap: space.sm, paddingRight: space.xs },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  walletLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  walletAmount: { fontSize: t.small, fontWeight: '700', color: c.foreground },
}));

export default Header;
