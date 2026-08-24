import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { cn } from '@/utils/cn';
import { useTheme } from '@/context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  containerStyle?: any;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({
    className = '',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    containerStyle,
    style,
    placeholder,
    placeholderTextColor,
    ...props
  }, ref) => {
    const { resolvedTheme } = useTheme();

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <View style={styles.inputWrapper}>
          {leftIcon && (
            <View style={styles.iconLeft}>
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
              error && styles.inputError,
              style,
            ]}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor || 'var(--muted-foreground)'}
            {...props}
          />
          {rightIcon && (
            <View style={styles.iconRight}>
              {rightIcon}
            </View>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'var(--muted-foreground)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'var(--border)',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  inputError: {
    borderColor: 'var(--destructive)',
  },
  iconLeft: {
    paddingLeft: 14,
    paddingRight: 8,
  },
  iconRight: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: 'var(--destructive)',
  },
  helperText: {
    fontSize: 12,
    color: 'var(--muted-foreground)',
  },
});

export default Input;