import React, { useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, themed } from '../../theme/colors';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useNavigation, useRoute } from '@react-navigation/native';

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showHeader?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  showSidebar = true,
  showHeader = true,
}) => {
  const { token, isInitializing, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (routeName: string) => {
    setSidebarOpen(false);
    navigation.navigate(routeName);
  };

  const handleLogout = async () => {
    setSidebarOpen(false);
    await logout();
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // AppNavigator swaps to the auth stack when the token goes away.
  if (!token) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.mainContent}>
        {showHeader && (
          <Header
            onMenuPress={() => setSidebarOpen(true)}
            title={route.name !== 'Dashboard' ? route.name : undefined}
          />
        )}

        <View style={styles.contentWrapper}>{children}</View>
      </View>

      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeRoute={route.name}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaView>
  );
};

const styles = themed((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
  },
  // minHeight/minWidth 0: on react-native-web a flex child defaults to
  // min-height:auto and grows past the viewport instead of letting the inner
  // ScrollView scroll. No-op on native.
  mainContent: {
    flex: 1,
    minHeight: 0,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
}));

export default MainLayout;
