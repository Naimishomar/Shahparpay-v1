import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '@/services/api';
import { colors, themed } from '../../theme/colors';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const navigation = useNavigation<any>();
  useTheme(); // re-render this screen when the theme changes

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
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
      setError(err.response?.data?.message || 'System error occurred. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await api.verifyOtp(identifier, otp);

      if (response.success) {
        // AppNavigator swaps to the role's stack as soon as the token lands.
        await login(response.data.token, { ...response.data.user, role: response.data.role });
      } else {
        setError(response.message || 'Invalid OTP.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'System error occurred. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (countdown === 0) {
      handleSubmit();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.View
          style={[
            styles.formContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Enter your credentials to access your dashboard</Text>
          </View>

          {!!error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!!message && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          {!isOtpStep ? (
            <View style={styles.form}>
              <Input
                label="Identifier"
                placeholder="User ID, Email, or Phone"
                value={identifier}
                onChangeText={setIdentifier}
                leftIcon={<Ionicons name="person-outline" size={22} color={colors.mutedForeground} />}
                autoCapitalize="none"
                autoComplete="username"
                disabled={isLoading}
              />

              <View style={styles.passwordWrapper}>
                <Input
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  leftIcon={<MaterialCommunityIcons name="lock" size={22} color={colors.mutedForeground} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <MaterialCommunityIcons name="eye-off" size={22} color={colors.mutedForeground} />
                      ) : (
                        <MaterialCommunityIcons name="eye" size={22} color={colors.mutedForeground} />
                      )}
                    </TouchableOpacity>
                  }
                  autoComplete="password"
                  disabled={isLoading}
                />
              </View>

              <Button
                onPress={handleSubmit}
                disabled={isLoading || !identifier || !password}
                loading={isLoading}
                style={{ marginTop: 24 }}
              >
                {isLoading ? 'Signing In...' : 'Secure Login'}
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="6-Digit Verification Code"
                placeholder="Enter OTP from email"
                value={otp}
                onChangeText={setOtp}
                leftIcon={<MaterialCommunityIcons name="lock" size={22} color={colors.mutedForeground} />}
                keyboardType="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                style={styles.otpInput}
                disabled={isLoading}
              />

              <TouchableOpacity onPress={handleResendOtp} disabled={countdown > 0 || isLoading} style={styles.resendContainer}>
                <Text style={[
                  styles.resendText,
                  countdown > 0 && styles.resendTextDisabled,
                ]}>
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>

              <Button
                onPress={handleVerifyOtp}
                disabled={isLoading || otp.length < 6}
                loading={isLoading}
                style={{ marginTop: 24 }}
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} Shahparpay Networks. All rights reserved.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = themed((c) => ({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 50,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: c.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: c.mutedForeground,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  passwordWrapper: {},
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 20,
    fontFamily: 'monospace',
  },
  resendContainer: {
    alignItems: 'flex-end',
    marginTop: -8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.primary,
  },
  resendTextDisabled: {
    color: c.mutedForeground,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: c.destructive,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    color: '#10B981',
    flex: 1,
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  footerText: {
    fontSize: 12,
    color: c.mutedForeground,
    textAlign: 'center',
  },
}));

export default LoginScreen;