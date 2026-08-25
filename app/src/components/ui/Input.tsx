import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleProp, ViewStyle } from 'react-native';
import { colors, themed } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    containerStyle,
    disabled,
    style,
    placeholder,
    placeholderTextColor,
    ...props
  }, ref) => {
    return (
      <View style={[styles.container, containerStyle, disabled && styles.disabled]}>
        {!!label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <View style={styles.inputWrapper}>
          {!!leftIcon && (
            <View style={styles.iconLeft}>
              {leftIcon}
            </View>
          )}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              !!leftIcon && styles.inputWithLeftIcon,
              !!rightIcon && styles.inputWithRightIcon,
              !!error && styles.inputError,
              style,
            ]}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor || colors.mutedForeground}
            editable={!disabled && props.editable !== false}
            {...props}
          />
          {!!rightIcon && (
            <View style={styles.iconRight}>
              {rightIcon}
            </View>
          )}
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = themed((c) => ({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: c.mutedForeground,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: c.foreground,
    backgroundColor: 'transparent',
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  inputError: {
    borderColor: c.destructive,
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
    color: c.destructive,
  },
  helperText: {
    fontSize: 12,
    color: c.mutedForeground,
  },
  disabled: {
    opacity: 0.5,
  },
}));

export default Input;