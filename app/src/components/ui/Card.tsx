import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle, TextStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, lift, radius, space, type as t } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `flat` drops the shadow for cards nested inside another surface. */
  variant?: 'default' | 'flat' | 'accent' | 'elevated' | 'outline';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = space.lg,
  onPress,
  accessibilityLabel,
}) => {
  const content = [styles.base, styles[variant], { padding }, style];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...content, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
};

export const CardHeader: React.FC<{
  children: React.ReactNode;
  /**
   * Trailing control shown on the title's own line — the same slot SectionTitle
   * offers. Without it the header is a plain column, so a title and a link
   * passed as siblings stacked on top of each other.
   */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, action, style }) =>
  action ? (
    <View style={[styles.header, styles.headerRow, style]}>
      <View style={styles.headerMain}>{children}</View>
      {action}
    </View>
  ) : (
    <View style={[styles.header, style]}>{children}</View>
  );

export const CardTitle: React.FC<{
  children: React.ReactNode;
  icon?: string;
  style?: StyleProp<TextStyle>;
}> = ({ children, icon, style }) => (
  <View style={styles.titleRow}>
    {!!icon && (
      <MaterialCommunityIcons name={icon as any} size={17} color={colors.accent} />
    )}
    <Text style={[styles.title, style]} accessibilityRole="header">
      {children}
    </Text>
  </View>
);

export const CardDescription: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => <Text style={[styles.description, style]}>{children}</Text>;

export const CardContent: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => <View style={[styles.content, style]}>{children}</View>;

export const CardFooter: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => <View style={[styles.footer, style]}>{children}</View>;

const styles = themed((c, isDark) => ({
  base: { borderRadius: radius.lg, overflow: 'hidden' },
  default: {
    backgroundColor: c.card,
    borderWidth: 1,
    // On the black ground the card's own fill is the separation; an outline on
    // top of it just draws a grey box around every block.
    borderColor: isDark ? 'transparent' : c.border,
    ...lift('sm', isDark),
  },
  /** Lifted off the page — summary tiles, anything that invites a tap. */
  elevated: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: isDark ? c.border : 'transparent',
    ...lift('md', isDark),
  },
  flat: { backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border },
  /** Border only: groups content without adding another filled plane. */
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
  // Solid gold, not the subtle tint: `accentForeground` is a near-black meant
  // to sit on full-strength accent. Over the 16% tint it fails contrast in
  // dark mode.
  accent: {
    backgroundColor: c.accent,
    borderWidth: 1,
    borderColor: c.accent,
    ...lift('md', isDark),
  },
  // Opacity only: scaling a card shifts everything below it.
  pressed: { opacity: 0.75 },
  header: { paddingBottom: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerMain: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: t.bodyLg, fontWeight: '700', color: c.cardForeground, letterSpacing: -0.2 },
  description: { fontSize: t.caption, color: c.mutedForeground, marginTop: 3, lineHeight: 17 },
  content: {},
  footer: {
    paddingTop: space.md,
    marginTop: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
}));

export default Card;
