import React from 'react';
import { Pressable, Text, View, ActivityIndicator, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { colors, themed } from '../../theme/colors';

type Variant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon' | 'xs';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const variantStyles = themed((c) => ({
  default: { backgroundColor: c.primary, borderColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderColor: c.border, borderWidth: 1 },
  secondary: { backgroundColor: c.secondary, borderColor: 'transparent' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  destructive: { backgroundColor: c.destructive, borderColor: 'transparent' },
  link: { backgroundColor: 'transparent', borderColor: 'transparent' },
}));

const variantTextStyles = themed((c) => ({
  default: { color: c.primaryForeground },
  outline: { color: c.foreground },
  secondary: { color: c.secondaryForeground },
  ghost: { color: c.foreground },
  destructive: { color: '#FFFFFF' },
  link: { color: c.primary, textDecorationLine: 'underline' as const },
}));

const sizeStyles = themed(() => ({
  default: { height: 40, paddingHorizontal: 16, borderRadius: 8 },
  sm: { height: 36, paddingHorizontal: 12, borderRadius: 6 },
  lg: { height: 44, paddingHorizontal: 20, borderRadius: 10 },
  xs: { height: 32, paddingHorizontal: 10, borderRadius: 5 },
  icon: { height: 40, width: 40, paddingHorizontal: 0, borderRadius: 8 },
}));

const sizeTextStyles = themed(() => ({
  default: { fontSize: 14 },
  sm: { fontSize: 13 },
  lg: { fontSize: 16 },
  xs: { fontSize: 12 },
  icon: { fontSize: 14 },
}));

export const Button = React.forwardRef<View, ButtonProps>(({
  variant = 'default',
  size = 'default',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  onPress,
  ...props
}, ref) => {
  const isDisabled = !!disabled || loading;
  const spinnerColor = variant === 'default' ? colors.primaryForeground
    : variant === 'destructive' ? '#FFFFFF'
    : colors.foreground;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        React.Children.map(children, (child) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text style={[styles.text, variantTextStyles[variant], sizeTextStyles[size]]} numberOfLines={1}>
              {child}
            </Text>
          ) : (
            child
          ),
        )
      )}
    </Pressable>
  );
});

Button.displayName = 'Button';

const styles = themed(() => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
}));

export default Button;
