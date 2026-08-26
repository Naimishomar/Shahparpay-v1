import { StyleSheet } from 'react-native';

/**
 * Design system: "Trust & Authority" — Minimalism/Swiss for a fintech retailer
 * app. Navy surfaces carry the trust signal, gold is the single brand accent,
 * and every functional colour (success/warn/danger) is paired with an icon or
 * label at the call site so meaning never rests on hue alone.
 *
 * Both themes are authored together so contrast is checked per mode rather
 * than inferred by inverting one palette.
 */
const brand = {
  gold: '#F59E0B',
  goldSoft: '#FBBF24',
  navy: '#0F172A',
};

export const palettes = {
  light: {
    background: '#F6F7F9',
    foreground: '#0F172A',
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    // Elevated surface for sheets/menus that must separate from `card`.
    surface: '#FFFFFF',
    surfaceAlt: '#EEF1F5',
    popover: '#FFFFFF',
    popoverForeground: '#0F172A',

    primary: brand.navy,
    primaryForeground: '#FFFFFF',
    accent: brand.gold,
    accentForeground: '#3D2600',

    secondary: '#EEF1F5',
    secondaryForeground: '#0F172A',
    muted: '#EEF1F5',
    // 4.6:1 on #F6F7F9 — passes AA for body text, not just large text.
    mutedForeground: '#5A6577',
    accentSubtle: 'rgba(245, 158, 11, 0.12)',

    success: '#047857',
    successSubtle: 'rgba(4, 120, 87, 0.12)',
    warning: '#B45309',
    warningSubtle: 'rgba(180, 83, 9, 0.12)',
    destructive: '#DC2626',
    destructiveSubtle: 'rgba(220, 38, 38, 0.10)',
    info: '#1D4ED8',
    infoSubtle: 'rgba(29, 78, 216, 0.10)',

    border: '#DDE3EA',
    borderStrong: '#C4CDD8',
    input: '#DDE3EA',
    ring: brand.gold,
    overlay: 'rgba(15, 23, 42, 0.55)',
    skeleton: '#E4E9EF',

    tabBar: '#FFFFFF',
    tabBarActive: brand.navy,
    tabBarInactive: '#5A6577',
  },
  dark: {
    background: '#0B1220',
    foreground: '#F8FAFC',
    card: '#151D2C',
    cardForeground: '#F8FAFC',
    surface: '#1B2434',
    surfaceAlt: '#222B3D',
    popover: '#151D2C',
    popoverForeground: '#F8FAFC',

    primary: brand.gold,
    primaryForeground: '#231400',
    accent: brand.gold,
    accentForeground: '#231400',

    secondary: '#222B3D',
    secondaryForeground: '#F8FAFC',
    muted: '#222B3D',
    // 7.1:1 on #0B1220 — normal text needs 4.5:1 in dark mode too.
    mutedForeground: '#A9B4C6',
    accentSubtle: 'rgba(245, 158, 11, 0.16)',

    success: '#34D399',
    successSubtle: 'rgba(52, 211, 153, 0.16)',
    warning: '#FBBF24',
    warningSubtle: 'rgba(251, 191, 36, 0.16)',
    destructive: '#F87171',
    destructiveSubtle: 'rgba(248, 113, 113, 0.16)',
    info: '#60A5FA',
    infoSubtle: 'rgba(96, 165, 250, 0.16)',

    border: '#2A3547',
    borderStrong: '#3A4759',
    input: '#2A3547',
    ring: brand.gold,
    overlay: 'rgba(3, 7, 18, 0.7)',
    skeleton: '#1E2739',

    tabBar: '#0F1727',
    tabBarActive: brand.gold,
    tabBarInactive: '#8494AB',
  },
};

/** 4pt rhythm. Every gap/padding in the app comes from here. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

/** Modular type scale: 11 12 13 15 17 20 24 30. */
export const type = {
  micro: 11,
  caption: 12,
  small: 13,
  body: 15,
  bodyLg: 17,
  title: 20,
  h2: 24,
  h1: 30,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

/** Minimum tap target. iOS 44pt / Android 48dp — take the larger. */
export const TOUCH = 48;

export type Palette = typeof palettes.light;
export type ThemeName = keyof typeof palettes;

let active: ThemeName = 'light';

/** Called by ThemeProvider during render, before children read colors. */
export const setActivePalette = (name: ThemeName) => {
  active = name;
};

export const getActivePalette = () => active;

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
