import React from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';

type Variant = 'default' | 'accent' | 'outline' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'default' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const variantStyles = themed((c) => ({
  default: { backgroundColor: c.primary, borderColor: c.primary },
  accent: { backgroundColor: c.accent, borderColor: c.accent },
  outline: { backgroundColor: 'transparent', borderColor: c.borderStrong },
  secondary: { backgroundColor: c.secondary, borderColor: c.secondary },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  destructive: { backgroundColor: c.destructive, borderColor: c.destructive },
}));

const variantTextStyles = themed((c) => ({
  default: { color: c.primaryForeground },
  accent: { color: c.accentForeground },
  outline: { color: c.foreground },
  secondary: { color: c.secondaryForeground },
  ghost: { color: c.accent },
  destructive: { color: '#FFFFFF' },
}));

// Every size clears the 48dp minimum target.
const sizeStyles = themed(() => ({
  sm: { minHeight: TOUCH, paddingHorizontal: space.md, borderRadius: radius.sm },
  default: { minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.md },
  lg: { minHeight: 54, paddingHorizontal: space.xl, borderRadius: radius.md },
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
    const textColor = (variantTextStyles[variant] as any).color;
    const label = typeof children === 'string' ? children : undefined;

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
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
          style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {!!icon && <MaterialCommunityIcons name={icon as any} size={17} color={textColor} />}
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
          </>
        )}
      </Pressable>
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
  text: { fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
}));

export default Button;
