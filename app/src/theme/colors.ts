import { StyleSheet } from 'react-native';

/**
 * Design system: BHIM 4 (NPCI's own system — Figtree, BHIM Orange, BHIM Green,
 * near-black greys). Dark is the reference; light mirrors it on white.
 *
 * - Ground is near-black, with a soft orange and green glow behind the top of
 *   each screen (TopGlow) — the only colour on most screens.
 * - Icons are monochrome line glyphs in grey circles. Colour is reserved for
 *   meaning: orange for the one primary action and the active tab, green for
 *   money in and success, red for failure.
 * - Cards are a step lighter than the ground with a hairline border.
 *
 * Status colours are always paired with an icon or label at the call site so
 * nothing rests on hue alone.
 */
const bhim = {
  orange: '#F47920', // O-500
  orangeDeep: '#E55C11', // O-600
  orangeSoft: '#F79440', // O-400
  green: '#028C45', // G-600
};

/** Icon chips: one neutral circle everywhere (BHIM's monochrome icon system).
 *  Kept as named tones so call sites can still say what a chip is for. */
const lightChip = { bg: '#F1F1F1', fg: '#171717' };
const darkChip = { bg: '#262626', fg: '#FFFFFF' };
const tonesOf = (chip: { bg: string; fg: string }) => ({
  blue: chip,
  orange: chip,
  green: chip,
  purple: chip,
  pink: chip,
  teal: chip,
  red: chip,
});
export type Tone = keyof ReturnType<typeof tonesOf>;

export const palettes = {
  light: {
    background: '#FAFAFA',
    foreground: '#171717',
    card: '#FFFFFF',
    cardForeground: '#171717',
    surface: '#F4F4F4',
    surfaceAlt: '#EFEFEF',
    popover: '#FFFFFF',
    popoverForeground: '#171717',

    primary: bhim.orangeDeep,
    primaryForeground: '#FFFFFF',
    // Orange text on white needs the deeper shade (O-700) to stay readable.
    accent: '#BE4510',
    accentForeground: '#FFFFFF',
    highlight: bhim.orange,
    highlightForeground: '#FFFFFF',

    band: '#FAFAFA',
    bandForeground: '#171717',

    secondary: '#F4F4F4',
    secondaryForeground: '#171717',
    muted: '#F4F4F4',
    mutedForeground: '#626262',
    accentSubtle: 'rgba(229, 92, 17, 0.08)',

    success: '#047239',
    successSubtle: 'rgba(4, 114, 57, 0.10)',
    warning: '#9B5C0D',
    warningSubtle: 'rgba(222, 165, 17, 0.14)',
    destructive: '#C11414',
    destructiveSubtle: 'rgba(193, 20, 20, 0.08)',
    info: '#353535',
    infoSubtle: 'rgba(0, 0, 0, 0.04)',

    border: '#E9E9E9',
    borderStrong: '#D2D2D2',
    input: '#E9E9E9',
    ring: '#171717',
    focus: '#171717',
    overlay: 'rgba(0, 0, 0, 0.45)',
    // Visibly darker than the filled fields (#F4F4F4) it often stands in for.
    skeleton: '#E4E4E4',

    activeGradient: [bhim.orange, bhim.orangeDeep],
    tileGradient: [lightChip.bg, lightChip.bg],
    tileForeground: lightChip.fg,
    tileRing: 'transparent',
    tones: tonesOf(lightChip),

    /** The two soft lights behind the top of every screen (TopGlow). */
    glowWarm: bhim.orange,
    glowGreen: '#12A65A',
    glowStrength: 0.14,

    chart: [bhim.orange, '#12A65A', '#626262', '#171717', '#E51D1D', '#DEA511'],

    tabBar: '#FFFFFF',
    tabBarActive: bhim.orangeDeep,
    tabBarInactive: '#626262',
  },
  dark: {
    background: '#0B0B0B',
    foreground: '#FFFFFF',
    card: '#171717',
    cardForeground: '#FFFFFF',
    surface: '#1D1D1F',
    surfaceAlt: '#262626',
    popover: '#171717',
    popoverForeground: '#FFFFFF',

    primary: '#EB6A16',
    primaryForeground: '#FFFFFF',
    accent: bhim.orangeSoft,
    accentForeground: '#0B0B0B',
    highlight: bhim.orange,
    highlightForeground: '#FFFFFF',

    band: '#0B0B0B',
    bandForeground: '#FFFFFF',

    secondary: '#1D1D1F',
    secondaryForeground: '#FFFFFF',
    muted: '#1D1D1F',
    mutedForeground: '#9C9C9C',
    accentSubtle: 'rgba(244, 121, 32, 0.12)',

    success: '#28BF72',
    successSubtle: 'rgba(40, 191, 114, 0.14)',
    warning: '#F1BF1E',
    warningSubtle: 'rgba(241, 191, 30, 0.13)',
    destructive: '#FF6565',
    destructiveSubtle: 'rgba(255, 101, 101, 0.13)',
    info: '#E9E9E9',
    infoSubtle: 'rgba(255, 255, 255, 0.06)',

    border: '#2A2A2A',
    borderStrong: '#353535',
    input: '#2A2A2A',
    ring: '#E9E9E9',
    focus: '#E9E9E9',
    overlay: 'rgba(0, 0, 0, 0.7)',
    skeleton: '#262626',

    activeGradient: [bhim.orange, bhim.orangeDeep],
    tileGradient: [darkChip.bg, darkChip.bg],
    tileForeground: darkChip.fg,
    tileRing: 'transparent',
    tones: tonesOf(darkChip),

    glowWarm: bhim.orange,
    glowGreen: bhim.green,
    glowStrength: 0.32,

    chart: [bhim.orange, '#28BF72', '#9C9C9C', '#FFFFFF', '#FF6565', '#F1BF1E'],

    tabBar: '#141414',
    tabBarActive: bhim.orange,
    tabBarInactive: '#B5B5B5',
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
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
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
