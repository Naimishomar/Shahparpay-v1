import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner, SuccessBanner } from '@/components/ui/Screen';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, themed, motion, radius, space, type as t, TOUCH } from '../../theme/colors';
import { ServiceMarquee } from '@/components/auth/ServiceMarquee';
import api from '@/services/api';

const OTP_LENGTH = 6;

/** logo.png is 427x87; keep the mark on its own aspect ratio at every size. */
const LOGO_RATIO = 427 / 87;

/** The form never grows past this, and the logo is sized against it. */
const FORM_MAX_WIDTH = 440;

/**
 * Six boxed digits over one hidden field. A single input with letter-spacing
 * drifts out of alignment as digits land and gives no sense of how many are
 * left; discrete cells read at a glance and still get the OS autofill, because
 * the real <TextInput> underneath keeps its one-time-code content type.
 */
const OtpField: React.FC<{
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  onComplete?: (code: string) => void;
}> = ({ value, onChange, disabled, onComplete }) => {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      // The hidden field owns the accessible name; the cells are decoration.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.otpRow}
    >
      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
        const digit = value[index];
        // The caret sits on the next empty cell, or the last one when full.
        const isCursor = focused && index === Math.min(value.length, OTP_LENGTH - 1);
        return (
          <View
            key={index}
            style={[styles.otpCell, !!digit && styles.otpCellFilled, isCursor && styles.otpCellActive]}
          >
            <Text style={styles.otpDigit}>{digit ?? ''}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => {
          const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(digits);
          if (digits.length === OTP_LENGTH) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={!disabled}
        accessibilityLabel={`${OTP_LENGTH}-digit verification code`}
        style={styles.otpHiddenInput}
        caretHidden
      />
    </Pressable>
  );
};

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  useTheme(); // re-render this screen when the theme changes
  const { padding, isSmall, contentWidth } = useResponsive();
  const gutter = padding + space.xs;

  /**
   * The logo scales with the device rather than sitting at a fixed 190px,
   * where it looked undersized on anything above an SE. It is measured against
   * the form's own column (capped at FORM_MAX_WIDTH), not the raw screen, so
   * the mark stays in proportion to the fields under it on a tablet. Height
   * comes from the asset's true 427:87 ratio, so it never distorts.
   */
  const logoWidth = Math.round(Math.min(contentWidth, FORM_MAX_WIDTH) * 0.66);
  const logoSize = { width: logoWidth, height: Math.round(logoWidth / LOGO_RATIO) };
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: motion.slow, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 0,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await api.login(identifier.trim(), password);
      if (response.success && response.requireOtp) {
        setMessage(response.message);
        setIsOtpStep(true);
        setCountdown(60);
      } else {
        setError(response.message || 'Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not reach the server. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code = otp) => {
    setError('');
    setIsLoading(true);
    try {
      const response = await api.verifyOtp(identifier.trim(), code.trim());
      if (response.success) {
        // The backend returns token/refreshToken/role/user at the top level.
        await login(response.token, { ...response.user, role: response.role }, response.refreshToken);
      } else {
        setError(response.message || 'Invalid OTP.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not reach the server. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.brandBlock,
            { paddingTop: insets.top + space.xxxl, opacity: fade, transform: [{ translateY: slide }] },
          ]}
        >
          {/* The logo sits on the page at its own weight — the type below
              carries the hierarchy, not a block of colour behind it. */}
          <View style={[styles.brand, { paddingHorizontal: gutter }]}>
            <Image
              source={require('@/assets/logo.png')}
              style={logoSize}
              resizeMode="contain"
              // Black-on-transparent asset: untinted it disappears on the dark
              // background. One tint keeps a single file correct in both themes.
              tintColor={colors.foreground}
              accessibilityLabel="Shahparpay"
            />
          </View>

          {/* Full-bleed: cards enter and leave at the screen edges, not at the
              form's gutter. */}
          <ServiceMarquee />

          <View style={[styles.sheet, { paddingHorizontal: gutter }]}>
            <View style={styles.headings}>
              <Text style={[styles.title, isSmall && { fontSize: t.h2 }]} accessibilityRole="header">
                {isOtpStep ? 'Verify it is you' : 'Welcome back'}
              </Text>
              <Text style={styles.subtitle}>
                {isOtpStep
                  ? 'Enter the 6-digit code we emailed you'
                  : 'Sign in to your retailer dashboard'}
              </Text>
            </View>

            {/* Two dashes rather than a spinner: the flow is short enough that a
                full stepper would be heavier than the thing it describes. */}
            <View style={styles.steps} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.step, styles.stepDone]} />
              <View style={[styles.step, isOtpStep && styles.stepDone]} />
            </View>

            {!!error && <ErrorBanner message={error} />}
            {!!message && !error && <SuccessBanner message={message} />}

            {!isOtpStep ? (
              <View style={styles.form}>
                <Input
                  label="User ID, email or phone"
                  required
                  value={identifier}
                  onChangeText={setIdentifier}
                  leftIcon="account-outline"
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  disabled={isLoading}
                />
                <Input
                  label="Password"
                  required
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  leftIcon="lock-outline"
                  rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  rightIconLabel={showPassword ? 'Hide password' : 'Show password'}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  disabled={isLoading}
                />
                <Button
                  onPress={handleSubmit}
                  disabled={isLoading || !identifier || !password}
                  loading={isLoading}
                  icon="arrow-right"
                  iconRight
                  haptic="light"
                  size="lg"
                  fullWidth
                  style={{ marginTop: space.xs }}
                >
                  Sign in
                </Button>
              </View>
            ) : (
              <View style={styles.form}>
                <View style={styles.sentTo}>
                  <MaterialCommunityIcons
                    name="email-fast-outline"
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text style={styles.sentToText} numberOfLines={1}>
                    Sent to the address on {identifier}
                  </Text>
                </View>

                <OtpField
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                  // Six digits in means there is nothing left to decide. The
                  // code comes from the callback, not from `otp` — that state
                  // is still one render behind at this point.
                  onComplete={handleVerifyOtp}
                />

                <Pressable
                  onPress={() => countdown === 0 && handleSubmit()}
                  disabled={countdown > 0 || isLoading}
                  style={styles.resend}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: countdown > 0 || isLoading }}
                  accessibilityLabel={
                    countdown > 0 ? `Resend available in ${countdown} seconds` : 'Resend code'
                  }
                  hitSlop={8}
                >
                  <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                  </Text>
                </Pressable>

                <Button
                  onPress={() => handleVerifyOtp()}
                  disabled={isLoading || otp.length < OTP_LENGTH}
                  loading={isLoading}
                  icon="shield-check-outline"
                  haptic="success"
                  size="lg"
                  fullWidth
                >
                  Verify and continue
                </Button>

                <Button
                  variant="ghost"
                  icon="arrow-left"
                  onPress={() => {
                    setIsOtpStep(false);
                    setOtp('');
                    setMessage('');
                    setError('');
                  }}
                  disabled={isLoading}
                  fullWidth
                >
                  Use a different account
                </Button>
              </View>
            )}
            </View>
        </Animated.View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  /**
   * No card and no colour block: the form sits on the page and earns its
   * hierarchy from whitespace and type size. Sign-in has exactly one job, so
   * there is nothing here to separate it from.
   */
  sheet: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    gap: space.xl,
  },
  // The marquee is a child of this block but must not inherit the form's
  // horizontal padding, so the gutter is applied per section instead.
  brandBlock: { width: '100%', gap: space.xl },
  brand: { alignItems: 'center' },
  // Centred to sit under the centred mark; the form below stays left-aligned
  // so the fields keep a single reading edge.
  headings: { gap: 6, alignItems: 'center' },
  title: { fontSize: t.h1, fontWeight: '800', color: c.foreground, letterSpacing: -0.8 },
  subtitle: {
    fontSize: t.body,
    color: c.mutedForeground,
    lineHeight: 22,
    textAlign: 'center',
  },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: c.border },
  stepDone: { backgroundColor: c.accent },
  form: { gap: space.lg },
  sentTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
  },
  sentToText: { flex: 1, fontSize: t.caption, color: c.mutedForeground },
  otpRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' },
  otpCell: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.input,
    backgroundColor: c.secondary,
  },
  otpCellFilled: { borderColor: c.borderStrong, backgroundColor: c.card },
  otpCellActive: { borderColor: c.ring, borderWidth: 2, backgroundColor: c.card },
  otpDigit: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  // Off-screen rather than display:none — a hidden field still has to be
  // focusable for the keyboard and for SMS autofill to reach it.
  otpHiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resend: { minHeight: TOUCH - 8, justifyContent: 'center', alignSelf: 'flex-end' },
  resendText: { fontSize: t.caption, fontWeight: '700', color: c.accent },
  resendDisabled: { color: c.mutedForeground },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xxxl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
  },
  trustText: { fontSize: t.micro, color: c.mutedForeground },
  footer: {
    fontSize: t.micro,
    color: c.mutedForeground,
    textAlign: 'center',
    marginTop: space.sm,
  },
}));

export default LoginScreen;
