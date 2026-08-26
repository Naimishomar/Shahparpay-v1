import React, { useCallback } from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
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
        backgroundColor={palette.background}
      />
      <AppNavigator />
    </GestureHandlerRootView>
  );
};

const App: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A font that fails to load must not leave the user on the splash forever,
  // but it must not fail silently either — the app then renders in whatever
  // face the handset defaults to, which is exactly what this exists to avoid.
  if (fontError) {
    console.warn(
      '[fonts] IBM Plex Sans failed to load; falling back to the system face.',
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
