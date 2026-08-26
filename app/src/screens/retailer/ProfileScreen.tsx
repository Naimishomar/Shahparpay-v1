import React, { useState } from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  ErrorBanner,
  Grid,
  Row,
  StatusPill,
  SuccessBanner,
  money,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import api from '@/services/api';

export const ProfileScreen: React.FC = () => {
  const { user, logout, checkSession } = useAuth();
  const { theme, setTheme } = useTheme();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [businessName, setBusinessName] = useState((user as any)?.businessName ?? '');

  const [passwordStep, setPasswordStep] = useState<0 | 1 | 2>(0);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const isRetailer = user?.role === 'retailer';
  const merchant = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode: user?.retailerId || user?.code })).data,
    [user?.retailerId],
    isRetailer
  );

  const saveProfile = useAction(async () => {
    const res = await api.updateProfile({
      name: name.trim(),
      contactNumber: contactNumber.trim(),
      businessName: businessName.trim(),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  // Password change is OTP-gated; the code goes to the account's own email.
  const requestOtp = useAction(async () => {
    const res = await api.sendPasswordOtp();
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const changePassword = useAction(async () => {
    const res = await api.changePassword({
      email: user?.email ?? '',
      otp: otp.trim(),
      newPassword,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const passwordValid =
    otp.trim().length === 6 && newPassword.length >= 6 && newPassword === confirmPassword;

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need your password and an email OTP to sign back in.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  return (
    <Screen
      refreshing={balances.refreshing}
      onRefresh={() => {
        balances.refresh();
        if (isRetailer) merchant.refresh();
      }}
      error={balances.error}
      onRetry={balances.reload}
    >
      <Card>
        <CardContent style={styles.profileHeader}>
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
          )}
          <View style={styles.profileText}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <Text style={styles.userRole}>
              {user?.role ? `${user.role[0].toUpperCase()}${user.role.slice(1)}` : 'Account'}
              {user?.code ? ` · ${user.code}` : ''}
            </Text>
          </View>
        </CardContent>
      </Card>

      <Grid columns={2}>
        {user?.role === 'admin' ? (
          <Tile label="Admin wallet" value={money(balances.data?.adminBalance)} />
        ) : (
          <>
            <Tile label="AEPS wallet" value={money(balances.data?.aepsBalance)} />
            <Tile label="Main wallet" value={money(balances.data?.mainBalance)} />
          </>
        )}
      </Grid>

      {!!notice && <SuccessBanner message={notice} />}

      <Card>
        <CardHeader>
          <CardTitle icon="account-details-outline">Account details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {editing ? (
            <>
              <Input label="Full name" value={name} onChangeText={setName} leftIcon="account-outline" />
              <Input
                label="Contact number"
                value={contactNumber}
                onChangeText={(v) => setContactNumber(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                leftIcon="phone-outline"
              />
              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                leftIcon="storefront-outline"
              />
              {!!saveProfile.error && <ErrorBanner message={saveProfile.error} />}
              <View style={styles.actionRow}>
                <Button variant="secondary" onPress={() => setEditing(false)} style={styles.flex}>
                  Cancel
                </Button>
                <Button
                  onPress={async () => {
                    const res = await saveProfile.run();
                    if (res) {
                      setNotice('Profile updated.');
                      setEditing(false);
                      checkSession();
                    }
                  }}
                  loading={saveProfile.pending}
                  icon="content-save-outline"
                  style={styles.flex}
                >
                  Save
                </Button>
              </View>
            </>
          ) : (
            <>
              <Row label="User ID" value={user?.code || user?.retailerId || user?.adminId || '—'} />
              <Row label="Email" value={user?.email} />
              <Row label="Mobile" value={user?.contactNumber} />
              <Row
                label="Wallet PIN"
                value={<StatusPill status={balances.data?.hasPin ? 'ACTIVE' : 'PENDING'} />}
                last={!isRetailer}
              />
              {isRetailer && (
                <Row
                  label="Merchant eKYC"
                  value={
                    <StatusPill status={merchant.data?.isMerchantKycComplete ? 'COMPLETED' : 'PENDING'} />
                  }
                  last
                />
              )}
              <Button
                variant="outline"
                icon="pencil-outline"
                onPress={() => setEditing(true)}
                style={{ marginTop: space.md }}
                fullWidth
              >
                Edit profile
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="theme-light-dark">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.themeRow}>
            {(['light', 'dark', 'system'] as const).map((option) => {
              const active = theme === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setTheme(option)}
                  style={({ pressed }) => [
                    styles.themeChip,
                    active && styles.themeChipActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option} theme`}
                >
                  <MaterialCommunityIcons
                    name={
                      option === 'light'
                        ? 'white-balance-sunny'
                        : option === 'dark'
                          ? 'weather-night'
                          : 'cellphone-cog'
                    }
                    size={17}
                    color={active ? colors.primaryForeground : colors.foreground}
                  />
                  <Text style={[styles.themeText, active && styles.themeTextActive]}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="lock-outline">Security</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {passwordStep === 0 && (
            <Button variant="outline" icon="key-outline" onPress={() => setPasswordStep(1)} fullWidth>
              Change password
            </Button>
          )}

          {passwordStep === 1 && (
            <>
              <Banner
                tone="info"
                message={`We will email a 6-digit code to ${user?.email ?? 'your registered address'} to confirm it is you.`}
              />
              {!!requestOtp.error && <ErrorBanner message={requestOtp.error} />}
              <View style={styles.actionRow}>
                <Button variant="secondary" onPress={() => setPasswordStep(0)} style={styles.flex}>
                  Cancel
                </Button>
                <Button
                  onPress={async () => {
                    const res = await requestOtp.run();
                    if (res) {
                      setNotice('OTP sent to your email.');
                      setPasswordStep(2);
                    }
                  }}
                  loading={requestOtp.pending}
                  icon="email-outline"
                  style={styles.flex}
                >
                  Send OTP
                </Button>
              </View>
            </>
          )}

          {passwordStep === 2 && (
            <>
              <Input
                label="Email OTP"
                required
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="email-check-outline"
                autoComplete="one-time-code"
                placeholder="6 digits"
              />
              <Input
                label="New password"
                required
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                leftIcon="lock-outline"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword(!showPassword)}
                rightIconLabel={showPassword ? 'Hide password' : 'Show password'}
                helperText="At least 6 characters"
              />
              <Input
                label="Confirm new password"
                required
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                leftIcon="lock-check-outline"
                error={
                  confirmPassword && confirmPassword !== newPassword
                    ? 'Passwords do not match'
                    : undefined
                }
              />
              {!!changePassword.error && <ErrorBanner message={changePassword.error} />}
              <View style={styles.actionRow}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setPasswordStep(0);
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  style={styles.flex}
                >
                  Cancel
                </Button>
                <Button
                  onPress={async () => {
                    const res = await changePassword.run();
                    if (res) {
                      setNotice('Password updated.');
                      setPasswordStep(0);
                      setOtp('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }
                  }}
                  disabled={!passwordValid}
                  loading={changePassword.pending}
                  icon="shield-check-outline"
                  style={styles.flex}
                >
                  Update
                </Button>
              </View>
            </>
          )}
        </CardContent>
      </Card>

      {/* Destructive action kept apart from everything above. */}
      <Button variant="destructive" icon="logout" onPress={confirmLogout} fullWidth>
        Log out
      </Button>
    </Screen>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 58, height: 58, borderRadius: radius.pill },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: c.accentSubtle,
    borderWidth: 1,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: t.h2, fontWeight: '700', color: c.accent },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  userName: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  userRole: { fontSize: t.caption, color: c.mutedForeground },
  tile: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 3,
  },
  tileLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  actionRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  themeRow: { flexDirection: 'row', gap: space.sm },
  themeChip: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  themeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  themeText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  themeTextActive: { color: c.primaryForeground },
}));

export default ProfileScreen;
