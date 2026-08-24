import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
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
  const { user, token, isInitializing, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(route.name as string);

  useEffect(() => {
    setActiveRoute(route.name as string);
  }, [route.name]);

  useEffect(() => {
    if (!isInitializing && !token) {
      navigation.navigate('Login' as any);
    }
  }, [isInitializing, token, navigation]);

  const handleNavigate = (routeName: string) => {
    setActiveRoute(routeName);
    setSidebarOpen(false);
    navigation.navigate(routeName as any);
  };

  const handleLogout = async () => {
    await logout();
    navigation.navigate('Login' as any);
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContent}>
          <View style={styles.spinner} />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'var(--background)' }]}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={resolvedTheme === 'dark' ? '#000' : '#FAFAFA'}
      />

      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeRoute={activeRoute}
          onNavigate={handleNavigate}
        />
      )}

      <View style={styles.mainContent}>
        {showHeader && (
          <Header
            onMenuPress={() => setSidebarOpen(true)}
            title={route.name !== 'Dashboard' ? route.name as string : undefined}
          />
        )}

        <View style={styles.contentWrapper}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'var(--primary)',
    borderTopColor: 'transparent',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  contentWrapper: {
    flex: 1,
    padding: 16,
  },
});

export default MainLayout;