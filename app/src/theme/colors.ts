import { StyleSheet } from 'react-native';

export const palettes = {
  light: {
    background: '#FAFAFA',
    foreground: '#171717',
    card: '#FFFFFF',
    cardForeground: '#171717',
    popover: '#FFFFFF',
    popoverForeground: '#171717',
    primary: '#171717',
    primaryForeground: '#FAFAFA',
    secondary: '#F5F5F5',
    secondaryForeground: '#171717',
    muted: '#F5F5F5',
    mutedForeground: '#737373',
    accent: '#F5F5F5',
    accentForeground: '#171717',
    destructive: '#EF4444',
    border: '#E5E5E5',
    input: '#E5E5E5',
    ring: '#171717',
    sidebar: '#FAFAFA',
    sidebarForeground: '#171717',
    sidebarPrimary: '#171717',
    sidebarPrimaryForeground: '#FAFAFA',
    sidebarAccent: '#F5F5F5',
    sidebarAccentForeground: '#171717',
    sidebarBorder: '#E5E5E5',
    sidebarRing: '#171717',
    primaryTintBg: 'rgba(23, 23, 23, 0.08)',
    primaryTintBorder: 'rgba(23, 23, 23, 0.16)',
  },
  dark: {
    background: '#050505',
    foreground: '#FAFAFA',
    card: '#0A0A0A',
    cardForeground: '#FAFAFA',
    popover: '#0A0A0A',
    popoverForeground: '#FAFAFA',
    primary: '#FAFAFA',
    primaryForeground: '#171717',
    secondary: '#1F1F1F',
    secondaryForeground: '#FAFAFA',
    muted: '#1F1F1F',
    mutedForeground: '#A3A3A3',
    accent: '#1F1F1F',
    accentForeground: '#FAFAFA',
    destructive: '#EF4444',
    border: '#262626',
    input: '#262626',
    ring: '#CCCCCC',
    sidebar: '#050505',
    sidebarForeground: '#FAFAFA',
    sidebarPrimary: '#FAFAFA',
    sidebarPrimaryForeground: '#171717',
    sidebarAccent: '#1F1F1F',
    sidebarAccentForeground: '#FAFAFA',
    sidebarBorder: '#262626',
    sidebarRing: '#CCCCCC',
    primaryTintBg: 'rgba(250, 250, 250, 0.10)',
    primaryTintBorder: 'rgba(250, 250, 250, 0.20)',
  },
};

export type Palette = typeof palettes.light;
export type ThemeName = keyof typeof palettes;

let active: ThemeName = 'light';

/** Called by ThemeProvider during render, before children read colors. */
export const setActivePalette = (name: ThemeName) => {
  active = name;
};

// ponytail: proxies so module-level StyleSheets stay static while still tracking
// the active theme. Components re-render via ThemeContext and re-read through
// the proxy. Swap for per-component useMemo styles only if profiling says so.
export const colors = new Proxy({} as Palette, {
  get: (_t, key: string) => palettes[active][key as keyof Palette],
}) as Palette;

/** Theme-aware StyleSheet: built once per theme, resolved on property access. */
export function themed<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (c: Palette) => T & StyleSheet.NamedStyles<any>,
): T {
  const sheets = {
    light: StyleSheet.create(factory(palettes.light)),
    dark: StyleSheet.create(factory(palettes.dark)),
  };
  return new Proxy({} as T, {
    get: (_t, key: string) => (sheets[active] as any)[key],
  }) as T;
}
