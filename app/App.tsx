import React from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import { useTheme } from '@/context/ThemeContext';
import './global.css';

const AppContent: React.FC = () => {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    StatusBar.setBarStyle(resolvedTheme === 'dark' ? 'light-content' : 'dark-content');
    StatusBar.setBackgroundColor(resolvedTheme === 'dark' ? '#000' : '#FAFAFA');
  }, [resolvedTheme]);

  return (
    <View style={styles.container} className={resolvedTheme === 'dark' ? 'dark' : ''}>
      <AppNavigator />
    </View>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;