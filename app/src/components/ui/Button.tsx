import React from 'react';
import { Pressable, Text, StyleSheet, View, ActivityIndicator, PressableProps } from 'react-native';
import { cn } from '@/utils/cn';
import { useTheme } from '@/context/ThemeContext';

interface ButtonProps extends PressableProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
  asChild?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: {
    backgroundColor: 'var(--primary)',
    borderColor: 'transparent',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: 'var(--border)',
    borderWidth: 1,
  },
  secondary: {
    backgroundColor: 'var(--secondary)',
    borderColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'var(--destructive)',
    borderColor: 'transparent',
  },
  link: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
};

const sizeStyles = {
  default: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sm: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  lg: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  xs: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  icon: {
    height: 40,
    width: 40,
    paddingHorizontal: 0,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
};

export const Button = React.forwardRef<
  Pressable,
  ButtonProps
>(({
  className = '',
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  children,
  style,
  onPress,
  ...props
}, ref) => {
  const { resolvedTheme } = useTheme();
  const isDisabled = disabled || loading;

  const baseStyles = [
    styles.base,
    variantStyles[variant],
    sizeStyles[size],
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    variantStyles[variant] as any,
    sizeStyles[size] as any,
  ];

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        ...baseStyles,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'default' || variant === 'destructive' ? 'var(--primary-foreground)' : 'var(--foreground)'}
        />
      ) : (
        <Text style={textStyles} numberOfLines={1}>
          {children}
        </Text>
      )}
    </Pressable>
  );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});

export default Button;