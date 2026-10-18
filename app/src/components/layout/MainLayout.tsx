import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, themed } from '../../theme/colors';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { TopGlow } from '../ui/TopGlow';
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

/** Route -> title, as the mockup names each screen. */
const TITLES: Record<string, string> = {
  Dashboard: 'Home',
  Services: 'Services',
  Reports: 'History',
  AEPS: 'Aadhaar banking',
  DMT: 'Money transfer',
  Recharge: 'Mobile recharge',
  BBPS: 'Pay bills',
  Collect: 'Collect payment',
  AddMoney: 'Add money',
  AepsSettlement: 'Withdraw',
  AdminPortal: 'Overview',
  DistributorPortal: 'Overview',
  DistributorRetailers: 'Retailers',
  Notifications: 'Notifications',
};

/** Screens that draw their own top row: Home, and Profile (a drawer). */
const BARE = new Set(['Dashboard', 'Profile']);

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

  // A screen opened for one item names itself through its params — the route
  // is BbpsService for every category, so the route name cannot say which.
  const fromParams = (route.params as any)?.title;
  const title =
    (fromParams ? String(fromParams) : null) ??
    TITLES[route.name] ??
    SERVICE_ITEMS.find((s) => s.route === route.name)?.name ??
    REPORT_ITEMS.find((r) => r.route === route.name)?.name ??
    tabs.find((tb) => tb.route === route.name)?.name ??
    // Last resort: split the PascalCase route so it never shows raw.
    route.name.replace(/([a-z])([A-Z])/g, '$1 $2');

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // AppNavigator swaps to the auth stack when the token goes away.
  if (!token) return null;

  const bare = BARE.has(route.name);
  // A flat tab destination: large title, no back arrow, and the bottom bar.
  const root = tabs.some((tb) => tb.route === route.name && !tb.raised);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      {/* BHIM's orange/green light behind the top of every screen. */}
      <TopGlow />

      {!bare && <Header root={root} topInset={insets.top} title={title} />}

      {/* minHeight 0: on react-native-web a flex child defaults to
          min-height:auto and grows past the viewport instead of letting the
          inner ScrollView scroll. No-op on native. */}
      <View style={[styles.content, bare && { paddingTop: insets.top }]}>{children}</View>

      {/* Only the flat tab destinations carry the bar (mockup 03, 05, 15, 16);
          a task screen keeps the whole height for its own form and button. */}
      {root && (
        <BottomTabBar
          tabs={tabs}
          activeRoute={route.name}
          onNavigate={(target) => {
            if (target === route.name) return;
            navigation.navigate(target);
          }}
        />
      )}
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
