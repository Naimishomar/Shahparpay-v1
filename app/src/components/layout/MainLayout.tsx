import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, themed } from '../../theme/colors';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import {
  RETAILER_TABS,
  ADMIN_TABS,
  DISTRIBUTOR_TABS,
  SERVICE_ITEMS,
  REPORT_ITEMS,
} from '@/constants';

interface MainLayoutProps {
  children: React.ReactNode;
}

/** Route -> human title, so the header never shows a PascalCase route name. */
const TITLES: Record<string, { title: string; subtitle?: string }> = {
  Dashboard: { title: 'Home' },
  Services: { title: 'Services', subtitle: 'Everything you can sell' },
  Reports: { title: 'Reports', subtitle: 'Transaction history' },
  AepsSettlement: { title: 'Settlement', subtitle: 'AEPS wallet to your bank' },
  AdminPortal: { title: 'Overview' },
  DistributorPortal: { title: 'Overview' },
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { token, isInitializing, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const tabs =
    user?.role === 'admin'
      ? ADMIN_TABS
      : user?.role === 'distributor'
        ? DISTRIBUTOR_TABS
        : RETAILER_TABS;

  // No back chevron anywhere: the bottom bar is always present, and the stack
  // sets gestureEnabled, so the Android back button and the iOS swipe-back
  // gesture still pop every screen. Nothing is unreachable without it.

  const named =
    TITLES[route.name] ??
    (() => {
      const service = SERVICE_ITEMS.find((s) => s.route === route.name);
      if (service) return { title: service.name, subtitle: service.hint };
      const report = REPORT_ITEMS.find((r) => r.route === route.name);
      if (report) return { title: report.name, subtitle: report.hint };
      // Tab destinations that are not in either catalogue (e.g. Wallet).
      const tab = tabs.find((tb) => tb.route === route.name);
      if (tab) return { title: tab.name };
      // Last resort: split the PascalCase route so it never shows raw.
      return { title: route.name.replace(/([a-z])([A-Z])/g, '$1 $2') };
    })();

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // AppNavigator swaps to the auth stack when the token goes away.
  if (!token) return null;

  // Home is the only screen that continues the header in its own ink; anywhere
  // else a black bar pinned above a white page just reads as a slab.
  const onBand = route.name === 'Dashboard';

  return (
    <View style={styles.container}>
      {/* Only Home wears the band, so only Home needs light status-bar content
          and an ink status-bar ground. */}
      <StatusBar
        barStyle={onBand ? 'light-content' : resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={onBand ? colors.band : colors.background}
      />

      <Header
        onBand={onBand}
        topInset={insets.top}
        title={named.title}
        subtitle={named.subtitle}
        onAccount={route.name === 'Profile' ? undefined : () => navigation.navigate('Profile')}
      />

      {/* minHeight 0: on react-native-web a flex child defaults to
          min-height:auto and grows past the viewport instead of letting the
          inner ScrollView scroll. No-op on native. */}
      <View style={styles.content}>{children}</View>

      <BottomTabBar
        tabs={tabs}
        activeRoute={route.name}
        onNavigate={(target) => {
          if (target === route.name) return;
          navigation.navigate(target);
        }}
      />
    </View>
  );
};

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { flex: 1, minHeight: 0 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
  },
}));

export default MainLayout;
