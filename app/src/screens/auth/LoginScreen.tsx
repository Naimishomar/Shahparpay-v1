import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ErrorBanner, SuccessBanner } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TopGlow } from '@/components/ui/TopGlow';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import api from '@/services/api';
import { BrandMark } from '@/components/ui/BrandMark';

const OTP_LENGTH = 6;
const FORM_MAX_WIDTH = 440;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

/** "rahul@gmail.com" -> "r***@gmail.com", as on the verify screen. */
const maskEmail = (email?: string) => {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  return `${user.charAt(0)}***@${domain}`;
};

// Web draws a focus ring around a bare TextInput; the field border is the ring.
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

/** On-screen digits, plain and large as in BHIM; the OS keyboard never opens. */
const OtpKeypad: React.FC<{
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}> = ({ value, onChange: setValue, onComplete, disabled }) => {
  const insets = useSafeAreaInsets();
  // Two taps can land before React re-renders; build on the last digits sent,
  // not on the `value` prop, or the second tap overwrites the first.
  const latest = useRef(value);
  latest.current = value;
  const onChange = (digits: string) => {
    latest.current = digits;
    setValue(digits);
  };
  return (
    <View style={[styles.keys, { paddingBottom: insets.bottom }]}>
      <KeyGrid
        value={latest}
        disabled={disabled}
        onChangeText={(next) => {
          const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(digits);
          if (digits.length === OTP_LENGTH) onComplete?.(digits);
        }}
      />
    </View>
  );
};

const KeyGrid: React.FC<{ value: { current: string }; disabled?: boolean; onChangeText: (next: string) => void }> = ({
  value,
  disabled,
  onChangeText,
}) => (
  <>
    {KEYS.map((key, i) =>
      key ? (
        <Pressable
          key={i}
          disabled={disabled}
          onPress={() => onChangeText(key === 'back' ? value.current.slice(0, -1) : value.current + key)}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          accessibilityRole="button"
          accessibilityLabel={key === 'back' ? 'Delete digit' : key}
        >
          {key === 'back' ? (
            <Ionicons name="backspace-outline" size={26} color={colors.foreground} />
          ) : (
            <Text style={styles.keyText}>{key}</Text>
          )}
        </Pressable>
      ) : (
        <View key={i} style={styles.key} />
      )
    )}
  </>
);

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { resolvedTheme } = useTheme(); // re-render this screen when the theme changes
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<'id' | 'password' | null>(null);

  // Forgot password: identifier -> emailed code -> new password.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

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
        setMessage('');
        setSentTo(maskEmail(response.email));
        setOtp('');
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

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotOtp('');
    setForgotPassword('');
    setForgotError('');
  };

  const forgotStep = async () => {
    setForgotError('');
    setForgotBusy(true);
    try {
      const res = forgotEmail
        ? await api.post('/api/auth/reset-password', {
            email: forgotEmail,
            otp: forgotOtp.trim(),
            newPassword: forgotPassword,
          })
        : await api.post('/api/auth/forgot-password', { identifier: forgotId.trim() });
      if (!res.success) {
        setForgotError(res.message || 'Something went wrong. Please try again.');
      } else if (forgotEmail) {
        closeForgot();
        setPassword('');
        setMessage(res.message || 'Password reset. Sign in with your new password.');
      } else {
        setForgotEmail(res.email);
        setMessage('');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.message || 'Could not reach the server. Check your connection.');
    } finally {
      setForgotBusy(false);
    }
  };

  const isDigits = /^\d+$/.test(identifier);

  if (isOtpStep) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TopGlow />
        <StatusBar
          barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
          translucent
        backgroundColor="transparent"
        />
        <View style={styles.topbar}>
          <Pressable
            onPress={() => {
              setIsOtpStep(false);
              setOtp('');
              setError('');
            }}
            disabled={isLoading}
            hitSlop={11}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.otpPad} showsVerticalScrollIndicator={false}>
          <Text style={styles.otpTitle} accessibilityRole="header">
            Enter verification code
          </Text>
          <Text style={styles.otpSub}>
            We sent a 6-digit code to{' '}
            <Text style={styles.otpEmail}>{sentTo || `the email on ${identifier}`}</Text>
          </Text>

          <View
            style={styles.otpRow}
            accessible
            accessibilityLabel={`Verification code, ${otp.length} of ${OTP_LENGTH} digits entered`}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const isCursor = index === Math.min(otp.length, OTP_LENGTH - 1) && otp.length < OTP_LENGTH;
              return (
                <View key={index} style={[styles.otpCell, isCursor && styles.otpCellActive]}>
                  <Text style={styles.otpDigit}>{otp[index] ?? (isCursor ? '|' : '')}</Text>
                </View>
              );
            })}
          </View>

          {!!error && <ErrorBanner message={error} />}

          <Pressable
            onPress={handleSubmit}
            disabled={countdown > 0 || isLoading}
            style={styles.resend}
            accessibilityRole="button"
            accessibilityState={{ disabled: countdown > 0 || isLoading }}
            accessibilityLabel={countdown > 0 ? `Resend available in ${countdown} seconds` : 'Resend code'}
          >
            {countdown > 0 ? (
              <Text style={styles.resendText}>
                Resend code in{' '}
                <Text style={styles.resendTime}>{`00:${String(countdown).padStart(2, '0')}`}</Text>
              </Text>
            ) : (
              <Text style={styles.resendTime}>Resend code</Text>
            )}
          </Pressable>
        </ScrollView>

        <View style={styles.verifyWrap}>
          <Button onPress={() => handleVerifyOtp()} disabled={otp.length < OTP_LENGTH} loading={isLoading} fullWidth>
            Verify
          </Button>
        </View>
        <OtpKeypad
          value={otp}
          onChange={setOtp}
          disabled={isLoading}
          // Six digits in means there is nothing left to decide. The code comes
          // from the callback, not from `otp`, which is a render behind here.
          onComplete={handleVerifyOtp}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopGlow />
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetInner}>
            <BrandMark size={32} color={colors.foreground} />
            <Text style={styles.title} accessibilityRole="header">
              Welcome to{'\n'}Shahparpay
            </Text>
            <Text style={styles.subtitle}>Banking point for your shop: AEPS, money transfer, bills and more.</Text>

            {/* Step indicator: the code step is reached by signing in, never skipped to. */}
            <View style={styles.seg} accessibilityRole="tablist">
              <View style={[styles.segItem, styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
                <Text style={[styles.segText, styles.segTextOn]}>Password</Text>
              </View>
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading || !identifier || !password}
                style={styles.segItem}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: false, disabled: isLoading || !identifier || !password }}
                accessibilityLabel="OTP. Enter your login details first to get a code"
              >
                <Text style={styles.segText}>OTP</Text>
              </Pressable>
            </View>

            {!!error && <ErrorBanner message={error} />}
            {!!message && !error && <SuccessBanner message={message} />}

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <View style={[styles.field, focus === 'id' && styles.fieldFocus]}>
              <View style={styles.fieldRow}>
                {isDigits && <Text style={styles.fieldValue}>+91</Text>}
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  onFocus={() => setFocus('id')}
                  onBlur={() => setFocus(null)}
                  placeholder="Mobile number or User ID"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  editable={!isLoading}
                  accessibilityLabel="Mobile number, User ID or email"
                  style={[styles.fieldValue, styles.fieldInput, noOutline]}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.field, focus === 'password' && styles.fieldFocus]}>
              <View style={styles.fieldRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus(null)}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => identifier && password && handleSubmit()}
                  editable={!isLoading}
                  accessibilityLabel="Password"
                  style={[
                    styles.fieldValue,
                    styles.fieldInput,
                    !showPassword && !!password && { letterSpacing: 3 },
                    noOutline,
                  ]}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setForgotId(identifier);
                setForgotOpen(true);
              }}
              style={styles.forgot}
              hitSlop={{ top: 12, bottom: 12, left: 8 }}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Button onPress={handleSubmit} disabled={!identifier || !password} loading={isLoading} fullWidth>
              Login
            </Button>

            <View style={styles.trust}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.mutedForeground} />
              <Text style={styles.trustText}>Secured with 256-bit encryption</Text>
            </View>
        </View>
      </ScrollView>

      <Sheet
        visible={forgotOpen}
        onClose={closeForgot}
        dismissible={!forgotBusy}
        title="Reset password"
        subtitle={forgotEmail ? `Code sent to ${maskEmail(forgotEmail)}` : 'We will email you a 6-digit code'}
        icon="lock-reset"
        footer={
          <Button
            onPress={forgotStep}
            loading={forgotBusy}
            disabled={forgotEmail ? forgotOtp.length !== OTP_LENGTH || forgotPassword.length < 6 : !forgotId.trim()}
            fullWidth
          >
            {forgotEmail ? 'Reset password' : 'Send code'}
          </Button>
        }
      >
        <View style={styles.forgotForm}>
          {!!forgotError && <ErrorBanner message={forgotError} />}
          {forgotEmail ? (
            <>
              <Input
                label="Email code"
                value={forgotOtp}
                onChangeText={(v) => setForgotOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                leftIcon="email-check-outline"
              />
              <Input
                label="New password"
                value={forgotPassword}
                onChangeText={setForgotPassword}
                secureTextEntry
                leftIcon="lock-outline"
                helperText="At least 6 characters"
              />
            </>
          ) : (
            <Input
              label="Mobile number, User ID or email"
              value={forgotId}
              onChangeText={setForgotId}
              autoCapitalize="none"
              leftIcon="account-outline"
            />
          )}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
};

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: space.lg },
  sheetInner: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },
  // BHIM's onboarding: a big regular-weight greeting, no band behind it.
  title: { fontSize: 34, lineHeight: 42, fontWeight: '400', color: c.foreground, marginTop: space.xxxl },
  subtitle: { fontSize: t.body, lineHeight: 22, color: c.mutedForeground, marginTop: space.sm },
  // Underline tabs: the step indicator reads as BHIM's Pending / Completed.
  seg: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginTop: space.xxxl,
    marginBottom: space.xl,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  segOn: { borderBottomColor: c.highlight },
  segText: { fontSize: t.bodyLg, fontWeight: '400', color: c.mutedForeground },
  segTextOn: { color: c.foreground, fontWeight: '500' },
  fieldLabel: { fontSize: t.small, fontWeight: '400', color: c.mutedForeground, marginBottom: space.sm },
  field: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.input,
    borderRadius: radius.md,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  fieldFocus: { borderColor: c.focus },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fieldValue: { fontSize: 16, fontWeight: '400', color: c.foreground },
  fieldInput: { flex: 1, minWidth: 0, padding: 0, margin: 0, height: 24 },
  forgot: { alignSelf: 'flex-end', marginTop: -space.xs, marginBottom: space.xl, minHeight: 32, justifyContent: 'center' },
  forgotText: { fontSize: t.small, fontWeight: '500', color: c.foreground, textDecorationLine: 'underline' },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.xl },
  trustText: { fontSize: t.caption, color: c.mutedForeground },
  forgotForm: { gap: 16 },
  // OTP step
  topbar: { paddingTop: space.md, paddingBottom: space.md, paddingHorizontal: space.lg, flexDirection: 'row' },
  otpPad: { paddingHorizontal: space.lg, paddingTop: space.lg },
  otpTitle: { fontSize: 30, lineHeight: 38, fontWeight: '400', color: c.foreground },
  otpSub: { fontSize: t.body, lineHeight: 22, color: c.mutedForeground, marginTop: space.sm },
  otpEmail: { fontWeight: '500', color: c.foreground },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginTop: space.xxxl, marginBottom: space.lg },
  otpCell: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellActive: { borderColor: c.focus },
  otpDigit: { fontSize: 24, fontWeight: '400', color: c.foreground, fontVariant: ['tabular-nums'] },
  resend: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  resendText: { fontSize: t.small, color: c.mutedForeground },
  resendTime: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  verifyWrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
  keys: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg },
  key: { width: '33.3333%', height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  keyPressed: { backgroundColor: c.surface },
  keyText: { fontSize: 28, fontWeight: '400', color: c.foreground },
}));

export default LoginScreen;
