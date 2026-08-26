import React from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  rightIconLabel?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

let uid = 0;

/**
 * Text field with a visible label (never placeholder-only), the error rendered
 * next to the field it belongs to, and persistent helper text. Errors announce
 * themselves via a live region rather than only appearing visually.
 */
export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onRightIconPress,
      rightIconLabel,
      required,
      containerStyle,
      disabled,
      style,
      placeholder,
      placeholderTextColor,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false);
    const errorId = React.useRef(`input-error-${++uid}`).current;

    return (
      <View style={[styles.container, containerStyle, disabled && styles.disabled]}>
        {!!label && (
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        )}

        <View
          style={[
            styles.wrapper,
            focused && styles.wrapperFocused,
            !!error && styles.wrapperError,
          ]}
        >
          {!!leftIcon && (
            <MaterialCommunityIcons
              name={leftIcon as any}
              size={19}
              color={colors.mutedForeground}
              style={styles.iconLeft}
            />
          )}

          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor || colors.mutedForeground}
            editable={!disabled && props.editable !== false}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            accessibilityLabel={label}
            accessibilityHint={helperText}
            aria-describedby={error ? errorId : undefined}
            {...props}
          />

          {!!rightIcon && (
            <Pressable
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel}
              style={styles.iconRight}
            >
              <MaterialCommunityIcons
                name={rightIcon as any}
                size={19}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        {!!error && (
          <View style={styles.errorRow} nativeID={errorId} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="alert-circle" size={13} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

/** Tap-to-open field used where a native picker would be overkill. */
export const SelectField: React.FC<{
  label?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  open?: boolean;
  onPress: () => void;
}> = ({ label, value, placeholder, required, error, open, onPress }) => (
  <View style={styles.container}>
    {!!label && (
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
    )}
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        styles.select,
        !!error && styles.wrapperError,
        pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value || placeholder }}
      accessibilityState={{ expanded: !!open }}
    >
      <Text style={value ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
        {value || placeholder || 'Select'}
      </Text>
      <MaterialCommunityIcons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={19}
        color={colors.mutedForeground}
      />
    </Pressable>
    {!!error && (
      <View style={styles.errorRow} accessibilityLiveRegion="polite">
        <MaterialCommunityIcons name="alert-circle" size={13} color={colors.destructive} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )}
  </View>
);

const styles = themed((c) => ({
  container: { gap: 7 },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground, letterSpacing: 0.1 },
  required: { color: c.destructive },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.input,
    borderRadius: radius.md,
    // Fields sit *into* the card rather than on top of it, so a form reads as
    // one surface with inputs cut into it.
    backgroundColor: c.secondary,
    minHeight: TOUCH,
  },
  // 2px ring plus a tinted halo: focus stays visible without relying on colour
  // alone, and survives at the largest Dynamic Type sizes.
  wrapperFocused: {
    borderColor: c.ring,
    borderWidth: 2,
    backgroundColor: c.card,
    ...({ shadowColor: c.ring, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } as const),
  },
  wrapperError: { borderColor: c.destructive },
  select: { paddingHorizontal: space.md, justifyContent: 'space-between' },
  selectValue: { flex: 1, fontSize: t.body, color: c.foreground },
  selectPlaceholder: { flex: 1, fontSize: t.body, color: c.mutedForeground },
  input: {
    flex: 1,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    // 16px avoids iOS auto-zoom on focus.
    fontSize: 16,
    color: c.foreground,
  },
  iconLeft: { marginLeft: space.md, marginRight: -4 },
  iconRight: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  errorText: { flex: 1, fontSize: t.caption, color: c.destructive },
  helperText: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 16 },
  disabled: { opacity: 0.5 },
}));

export default Input;
