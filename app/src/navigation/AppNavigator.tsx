import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
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

const RetailerStack = createStackNavigator();
const AdminStack = createStackNavigator();
const DistributorStack = createStackNavigator();
const AuthStack = createStackNavigator();

const RetailerNavigator = () => (
  <RetailerStack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      cardStyle: { backgroundColor: 'var(--background)' },
    }}
  >
    <RetailerStack.Screen name="Dashboard" component={DashboardScreen} />
    <RetailerStack.Screen name="AEPS" component={AepsScreen} />
    <RetailerStack.Screen name="AepsSettlement" component={AepsSettlementScreen} />
    <RetailerStack.Screen name="PAN" component={PanCardScreen} />
    <RetailerStack.Screen name="LeadGeneration" component={LeadGenerationScreen} />
    <RetailerStack.Screen name="ITR" component={ItrScreen} />
    <RetailerStack.Screen name="UPIPayments" component={UpiPaymentsScreen} />
    <RetailerStack.Screen name="DMT" component={DmtScreen} />
    <RetailerStack.Screen name="Recharge" component={RechargeScreen} />
    <RetailerStack.Screen name="BBPS" component={BbpsScreen} />
    <RetailerStack.Screen name="WalletTransfer" component={WalletTransferScreen} />
    <RetailerStack.Screen name="DirectPayout" component={DirectPayoutScreen} />
    <RetailerStack.Screen name="FundRequest" component={FundRequestScreen} />
    <RetailerStack.Screen name="BiometricSupport" component={BiometricSupportScreen} />
    <RetailerStack.Screen name="PipeStatus" component={PipeStatusScreen} />
    <RetailerStack.Screen name="Profile" component={ProfileScreen} />
    <RetailerStack.Screen name="KycStatus" component={KycStatusScreen} />
  </RetailerStack.Navigator>
);

const AdminNavigator = () => (
  <AdminStack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      cardStyle: { backgroundColor: 'var(--background)' },
    }}
  >
    <AdminStack.Screen name="AdminPortal" component={AdminPortalScreen} />
  </AdminStack.Navigator>
);

const DistributorNavigator = () => (
  <DistributorStack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      cardStyle: { backgroundColor: 'var(--background)' },
    }}
  >
    <DistributorStack.Screen name="DistributorPortal" component={DistributorPortalScreen} />
  </DistributorStack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: false,
      cardStyle: { backgroundColor: 'var(--background)' },
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Landing" component={LandingScreen} />
  </AuthStack.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user, token, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (!token) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  const getUserNavigator = () => {
    switch (user?.role) {
      case 'admin':
        return AdminNavigator;
      case 'distributor':
        return DistributorNavigator;
      default:
        return RetailerNavigator;
    }
  };

  const UserNavigator = getUserNavigator();

  return (
    <NavigationContainer>
      <UserNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;