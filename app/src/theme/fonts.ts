import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * The app ships its own typeface so it looks the same on every handset.
 * Without this, React Native falls back to the system font and the UI picks up
 * whatever the phone is set to (OnePlus Slate, Samsung One UI, a user-chosen
 * font pack), which changes metrics and breaks the type scale.
 *
 * IBM Plex Sans is the design system's face: a banking/finance grotesque with
 * genuine tabular figures, which the money columns depend on.
 */
export const FONTS = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

/**
 * Custom fonts do not synthesize weights on Android: `fontWeight: '700'` with a
 * regular family renders regular, or a smeared fake bold. Each weight has to
 * resolve to its own family, so numeric weights map onto the four faces above.
 * 800/900 fold into Bold — the family ships nothing heavier.
 */
const FAMILY_FOR_WEIGHT: Record<string, string> = {
  '100': FONTS.regular,
  '200': FONTS.regular,
  '300': FONTS.regular,
  '400': FONTS.regular,
  normal: FONTS.regular,
  '500': FONTS.medium,
  '600': FONTS.semibold,
  '700': FONTS.bold,
  '800': FONTS.bold,
  '900': FONTS.bold,
  bold: FONTS.bold,
};

/**
 * Resolves one style object to a concrete family, then drops `fontWeight`:
 * leaving both set makes Android apply fake bold on top of the real bold face.
 */
const withFont = (style: any) => {
  const flat = StyleSheet.flatten(style) || {};
  // An explicit fontFamily at the call site wins — this only fills the gap.
  if (flat.fontFamily) return style;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: FAMILY_FOR_WEIGHT[String(fontWeight ?? '400')] ?? FONTS.regular };
};

let patched = false;

/**
 * Applies the family to every `<Text>` and `<TextInput>` in the app.
 *
 * React Native has no global font inheritance and no theme hook for this, so
 * the render function is wrapped once at startup. The alternative — adding
 * `fontFamily` to all ~120 text styles — would still miss anything added
 * later, which is exactly how a stray system-font label creeps back in.
 *
 * The style is injected into the props going IN, not the element coming out.
 * A top-level <Text> renders as <TextAncestor.Provider><NativeText/></...>,
 * so a style written onto the returned element lands on the Provider, where
 * it is silently discarded — only nested text ever picked it up. Feeding the
 * props instead lets RN merge the family into the node that actually paints.
 */
export const applyAppFont = () => {
  if (patched) return;
  patched = true;

  for (const Component of [Text, TextInput] as any[]) {
    const render = Component.render;
    if (typeof render !== 'function') continue;
    Component.render = function patchedRender(props: any, ref: any) {
      return render.call(this, { ...props, style: withFont(props?.style) }, ref);
    };
  }
};

/** True once the render wrappers are installed — used by the startup check. */
export const isAppFontActive = () => patched;

export default applyAppFont;
