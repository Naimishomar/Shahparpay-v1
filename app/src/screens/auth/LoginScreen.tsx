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
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Banner, ErrorBanner, SuccessBanner } from '@/components/ui/Screen';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import api from '@/services/api';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  useTheme(); // re-render this screen when the theme changes
  const { padding, isSmall } = useResponsive();
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
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
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
      setError(
        err.response?.data?.message || 'Could not reach the server. Check your connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await api.verifyOtp(identifier.trim(), otp.trim());
      if (response.success) {
        // The backend returns token/refreshToken/role/user at the top level.
        await login(
          response.token,
          { ...response.user, role: response.role },
          response.refreshToken
        );
      } else {
        setError(response.message || 'Invalid OTP.');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Could not reach the server. Check your connection.'
      );
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: padding + 8, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.card, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <View style={styles.brand}>
            <Image source={require('@/assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.title, isSmall && { fontSize: t.h2 }]} accessibilityRole="header">
              {isOtpStep ? 'Verify it is you' : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>
              {isOtpStep
                ? 'Enter the 6-digit code we emailed you'
                : 'Sign in to your retailer dashboard'}
            </Text>
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
                icon="login"
                size="lg"
                fullWidth
                style={{ marginTop: space.sm }}
              >
                Sign in
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="6-digit verification code"
                required
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                leftIcon="email-check-outline"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                style={styles.otpInput}
                disabled={isLoading}
                placeholder="000000"
              />

              <Pressable
                onPress={() => countdown === 0 && handleSubmit()}
                disabled={countdown > 0 || isLoading}
                style={styles.resend}
                accessibilityRole="button"
                accessibilityState={{ disabled: countdown > 0 || isLoading }}
                accessibilityLabel={countdown > 0 ? `Resend available in ${countdown} seconds` : 'Resend code'}
                hitSlop={8}
              >
                <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Text>
              </Pressable>

              <Button
                onPress={handleVerifyOtp}
                disabled={isLoading || otp.length < 6}
                loading={isLoading}
                icon="shield-check-outline"
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

          <View style={styles.trust}>
            <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.trustText}>
              Two-factor secured · 256-bit encrypted
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.footer}>
          © {new Date().getFullYear()} Shahparpay Networks
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', gap: space.xl },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: space.lg,
  },
  brand: { alignItems: 'center', gap: 4 },
  logo: { width: 132, height: 46, marginBottom: space.sm },
  title: { fontSize: t.h1, fontWeight: '800', color: c.foreground, textAlign: 'center' },
  subtitle: { fontSize: t.small, color: c.mutedForeground, textAlign: 'center', lineHeight: 19 },
  form: { gap: space.lg },
  otpInput: { textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '700' },
  resend: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end' },
  resendText: { fontSize: t.caption, fontWeight: '700', color: c.accent },
  resendDisabled: { color: c.mutedForeground },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  trustText: { fontSize: t.micro, color: c.mutedForeground },
  footer: { fontSize: t.micro, color: c.mutedForeground, textAlign: 'center' },
}));

export default LoginScreen;
