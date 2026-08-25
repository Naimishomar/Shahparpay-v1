import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '@/services/api';
import { WalletBalances } from '@/types';

interface HeaderProps {
  onMenuPress: () => void;
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuPress,
  title,
  showBackButton = false,
  onBackPress,
}) => {
  const { user, token } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [balances, setBalances] = useState<WalletBalances>({ aepsBalance: 0, mainBalance: 0, adminBalance: 0 });

  const fetchBalances = async () => {
    if (user && token) {
      try {
        const res = await api.getWalletBalance();
        if (res?.success && res.data) {
          setBalances(res.data);
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [user, token]);

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.leftSection}>
        {showBackButton ? (
          <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
            <Ionicons name="menu" size={26} color={colors.foreground} />
          </TouchableOpacity>
        )}
        {!!title && <Text style={styles.title}>{title}</Text>}
      </View>

      <View style={styles.rightSection}>
        {user && (
          <View style={styles.walletContainer}>
            {user.role === 'admin' ? (
              <WalletBalance
                label="Admin Wallet"
                amount={balances.adminBalance}
                iconColor={colors.primary}
                bgColor={colors.primaryTintBg}
                borderColor={colors.primaryTintBorder}
              />
            ) : (
              <>
                <WalletBalance
                  label="AEPS Wallet"
                  amount={balances.aepsBalance}
                  iconColor={colors.primary}
                  bgColor={colors.primaryTintBg}
                  borderColor={colors.primaryTintBorder}
                />
                <View style={styles.divider} />
                <WalletBalance
                  label="Main Wallet"
                  amount={balances.mainBalance}
                  iconColor="#10B981"
                  bgColor="rgba(16, 185, 129, 0.1)"
                  borderColor="rgba(16, 185, 129, 0.2)"
                />
              </>
            )}
          </View>
        )}

        <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
          {resolvedTheme === 'dark' ? (
            <Ionicons name="sunny" size={24} color={colors.foreground} />
          ) : (
            <Ionicons name="moon" size={24} color={colors.foreground} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileButton}>
          <View style={styles.avatarContainer}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={24} color={colors.foreground} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const WalletBalance: React.FC<{
  label: string;
  amount: number;
  iconColor: string;
  bgColor: string;
  borderColor: string;
}> = ({ label, amount, iconColor, bgColor, borderColor }) => (
  <View style={[styles.walletItem, { backgroundColor: bgColor, borderColor }]}>
    <View style={[styles.walletIcon, { backgroundColor: iconColor }]}>
      <Ionicons name="wallet" size={18} color="white" />
    </View>
    <View style={styles.walletInfo}>
      <Text style={styles.walletLabel}>{label}</Text>
      <Text style={styles.walletAmount}>₹ {Number(amount ?? 0).toFixed(2)}</Text>
    </View>
  </View>
);

const styles = themed((c) => ({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    position: 'relative',
    zIndex: 50,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: c.foreground,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletInfo: {
    flexDirection: 'column',
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: c.mutedForeground,
  },
  walletAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: c.foreground,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: c.border,
    marginHorizontal: 4,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.primary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
}));

export default Header;