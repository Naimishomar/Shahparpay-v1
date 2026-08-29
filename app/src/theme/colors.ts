import { StyleSheet } from 'react-native';

/**
 * Design system: "Trust & Authority" — Minimalism/Swiss for a fintech retailer
 * app, in a monochrome key. Near-black is the brand: it carries every primary
 * action and selected state, and inverts to near-white in dark mode so the
 * accent always reads against its own ground.
 *
 * Status colours (success/warning/danger/info) stay chromatic on purpose —
 * they encode meaning, not brand — and each is paired with its own icon at the
 * call site so nothing rests on hue alone.
 *
 * Both themes are authored together so contrast is checked per mode rather
 * than inferred by inverting one palette.
 */
const brand = {
  /** Light-mode brand. Off-black rather than #000: pure black on white edges
   *  into halation on OLED and reads harsher than it needs to. */
  ink: '#111113',
  inkSoft: '#26262B',
  /** Dark-mode brand — the same role, inverted. */
  chalk: '#FAFAFA',
  chalkSoft: '#D6D6DB',
};

export const palettes = {
  light: {
    // Neutral grey, not blue-grey, so an elevated white card reads as lifted
    // without tinting the whole page cool.
    background: '#F5F5F6',
    foreground: '#0A0A0B',
    card: '#FFFFFF',
    cardForeground: '#0A0A0B',
    // Elevated surface for sheets/menus that must separate from `card`.
    surface: '#FFFFFF',
    surfaceAlt: '#E9E9EC',
    popover: '#FFFFFF',
    popoverForeground: '#0A0A0B',

    primary: brand.ink,
    primaryForeground: '#FFFFFF',
    accent: brand.ink,
    accentForeground: '#FFFFFF',

    // The app header band. Separate from `accent` because accent inverts to
    // near-white in dark mode — correct for a button, glare as a full-width
    // band. In dark the band is an elevated surface instead of an inversion.
    band: brand.ink,
    bandForeground: '#FFFFFF',

    secondary: '#F0F0F2',
    secondaryForeground: '#0A0A0B',
    muted: '#F0F0F2',
    // 5.1:1 on #F5F5F6 — passes AA for body text, not just large text.
    mutedForeground: '#5C5C66',
    accentSubtle: 'rgba(17, 17, 19, 0.07)',

    success: '#047857',
    successSubtle: 'rgba(4, 120, 87, 0.12)',
    warning: '#B45309',
    warningSubtle: 'rgba(180, 83, 9, 0.12)',
    destructive: '#DC2626',
    destructiveSubtle: 'rgba(220, 38, 38, 0.10)',
    info: '#1D4ED8',
    infoSubtle: 'rgba(29, 78, 216, 0.10)',

    border: '#E2E2E6',
    borderStrong: '#C7C7CE',
    input: '#E2E2E6',
    ring: brand.ink,
    overlay: 'rgba(10, 10, 11, 0.55)',
    skeleton: '#E6E6EA',

    tabBar: '#FFFFFF',
    tabBarActive: brand.ink,
    tabBarInactive: '#8A8A94',
  },
  dark: {
    // Dark mode separates by lightening the surface, never by shadow — a
    // shadow is invisible on a dark ground.
    background: '#08080A',
    foreground: '#FAFAFA',
    card: '#141417',
    cardForeground: '#FAFAFA',
    surface: '#1B1B1F',
    surfaceAlt: '#242429',
    popover: '#161619',
    popoverForeground: '#FAFAFA',

    // The brand inverts: near-white now carries primary actions, because
    // near-black on near-black would be invisible.
    primary: brand.chalk,
    primaryForeground: '#0A0A0B',
    accent: brand.chalk,
    accentForeground: '#0A0A0B',

    // Above surfaceAlt: dark mode separates by lightening, and the band is the
    // topmost chrome. At #16161A it was the same tone as `card`, leaving the
    // header indistinguishable from the cards scrolling under it.
    band: '#2A2A31',
    bandForeground: brand.chalk,

    secondary: '#212126',
    secondaryForeground: '#FAFAFA',
    muted: '#212126',
    // 8.2:1 on #08080A — normal text needs 4.5:1 in dark mode too.
    mutedForeground: '#A1A1AC',
    accentSubtle: 'rgba(250, 250, 250, 0.10)',

    success: '#34D399',
    successSubtle: 'rgba(52, 211, 153, 0.16)',
    warning: '#FBBF24',
    warningSubtle: 'rgba(251, 191, 36, 0.16)',
    destructive: '#F87171',
    destructiveSubtle: 'rgba(248, 113, 113, 0.16)',
    info: '#60A5FA',
    infoSubtle: 'rgba(96, 165, 250, 0.16)',

    border: '#2A2A31',
    borderStrong: '#3B3B44',
    input: '#2A2A31',
    ring: brand.chalk,
    overlay: 'rgba(0, 0, 0, 0.72)',
    skeleton: '#1F1F24',

    tabBar: '#101013',
    tabBarActive: brand.chalk,
    tabBarInactive: '#8A8A94',
  },
};

/**
 * One elevation ladder for the whole app. Levels map to meaning, not to taste:
 * 0 flush, 1 card, 2 raised/pressable, 3 menu, 4 sheet.
 *
 * Android reads only `elevation`; iOS reads only the shadow triple. Both are
 * set per level so a surface sits at the same visual height on either
 * platform. Dark mode overrides these to `none` at the call site — a drop
 * shadow on a near-black ground just muddies the edge.
 */
export const elevation = {
  none: {},
  sm: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 8,
  },
  xl: {
    shadowColor: '#0A0A0B',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
} as const;

/**
 * Motion tokens. Durations follow the distance travelled: a press reacts
 * instantly, a sheet has further to go. Exit is ~70% of enter so dismissing
 * never feels sluggish.
 */
export const motion = {
  instant: 90,
  fast: 160,
  normal: 220,
  slow: 300,
  exit: 150,
} as const;

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

export type ElevationLevel = keyof typeof elevation;

/**
 * Elevation for the current theme. Dark mode gets nothing: a black drop shadow
 * on a near-black background reads as a smudge, so those surfaces separate by
 * their own lighter fill instead.
 */
export const lift = (level: ElevationLevel, isDark: boolean) =>
  isDark ? elevation.none : elevation[level];

/**
 * Theme-aware StyleSheet: built once per theme, resolved on property access.
 * The factory also receives `isDark` so shadows and other mode-specific
 * treatments are decided per palette rather than guessed at the call site.
 */
export function themed<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (c: Palette, isDark: boolean) => T & StyleSheet.NamedStyles<any>,
): T {
  const sheets = {
    light: StyleSheet.create(factory(palettes.light, false)),
    dark: StyleSheet.create(factory(palettes.dark, true)),
  };
  return new Proxy({} as T, {
    get: (_t, key: string) => (sheets[active] as any)[key],
  }) as T;
}
