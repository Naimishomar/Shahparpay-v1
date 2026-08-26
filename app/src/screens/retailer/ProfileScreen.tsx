import React, { useState } from 'react';
import { View, Text, Image, Pressable, Alert, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import {
  Screen,
  Banner,
  ErrorBanner,
  Row,
  StatusPill,
  SuccessBanner,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { INDIAN_STATES } from '@/constants';
import { pickImage, type PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

/** distributorId comes back populated on a retailer and as a plain id elsewhere. */
const distributorLabel = (value: unknown) =>
  typeof value === 'string' ? value : (value as any)?.distributorId || (value as any)?.name;

export const ProfileScreen: React.FC = () => {
  const { user, logout, checkSession } = useAuth();
  const { theme, setTheme } = useTheme();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [businessName, setBusinessName] = useState(user?.businessName ?? '');
  const [city, setCity] = useState(user?.address?.city ?? '');
  const [district, setDistrict] = useState(user?.address?.district ?? '');
  const [state, setState] = useState(user?.address?.state ?? '');
  const [stateOpen, setStateOpen] = useState(false);
  const [photo, setPhoto] = useState<PickedFile | null>(null);

  const [passwordStep, setPasswordStep] = useState<0 | 1 | 2>(0);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [showKyc, setShowKyc] = useState(false);
  const [document, setDocument] = useState<{ title: string; uri: string } | null>(null);

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const isRetailer = user?.role === 'retailer';
  const merchant = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode: user?.retailerId || user?.code })).data,
    [user?.retailerId],
    isRetailer
  );

  const kycDone = !isRetailer || !!merchant.data?.isMerchantKycComplete;

  const saveProfile = useAction(async () => {
    const payload = {
      name: name.trim(),
      contactNumber: contactNumber.trim(),
      businessName: businessName.trim(),
      address: { city: city.trim(), district: district.trim(), state: state.trim() },
    };
    // The photo makes this multipart; without one a plain JSON PUT is cheaper.
    const res = photo
      ? await api.updateProfileWithPhoto(payload, photo)
      : await api.updateProfile(payload);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const changePhoto = useAction(async (source: 'library' | 'camera') => {
    const picked = await pickImage(source, 'profile-photo');
    if (picked) setPhoto(picked);
    return picked;
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

  const cancelEdit = () => {
    setEditing(false);
    setPhoto(null);
    setName(user?.name ?? '');
    setContactNumber(user?.contactNumber ?? '');
    setBusinessName(user?.businessName ?? '');
    setCity(user?.address?.city ?? '');
    setDistrict(user?.address?.district ?? '');
    setState(user?.address?.state ?? '');
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need your password and an email OTP to sign back in.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  const avatarUri = photo?.uri || user?.profilePicture;

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
          <Pressable
            onPress={() =>
              editing
                ? Alert.alert('Profile photo', 'Choose a source', [
                    { text: 'Take a photo', onPress: () => changePhoto.run('camera') },
                    { text: 'Pick from gallery', onPress: () => changePhoto.run('library') },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                : setEditing(true)
            }
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Change profile photo' : 'Edit profile'}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarBadge}>
                <MaterialCommunityIcons name="camera" size={13} color={colors.primaryForeground} />
              </View>
            )}
          </Pressable>

          <View style={styles.profileText}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{(user?.role || 'user').toUpperCase()}</Text>
              </View>
              <StatusPill status={user?.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
            </View>
            <Text style={styles.userMeta} numberOfLines={1}>
              ID {user?.retailerId || user?.adminId || distributorLabel(user?.distributorId) || user?.code || '—'}
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* Full width rather than a two-up grid: an amount is the thing being
          read here, and a wide row lets it sit at the end of the line where
          the eye lands, instead of shrinking to fit half a screen. */}
      <View style={styles.walletStack}>
        {user?.role === 'admin' ? (
          <Tile
            icon="shield-account"
            label="Admin wallet"
            value={money(balances.data?.adminBalance)}
          />
        ) : (
          <>
            <Tile
              icon="fingerprint"
              label="AEPS wallet"
              value={money(balances.data?.aepsBalance)}
            />
            <Tile icon="wallet" label="Main wallet" value={money(balances.data?.mainBalance)} />
          </>
        )}
      </View>

      {!!notice && <SuccessBanner message={notice} />}

      {isRetailer && (
        <Card variant={kycDone ? 'default' : 'flat'}>
          <CardContent style={styles.kycCard}>
            <View style={[styles.kycIcon, kycDone ? styles.kycIconDone : styles.kycIconPending]}>
              <MaterialCommunityIcons
                name={kycDone ? 'shield-check' : 'shield-alert-outline'}
                size={24}
                color={kycDone ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.kycText}>
              <Text style={styles.kycTitle}>{kycDone ? 'KYC verified' : 'KYC pending'}</Text>
              <Text style={styles.kycSubtitle}>
                {kycDone
                  ? 'Your merchant account is fully verified and unrestricted.'
                  : 'Complete merchant eKYC to unlock AEPS transactions.'}
              </Text>
            </View>
            {!kycDone && (
              <Button size="sm" icon="arrow-right" onPress={() => setShowKyc(true)}>
                Complete
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="account-details-outline">Personal information</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {editing ? (
            <>
              <Input label="Full name" value={name} onChangeText={setName} leftIcon="account-outline" />
              <Input
                label="Email address"
                value={user?.email}
                editable={false}
                disabled
                leftIcon="email-outline"
                helperText="Email cannot be changed. Contact support if it is wrong."
              />
              <Input
                label="Contact number"
                value={contactNumber}
                onChangeText={(v) => setContactNumber(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                leftIcon="phone-outline"
                autoComplete="tel"
              />
            </>
          ) : (
            <>
              <Row label="User ID" value={user?.code || user?.retailerId || user?.adminId || '—'} mono />
              <Row label="Email" value={user?.email} />
              <Row label="Mobile" value={user?.contactNumber} mono />
              {isRetailer && !!distributorLabel(user?.distributorId) && (
                <Row label="Distributor" value={distributorLabel(user?.distributorId)} mono />
              )}
              <Row
                label="Wallet PIN"
                value={<StatusPill status={balances.data?.hasPin ? 'ACTIVE' : 'PENDING'} />}
              />
              <Row label="Member since" value={shortDate(user?.createdAt)} last />
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
          <CardTitle icon="storefront-outline">Business details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {editing ? (
            <>
              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                leftIcon="storefront-outline"
              />
              <Input label="City" value={city} onChangeText={setCity} leftIcon="city-variant-outline" />
              <Input label="District" value={district} onChangeText={setDistrict} leftIcon="map-outline" />
              <SelectField
                label="State"
                value={state}
                placeholder="Select your state"
                open={stateOpen}
                onPress={() => setStateOpen(!stateOpen)}
              />
              {stateOpen && (
                <View style={styles.picker}>
                  {INDIAN_STATES.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setState(option);
                        setStateOpen(false);
                      }}
                      style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {!!saveProfile.error && <ErrorBanner message={saveProfile.error} />}
              <View style={styles.actionRow}>
                <Button variant="secondary" onPress={cancelEdit} style={styles.flex}>
                  Cancel
                </Button>
                <Button
                  onPress={async () => {
                    const res = await saveProfile.run();
                    if (res) {
                      setNotice('Profile updated.');
                      setEditing(false);
                      setPhoto(null);
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
              <Row label="Business name" value={user?.businessName || '—'} />
              <Row label="Business address" value={user?.businessAddress || '—'} />
              <Row label="City" value={user?.address?.city || '—'} />
              <Row label="District" value={user?.address?.district || '—'} />
              <Row label="State" value={user?.address?.state || '—'} last={!user?.gstNumber} />
              {!!user?.gstNumber && <Row label="GST number" value={user.gstNumber} mono last />}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="shield-account-outline">Identity documents</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Banner
            tone="info"
            message="Identity details cannot be edited here. Contact support to correct your KYC records."
          />
          <View style={styles.documentStack}>
            <DocumentTile
              title="Aadhaar"
              number={user?.aadhaarNumber}
              uri={user?.aadhaarPicture}
              onPress={() =>
                user?.aadhaarPicture &&
                setDocument({ title: 'Aadhaar document', uri: user.aadhaarPicture })
              }
            />
            <DocumentTile
              title="PAN"
              number={user?.panNumber}
              uri={user?.panPicture}
              onPress={() =>
                user?.panPicture && setDocument({ title: 'PAN document', uri: user.panPicture })
              }
            />
          </View>
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

      <MerchantKycSheet
        visible={showKyc}
        onClose={() => setShowKyc(false)}
        onCompleted={merchant.refresh}
      />

      <Sheet
        visible={!!document}
        onClose={() => setDocument(null)}
        title={document?.title ?? ''}
        icon="file-image-outline"
        footer={
          <Button
            variant="outline"
            icon="open-in-new"
            onPress={() => document && Linking.openURL(document.uri)}
            fullWidth
          >
            Open in browser
          </Button>
        }
      >
        {!!document && (
          <Image
            source={{ uri: document.uri }}
            style={styles.documentFull}
            resizeMode="contain"
            accessibilityLabel={document.title}
          />
        )}
      </Sheet>
    </Screen>
  );
};

const Tile: React.FC<{ icon: string; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <View style={styles.tile}>
    <View style={styles.tileIcon}>
      <MaterialCommunityIcons name={icon as any} size={18} color={colors.accent} />
    </View>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

/** Masked number + tappable thumbnail, or an explicit "not uploaded" state. */
const DocumentTile: React.FC<{
  title: string;
  number?: string;
  uri?: string;
  onPress: () => void;
}> = ({ title, number, uri, onPress }) => (
  <View style={styles.document}>
    {uri ? (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${title} document`}
        style={({ pressed }) => [styles.documentThumbWrap, pressed && { opacity: 0.8 }]}
      >
        <Image source={{ uri }} style={styles.documentThumb} resizeMode="cover" />
        <View style={styles.documentOverlay}>
          <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
        </View>
      </Pressable>
    ) : (
      <View style={[styles.documentThumbWrap, styles.documentEmpty]}>
        <MaterialCommunityIcons name="file-hidden" size={20} color={colors.mutedForeground} />
      </View>
    )}
    <View style={styles.documentText}>
      <Text style={styles.documentTitle}>{title}</Text>
      <Text style={styles.documentNumber} selectable numberOfLines={1}>
        {number || 'Not provided'}
      </Text>
      <Text style={styles.documentHint}>{uri ? 'Tap to view' : 'Not uploaded'}</Text>
    </View>
    {!!uri && (
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
    )}
  </View>
);

const styles = themed((c) => ({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatarWrap: { width: 62, height: 62 },
  avatar: { width: 62, height: 62, borderRadius: radius.pill },
  avatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: c.accentSubtle,
    borderWidth: 1,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: t.h2, fontWeight: '700', color: c.accent },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, minWidth: 0, gap: 5 },
  userName: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  roleBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: c.accentSubtle,
  },
  roleText: { fontSize: t.micro, fontWeight: '700', color: c.accent, letterSpacing: 0.3 },
  userMeta: { fontSize: t.caption, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  walletStack: { gap: space.sm },
  // A row, not a block: label reads from the left, amount lands on the right
  // edge where the eye already is when comparing two balances.
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { flex: 1, fontSize: t.small, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  kycCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  kycIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycIconDone: { backgroundColor: c.successSubtle },
  kycIconPending: { backgroundColor: c.warningSubtle },
  kycText: { flex: 1, minWidth: 0, gap: 2 },
  kycTitle: { fontSize: t.body, fontWeight: '700', color: c.foreground },
  kycSubtitle: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 17 },
  form: { gap: space.lg },
  actionRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  picker: { borderRadius: radius.md, backgroundColor: c.secondary, padding: space.xs },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  documentStack: { gap: space.sm },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  documentText: { flex: 1, minWidth: 0, gap: 2 },
  documentTitle: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  documentNumber: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  documentHint: { fontSize: t.micro, color: c.mutedForeground },
  documentThumbWrap: { width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden' },
  documentThumb: { width: '100%', height: '100%' },
  documentOverlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 11, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentEmpty: {
    backgroundColor: c.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentFull: { width: '100%', height: 320, borderRadius: radius.md, backgroundColor: c.secondary },
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
