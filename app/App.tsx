import React, { useCallback } from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Figtree_300Light } from '@expo-google-fonts/figtree/300Light';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import { useKycCallback } from '@/hooks/useKycCallback';
import { palettes } from '@/theme/colors';
import { applyAppFont } from '@/theme/fonts';

// Must run before the first <Text> mounts, so it sits at module scope rather
// than in an effect.
applyAppFont();

// Held until the typeface is ready; swapping the font after first paint would
// reflow every screen in front of the user.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (fast refresh) — nothing to hold.
});

const AppContent: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const palette = palettes[resolvedTheme];
  // Catches the PaySprint web-KYC redirect back into the app.
  useKycCallback();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <AppNavigator />
    </GestureHandlerRootView>
  );
};

const App: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A font that fails to load must not leave the user on the splash forever,
  // but it must not fail silently either — the app then renders in whatever
  // face the handset defaults to, which is exactly what this exists to avoid.
  if (fontError) {
    console.warn(
      '[fonts] Figtree failed to load; falling back to the system face.',
      fontError
    );
  }
  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onReady}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
};

export default App;
