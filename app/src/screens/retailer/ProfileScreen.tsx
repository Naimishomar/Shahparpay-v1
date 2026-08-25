import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export const ProfileScreen: React.FC = () => {
  const { user } = useAuth();

  const menuItems = [
    { name: 'My Profile', icon: 'account', route: 'ProfileDetail' },
    { name: 'Bank Accounts', icon: 'bank', route: 'BankAccounts' },
    { name: 'Beneficiaries', icon: 'account-group', route: 'Beneficiaries' },
    { name: 'Transaction Limits', icon: 'shield', route: 'Limits' },
    { name: 'Notifications', icon: 'bell', route: 'Notifications' },
    { name: 'Security', icon: 'lock', route: 'Security' },
    { name: 'Help & Support', icon: 'help-circle', route: 'Help' },
    { name: 'Settings', icon: 'cog', route: 'Settings' },
  ];

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <Text style={styles.userRole}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Retailer'} Portal</Text>
        <View style={styles.userId}>
          <Text style={styles.userIdLabel}>User ID</Text>
          <Text style={styles.userIdValue}>{user?.code || user?.id || 'N/A'}</Text>
        </View>
      </View>

      <Card style={styles.menuCard}>
        <CardContent>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} activeOpacity={0.8}>
              <View style={styles.menuIcon}>
                <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.primary} />
              </View>
              <Text style={styles.menuText}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </CardContent>
      </Card>

      <Card style={styles.walletCard}>
        <CardHeader>
          <CardTitle>Wallet Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.walletGrid}>
            <View style={styles.walletItem}>
              <View style={[styles.walletIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="wallet" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.walletLabel}>AEPS Wallet</Text>
                <Text style={styles.walletAmount}>₹ 0.00</Text>
              </View>
            </View>
            <View style={styles.walletItem}>
              <View style={[styles.walletIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="wallet" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.walletLabel}>Main Wallet</Text>
                <Text style={styles.walletAmount}>₹ 0.00</Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      <Button variant="destructive" style={styles.logoutButton} fullWidth>
        <Ionicons name="log-out" size={20} color="white" />
        Logout
      </Button>
    </ScrollView>
  );
};

const styles = themed((c) => ({
  scrollView: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  profileHeader: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: 'white' },
  userName: { fontSize: 22, fontWeight: '700', color: c.foreground },
  userRole: { fontSize: 14, color: c.mutedForeground },
  userId: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.secondary },
  userIdLabel: { fontSize: 11, color: c.mutedForeground },
  userIdValue: { fontSize: 12, fontWeight: '600', color: c.foreground, fontFamily: 'monospace' },
  menuCard: { marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  menuIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' },
  menuText: { fontSize: 14, fontWeight: '500', color: c.foreground, flex: 1 },
  walletCard: { marginTop: 8 },
  walletGrid: { flexDirection: 'row', gap: 12 },
  walletItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: c.secondary },
  walletIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  walletLabel: { fontSize: 11, color: c.mutedForeground },
  walletAmount: { fontSize: 16, fontWeight: '700', color: c.foreground },
  logoutButton: { marginTop: 8 },
}));

import { TouchableOpacity } from 'react-native';
export default ProfileScreen;