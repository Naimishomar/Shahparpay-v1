import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { setActivePalette } from '@/theme/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Dark is the design, not a preference: the UI is drawn for a black ground.
  // A stored choice still wins, so the Account toggle keeps working.
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  const resolveTheme = useCallback((themeMode: ThemeMode): 'light' | 'dark' => {
    if (themeMode === 'system') {
      return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) {
          const parsedTheme = storedTheme as ThemeMode;
          setThemeState(parsedTheme);
          setResolvedTheme(resolveTheme(parsedTheme));
        } else {
          setResolvedTheme('dark');
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        setResolvedTheme('dark');
      } finally {
        setIsLoaded(true);
      }
    };

    loadTheme();
  }, [resolveTheme]);

  useEffect(() => {
    if (!isLoaded) return;

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === 'system') {
        setResolvedTheme(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });

    return () => subscription.remove();
  }, [theme, isLoaded]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Must run during render (not an effect) so styles read the right palette
  // on the very first paint.
  setActivePalette(resolvedTheme);

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};