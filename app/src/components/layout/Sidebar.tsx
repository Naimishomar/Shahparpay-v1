import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Pressable } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { RETAILER_MENU_ITEMS, ADMIN_MENU_ITEMS, DISTRIBUTOR_MENU_ITEMS, MenuEntry } from '@/constants';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

const MenuItemRow: React.FC<{
  item: MenuEntry;
  isActive: boolean;
  onNavigate: (route: string) => void;
}> = ({ item, isActive, onNavigate }) => (
  <TouchableOpacity
    style={[styles.menuItem, isActive && styles.menuItemActive]}
    onPress={() => onNavigate(item.route)}
    activeOpacity={0.7}
  >
    <MaterialCommunityIcons
      name={item.icon as any}
      size={22}
      color={isActive ? colors.sidebarPrimary : colors.mutedForeground}
      style={styles.icon}
    />
    <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.name}</Text>
  </TouchableOpacity>
);

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, activeRoute, onNavigate, onLogout }) => {
  const { user } = useAuth();

  const menuItems =
    user?.role === 'admin' ? ADMIN_MENU_ITEMS
    : user?.role === 'distributor' ? DISTRIBUTOR_MENU_ITEMS
    : RETAILER_MENU_ITEMS;

  if (!isOpen) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={styles.sidebar}>
        <View style={styles.header}>
          <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.menuContent}>
            {menuItems.map((item) => (
              <MenuItemRow
                key={item.route}
                item={item}
                isActive={activeRoute === item.route}
                onNavigate={onNavigate}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerItem} onPress={onLogout}>
            <MaterialCommunityIcons name="logout" size={22} color={colors.destructive} style={styles.icon} />
            <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = themed((c) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    overflow: 'hidden',
    backgroundColor: c.sidebar,
    borderRightWidth: 1,
    borderRightColor: c.sidebarBorder,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.sidebarBorder,
    paddingHorizontal: 20,
  },
  logo: {
    width: 140,
    height: 50,
  },
  menuContainer: {
    flex: 1,
    minHeight: 0, // see MainLayout: react-native-web flex-shrink fix
  },
  menuContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: c.sidebarAccent,
  },
  icon: {
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.sidebarForeground,
    flex: 1,
  },
  menuTextActive: {
    color: c.sidebarPrimary,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: c.sidebarBorder,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  logoutText: {
    color: c.destructive,
  },
}));

export default Sidebar;
