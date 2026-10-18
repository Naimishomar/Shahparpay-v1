import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, motion, radius, space, type as t, TOUCH } from '../../theme/colors';
import { GradientFill } from './Gradient';

type Variant = 'default' | 'accent' | 'outline' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'default' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  /** Renders the icon after the label — for "Next"-style forward actions. */
  iconRight?: boolean;
  /**
   * Haptic played on press. Money-moving confirmations deserve one; a plain
   * navigation tap does not. `none` opts out.
   */
  haptic?: 'light' | 'medium' | 'success' | 'warning' | 'none';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const HAPTIC = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

const variantStyles = themed((c) => ({
  // Flat: BHIM buttons carry no shadow; the gradient is the emphasis.
  default: { backgroundColor: c.primary, borderColor: 'transparent' },
  accent: { backgroundColor: c.primary, borderColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderColor: c.borderStrong },
  secondary: { backgroundColor: c.surfaceAlt, borderColor: c.surfaceAlt },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  destructive: { backgroundColor: 'transparent', borderColor: c.borderStrong },
}));

const variantTextStyles = themed((c) => ({
  default: { color: c.primaryForeground },
  accent: { color: c.primaryForeground },
  outline: { color: c.foreground },
  secondary: { color: c.secondaryForeground },
  ghost: { color: c.accent },
  // BHIM's Logout: red text on an outlined card, never a red slab.
  destructive: { color: c.destructive },
}));

// Every size clears the 48dp minimum target.
const sizeStyles = themed(() => ({
  sm: { minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill },
  default: { minHeight: 52, paddingHorizontal: space.xl, borderRadius: radius.pill },
  lg: { minHeight: 56, paddingHorizontal: space.xl, borderRadius: radius.pill },
}));

const sizeTextStyles = themed(() => ({
  sm: { fontSize: t.small },
  default: { fontSize: t.body },
  lg: { fontSize: t.bodyLg },
}));

export const Button = React.forwardRef<View, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'default',
      loading = false,
      fullWidth = false,
      icon,
      iconRight = false,
      haptic,
      disabled,
      children,
      style,
      onPress,
      accessibilityLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = !!disabled || loading;
    // BHIM's primary button: an orange gradient pill, in both themes.
    const silver = variant === 'default' || variant === 'accent';
    const textColor = (variantTextStyles[variant] as any).color;
    const label = typeof children === 'string' ? children : undefined;
    const scale = useRef(new Animated.Value(1)).current;

    // 0.97 is enough to feel without nudging neighbouring layout — the button
    // scales inside its own bounds, so nothing around it reflows.
    const animate = (to: number, duration: number) =>
      Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();

    const glyph = !!icon && (
      <MaterialCommunityIcons name={icon as any} size={17} color={textColor} />
    );

    return (
      <Animated.View
        style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }, style]}
      >
        <Pressable
          ref={ref}
          onPress={(event) => {
            if (haptic && haptic !== 'none') HAPTIC[haptic]().catch(() => {});
            onPress?.(event);
          }}
          onPressIn={() => animate(0.97, motion.instant)}
          onPressOut={() => animate(1, motion.fast)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label}
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          style={({ pressed }) => [
            styles.base,
            variantStyles[variant],
            sizeStyles[size],
            fullWidth && styles.fullWidth,
            isDisabled && styles.disabled,
            pressed && !isDisabled && styles.pressed,
          ]}
          {...props}
        >
          {silver && <GradientFill stops={colors.activeGradient} radius={(sizeStyles[size] as any).borderRadius - 1} />}
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <>
              {!iconRight && glyph}
              {React.Children.map(children, (child) =>
                typeof child === 'string' || typeof child === 'number' ? (
                  <Text
                    style={[styles.text, variantTextStyles[variant], sizeTextStyles[size]]}
                    numberOfLines={1}
                  >
                    {child}
                  </Text>
                ) : (
                  child
                )
              )}
              {iconRight && glyph}
            </>
          )}
        </Pressable>
      </Animated.View>
    );
  }
);

Button.displayName = 'Button';

const styles = themed(() => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    paddingVertical: space.sm,
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  text: { fontWeight: '600', letterSpacing: 0.1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.9 },
}));

export default Button;
