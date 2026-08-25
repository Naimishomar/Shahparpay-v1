import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { palettes } from '../theme/colors';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { LandingScreen } from '@/screens/auth/LandingScreen';
import { DashboardScreen } from '@/screens/retailer/DashboardScreen';
import { AepsScreen } from '@/screens/retailer/AepsScreen';
import { AepsSettlementScreen } from '@/screens/retailer/AepsSettlementScreen';
import { PanCardScreen } from '@/screens/retailer/PanCardScreen';
import { LeadGenerationScreen } from '@/screens/retailer/LeadGenerationScreen';
import { ItrScreen } from '@/screens/retailer/ItrScreen';
import { UpiPaymentsScreen } from '@/screens/retailer/UpiPaymentsScreen';
import { DmtScreen } from '@/screens/retailer/DmtScreen';
import { RechargeScreen } from '@/screens/retailer/RechargeScreen';
import { BbpsScreen } from '@/screens/retailer/BbpsScreen';
import { WalletTransferScreen } from '@/screens/retailer/WalletTransferScreen';
import { DirectPayoutScreen } from '@/screens/retailer/DirectPayoutScreen';
import { FundRequestScreen } from '@/screens/retailer/FundRequestScreen';
import { BiometricSupportScreen } from '@/screens/retailer/BiometricSupportScreen';
import { PipeStatusScreen } from '@/screens/retailer/PipeStatusScreen';
import { ProfileScreen } from '@/screens/retailer/ProfileScreen';
import { KycStatusScreen } from '@/screens/retailer/KycStatusScreen';
import { AdminPortalScreen } from '@/screens/admin/AdminPortalScreen';
import { DistributorPortalScreen } from '@/screens/distributor/DistributorPortalScreen';

const Stack = createStackNavigator();

// Every authenticated screen renders inside MainLayout (header + sidebar).
// Cached so the wrapper identity is stable and screens are not remounted.
const layoutCache = new Map<React.ComponentType<any>, React.ComponentType<any>>();
const withLayout = (Screen: React.ComponentType<any>) => {
  let wrapped = layoutCache.get(Screen);
  if (!wrapped) {
    wrapped = (props: any) => {
      // Subscribing here (not just in MainLayout) is what re-renders the screen
      // on a theme switch: react-navigation keeps the child element identity
      // stable, so the theme must be consumed by the screen component itself.
      useTheme();
      return (
        <MainLayout>
          <Screen {...props} />
        </MainLayout>
      );
    };
    wrapped.displayName = `WithLayout(${Screen.displayName || Screen.name || 'Screen'})`;
    layoutCache.set(Screen, wrapped);
  }
  return wrapped;
};

// Route names must match `route` in the sidebar menus (src/constants).
const RETAILER_SCREENS: [string, React.ComponentType<any>][] = [
  ['Dashboard', DashboardScreen],
  ['AEPS', AepsScreen],
  ['AepsSettlement', AepsSettlementScreen],
  ['PAN', PanCardScreen],
  ['LeadGeneration', LeadGenerationScreen],
  ['ITR', ItrScreen],
  ['UPIPayments', UpiPaymentsScreen],
  ['DMT', DmtScreen],
  ['Recharge', RechargeScreen],
  ['BBPS', BbpsScreen],
  ['WalletTransfer', WalletTransferScreen],
  ['DirectPayout', DirectPayoutScreen],
  ['FundRequest', FundRequestScreen],
  ['BiometricSupport', BiometricSupportScreen],
  ['PipeStatus', PipeStatusScreen],
  ['Profile', ProfileScreen],
  ['KycStatus', KycStatusScreen],
];

const ADMIN_SCREENS: [string, React.ComponentType<any>][] = [['AdminPortal', AdminPortalScreen]];
const DISTRIBUTOR_SCREENS: [string, React.ComponentType<any>][] = [
  ['DistributorPortal', DistributorPortalScreen],
];

const buildNavigator = (screens: [string, React.ComponentType<any>][], background: string) => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      // flex/overflow: on web @react-navigation/stack otherwise lets the card
      // grow past the viewport and hands scrolling to document.body, which
      // Expo's reset has set to overflow:hidden. No-op on native.
      cardStyle: { backgroundColor: background, flex: 1, overflow: 'hidden' },
    }}
  >
    {screens.map(([name, Screen]) => (
      <Stack.Screen key={name} name={name} component={withLayout(Screen)} />
    ))}
  </Stack.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user, token, isInitializing } = useAuth();
  const { resolvedTheme } = useTheme();
  const palette = palettes[resolvedTheme];

  const navTheme = {
    ...(resolvedTheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolvedTheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: palette.background,
      card: palette.card,
      text: palette.foreground,
      border: palette.border,
      primary: palette.primary,
    },
  };

  if (isInitializing) return null;

  const screens =
    !token ? null
    : user?.role === 'admin' ? ADMIN_SCREENS
    : user?.role === 'distributor' ? DISTRIBUTOR_SCREENS
    : RETAILER_SCREENS;

  return (
    <NavigationContainer theme={navTheme}>
      {screens ? (
        buildNavigator(screens, palette.background)
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            cardStyle: { backgroundColor: palette.background, flex: 1, overflow: 'hidden' },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Landing" component={LandingScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
