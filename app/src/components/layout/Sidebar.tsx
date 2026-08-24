import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { cn } from '@/utils/cn';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { RETAILER_MENU_ITEMS, ADMIN_MENU_ITEMS, DISTRIBUTOR_MENU_ITEMS } from '@/constants';
import { MenuItem } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

interface MenuItemProps {
  item: MenuItem;
  activeRoute: string;
  onNavigate: (route: string) => void;
  level?: number;
  isSubItem?: boolean;
}

const MenuItemComponent: React.FC<MenuItemProps> = ({
  item,
  activeRoute,
  onNavigate,
  level = 0,
  isSubItem = false,
}) => {
  const { resolvedTheme } = useTheme();
  const isActive = activeRoute === item.url || activeRoute.startsWith(item.url + '/');
  const hasSubItems = item.subItems && item.subItems.length > 0;

  const IconComponent = getIconComponent(item.icon);

  if (hasSubItems && !isSubItem) {
    return (
      <View style={styles.collapsibleContainer}>
        <TouchableOpacity
          style={[
            styles.collapsibleTrigger,
            isActive && styles.collapsibleTriggerActive,
            { paddingLeft: 16 + level * 12 },
          ]}
          onPress={() => onNavigate(item.url)}
        >
          <View style={styles.collapsibleContent}>
            <IconComponent
              name={item.icon}
              size={22}
              color={isActive ? 'var(--primary)' : 'var(--muted-foreground)'}
              style={styles.icon}
            />
            <Text
              style={[
                styles.menuText,
                isActive && styles.menuTextActive,
              ]}
            >
              {item.name}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={isActive ? 'var(--primary)' : 'var(--muted-foreground)'}
              style={[
                styles.chevron,
                isActive && styles.chevronActive,
              ]}
            />
          </View>
        </TouchableOpacity>
        <View style={{ paddingLeft: 28 + level * 12, borderLeftWidth: 1, borderLeftColor: 'var(--border)', marginLeft: 11 }}>
          {item.subItems?.map((subItem) => (
            <MenuItemComponent
              key={subItem.name}
              item={subItem}
              activeRoute={activeRoute}
              onNavigate={onNavigate}
              level={level + 1}
              isSubItem={true}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        isActive && styles.menuItemActive,
        isSubItem && styles.menuItemSub,
        { paddingLeft: 16 + level * 12 },
      ]}
      onPress={() => onNavigate(item.url)}
      activeOpacity={0.7}
    >
      <IconComponent
        name={item.icon}
        size={isSubItem ? 18 : 22}
        color={isActive ? 'var(--primary)' : 'var(--muted-foreground)'}
        style={styles.icon}
      />
      <Text
        style={[
          styles.menuText,
          isActive && styles.menuTextActive,
          isSubItem && styles.menuTextSub,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
};

function getIconComponent(iconName: string) {
  const iconMap: Record<string, React.ComponentType<any>> = {
    'layout-dashboard': Ionicons,
    'fingerprint': MaterialCommunityIcons,
    'landmark': MaterialCommunityIcons,
    'file-text': Ionicons,
    'user-plus': Ionicons,
    'wallet': Ionicons,
    'send': Ionicons,
    'zap': Ionicons,
    'bar-chart-3': Ionicons,
    'users': Ionicons,
    'store': MaterialCommunityIcons,
    'user-circle': Ionicons,
    'credit-card': MaterialCommunityIcons,
    'scan-face': MaterialCommunityIcons,
    'shield-check': MaterialCommunityIcons,
    'logout': Ionicons,
    'settings': Ionicons,
    'bell': Ionicons,
    'search': Ionicons,
    'sun': Ionicons,
    'moon': Ionicons,
    'menu': Ionicons,
    'chevron-right': MaterialCommunityIcons,
    'chevron-down': MaterialCommunityIcons,
    'home': Ionicons,
    'card': Ionicons,
    'bank': MaterialCommunityIcons,
    'receipt': Ionicons,
    'smartphone': Ionicons,
    'indian-rupee': MaterialCommunityIcons,
    'building-2': MaterialCommunityIcons,
  };

  return iconMap[iconName] || Ionicons;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeRoute,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();

  const menuItems = user?.role === 'admin'
    ? ADMIN_MENU_ITEMS
    : user?.role === 'distributor'
    ? DISTRIBUTOR_MENU_ITEMS
    : RETAILER_MENU_ITEMS;

  if (!isOpen) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} onTouchStart={onClose}>
      <View style={[styles.sidebar, { backgroundColor: 'var(--sidebar)' }]}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.menuContent}>
            {menuItems.map((item) => (
              <MenuItemComponent
                key={item.name}
                item={item}
                activeRoute={activeRoute}
                onNavigate={onNavigate}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerItem} onPress={() => onNavigate('/profile')}>
            <Ionicons name="person-outline" size={22} color="var(--muted-foreground)" style={styles.footerIcon} />
            <Text style={styles.footerText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerItem} onPress={() => { /* logout */ }}>
            <Ionicons name="log-out-outline" size={22} color="var(--destructive)" style={styles.footerIcon} />
            <Text style={[styles.footerText, { color: 'var(--destructive)' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    zIndex: 101,
    borderRightWidth: 1,
    borderRightColor: 'var(--border)',
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
    borderBottomColor: 'var(--border)',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 50,
  },
  menuContainer: {
    flex: 1,
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
    backgroundColor: 'var(--sidebar-accent)',
  },
  menuItemSub: {
    paddingVertical: 10,
  },
  icon: {
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'var(--sidebar-foreground)',
    flex: 1,
  },
  menuTextActive: {
    color: 'var(--sidebar-primary)',
    fontWeight: '600',
  },
  menuTextSub: {
    fontSize: 13,
  },
  collapsibleContainer: {},
  collapsibleTrigger: {
    borderRadius: 12,
  },
  collapsibleTriggerActive: {
    backgroundColor: 'var(--sidebar-accent)',
  },
  collapsibleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chevron: {
    transition: 'transform 0.2s',
  },
  chevronActive: {
    transform: [{ rotate: '90deg' }],
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'var(--border)',
    gap: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  footerIcon: {
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'var(--sidebar-foreground)',
  },
});

export default Sidebar;