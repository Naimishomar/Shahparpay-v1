import React, { useState } from 'react';
import { View, Text, Image, Pressable, Alert, Linking } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import { BrandMark } from '@/components/ui/BrandMark';
import Constants from 'expo-constants';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import {
  Screen,
  Banner,
  ErrorBanner,
  Row,
  SuccessBanner,
} from '@/components/ui/Screen';
import { useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useResponsive } from '@/hooks/useResponsive';
import { pickImage } from '@/services/imagePicker';
import api from '@/services/api';
import { aepsKycDone } from '@/constants/services';

/** distributorId comes back populated on a retailer and as a plain id elsewhere. */
const distributorLabel = (value: unknown) =>
  typeof value === 'string' ? value : (value as any)?.distributorId || (value as any)?.name;

/** Same masking as web's getMaskedEmail: last 3 of the local part, max 5 stars. */
const maskEmail = (email: string) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `***@${domain}`;
  return `${'*'.repeat(Math.min(local.length - 3, 5))}${local.slice(-3)}@${domain}`;
};

export const ProfileScreen: React.FC = () => {
  const { user, logout, checkSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const { padding } = useResponsive();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [businessName, setBusinessName] = useState(user?.businessName ?? '');
  const [city, setCity] = useState(user?.address?.city ?? '');
  const [district, setDistrict] = useState(user?.address?.district ?? '');
  const [state, setState] = useState(user?.address?.state ?? '');

  // Password and PIN share one OTP-gated flow (same as web): step 1 confirms
  // the registered email and sends the code, step 2 takes OTP + new value.
  const [securityMode, setSecurityMode] = useState<'password' | 'pin'>('password');
  const [passwordStep, setPasswordStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [document, setDocument] = useState<{ title: string; uri: string } | null>(null);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const navigation = useNavigation<any>();

  const isRetailer = user?.role === 'retailer';
  // Web: non-retailers are always verified; retailers by their AEPS KYC step.
  const kycComplete = !isRetailer || aepsKycDone(user);

  const saveProfile = useAction(async () => {
    const res = await api.updateProfile({
      name,
      contactNumber,
      businessName,
      address: { city, district, state },
    });
    if (!res.success) throw new Error(res.message || 'Failed to update profile');
    return res;
  });

  // Web uploads the photo on its own as soon as it is picked.
  const changePhoto = useAction(async (source: 'library' | 'camera') => {
    const picked = await pickImage(source, 'profile-photo');
    if (!picked) return null;
    const res = await api.updateProfileWithPhoto({}, picked);
    if (!res.success) throw new Error(res.message || 'Failed to update profile picture');
    setNotice('Profile picture updated successfully!');
    await checkSession();
    return res;
  });

  const requestOtp = useAction(async () => {
    const res = await api.sendPasswordOtp();
    if (!res.success) throw new Error(res.message || 'Failed to send OTP');
    return res;
  });

  const changePassword = useAction(async () => {
    const res = await api.changePassword({ email: user?.email ?? '', otp, newPassword });
    if (!res.success) throw new Error(res.message || 'Failed to change password');
    return res;
  });

  const changePin = useAction(async () => {
    const res = await api.changeWalletPin({ otp, newPin });
    if (!res.success) throw new Error(res.message || 'Failed to change PIN');
    return res;
  });

  const step2Valid =
    otp.length === 6 && (securityMode === 'pin' ? newPin.length === 4 : newPassword.length >= 6);

  const resetSecurity = () => {
    setPasswordStep(0);
    setEmail('');
    setEmailError('');
    setOtp('');
    setNewPassword('');
    setNewPin('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setName(user?.name ?? '');
    setContactNumber(user?.contactNumber ?? '');
    setBusinessName(user?.businessName ?? '');
    setCity(user?.address?.city ?? '');
    setDistrict(user?.address?.district ?? '');
    setState(user?.address?.state ?? '');
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need your password and an email OTP to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'This device', style: 'destructive', onPress: () => logout(false) },
      { text: 'All devices', style: 'destructive', onPress: () => logout(true) },
    ]);

  const avatarUri = user?.profilePicture;
  const distributorCode = isRetailer ? distributorLabel(user?.distributorId) : undefined;
  const addressLine = [user?.address?.city, user?.address?.district, user?.address?.state]
    .filter(Boolean)
    .join(', ');

  const userId = user?.retailerId || user?.adminId || distributorLabel(user?.distributorId) || user?.code || '—';
  const initials = user?.name?.charAt(0) || 'U';

  const openSecurity = (mode: 'password' | 'pin') => {
    resetSecurity();
    setSecurityMode(mode);
    setPasswordStep(1);
  };

  const themeLabel = theme[0].toUpperCase() + theme.slice(1);

  const pickPhoto = () =>
    Alert.alert('Update profile photo', 'Choose a source', [
      { text: 'Take a photo', onPress: () => changePhoto.run('camera') },
      { text: 'Pick from gallery', onPress: () => changePhoto.run('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  // Mockup 16: identity centred on the band, no app bar.
  const [showId, setShowId] = useState(false);
  const masked = userId ? (showId ? userId : `${String(userId).slice(0, 2)}••••${String(userId).slice(-2)}`) : '';
  const band = (
    <View style={[styles.band, { paddingHorizontal: padding }]}>
      <Pressable
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Close profile"
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={26} color={colors.foreground} />
      </Pressable>
      <Pressable
        onPress={pickPhoto}
        disabled={changePhoto.pending}
        accessibilityRole="button"
        accessibilityLabel="Update profile photo"
        style={({ pressed }) => [styles.avatar, (pressed || changePhoto.pending) && { opacity: 0.6 }]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitial}>{initials}</Text>
        )}
      </Pressable>
      <View style={styles.who}>
        <Text style={styles.userName} numberOfLines={1}>
          {user?.name || 'Retailer Name'}
        </Text>
        {!!user?.email && (
          <Text style={styles.userMeta} numberOfLines={1}>
            {user.email}
          </Text>
        )}
        <Text style={styles.userMeta} numberOfLines={1}>
          {(user?.role || 'Retailer').toUpperCase()}
          {distributorCode ? ` · ${distributorCode}` : ''}
        </Text>
        {!!userId && (
          <Pressable
            onPress={() => setShowId((v) => !v)}
            style={styles.idRow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showId ? 'Hide user ID' : 'Show user ID'}
          >
            <MaterialCommunityIcons
              name={showId ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.mutedForeground}
            />
            <Text style={styles.userMeta} numberOfLines={1}>
              ID {masked}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Screen refreshing={false} onRefresh={checkSession} header={band}>
      <View style={styles.body}>
        {!!notice && <SuccessBanner message={notice} />}
        {!!changePhoto.error && <ErrorBanner message={changePhoto.error} />}

        <View style={[styles.card, styles.kycCard]}>
          <MaterialCommunityIcons
            name={kycComplete ? 'check-decagram' : 'shield-alert'}
            size={28}
            color={kycComplete ? colors.success : colors.warning}
          />
          <View style={styles.kycText}>
            <Text style={styles.kycTitle}>
              KYC status · <Text style={{ color: kycComplete ? colors.success : colors.warning }}>{kycComplete ? 'Verified' : 'Pending'}</Text>
            </Text>
            <Text style={styles.kycSubtitle}>
              {kycComplete
                ? 'Your account is fully verified and unrestricted.'
                : 'Complete your KYC to unlock all features.'}
            </Text>
          </View>
        </View>
        {!kycComplete && (
          // AEPS KYC is the Icchhamati onboarding, which runs step by step on the AEPS screen.
          <Button onPress={() => navigation.navigate('AEPS')} fullWidth>
            Complete now
          </Button>
        )}

        <View style={[styles.card, styles.menu]}>
          <MenuRow icon="account-outline" title="Personal details" subtitle="Personal information, business details and identity documents" onPress={() => setPersonalOpen(true)} />
          <MenuRow icon="lock-outline" title="Change password" subtitle="Update your sign-in credentials" onPress={() => openSecurity('password')} />
          <MenuRow icon="dialpad" title="Change wallet PIN" subtitle="4-digit PIN for DMT and settlements" onPress={() => openSecurity('pin')} />
        </View>

        <View style={[styles.card, styles.menu]}>
          <MenuRow
            icon="theme-light-dark"
            title="Appearance"
            subtitle={themeLabel}
            onPress={() => setThemeOpen(true)}
          />
          <MenuRow icon="help-circle-outline" title="Help & support" subtitle="Raise or track a ticket" onPress={() => navigation.navigate('Support')} />
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.card, styles.logout, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={24} color={colors.destructive} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <View style={styles.footer} accessibilityRole="text">
          <BrandMark size={20} color={colors.foreground} />
          <Text style={styles.footerBrand}>Shahparpay</Text>
          <Text style={styles.footerVersion}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>

      {/* Personal details: view and edit — hidden while a document is open over it. */}
      <Sheet
        visible={personalOpen && !document}
        onClose={() => {
          if (editing) cancelEdit();
          setPersonalOpen(false);
        }}
        title="Personal information"
        icon="account-outline"
        footer={
          editing ? (
            <View style={styles.actionRow}>
              <Button variant="secondary" onPress={cancelEdit} disabled={saveProfile.pending} style={styles.flex}>
                Cancel
              </Button>
              <Button
                onPress={async () => {
                  const res = await saveProfile.run();
                  if (res) {
                    setNotice('Profile updated successfully!');
                    setEditing(false);
                    setPersonalOpen(false);
                    checkSession();
                  }
                }}
                loading={saveProfile.pending}
                icon="content-save-outline"
                style={styles.flex}
              >
                Save changes
              </Button>
            </View>
          ) : (
            <Button variant="outline" icon="pencil-outline" onPress={() => setEditing(true)} fullWidth>
              Edit profile
            </Button>
          )
        }
      >
        <View style={styles.form}>
          {editing ? (
            <>
              <Input label="Full name" value={name} onChangeText={setName} leftIcon="account-outline" />
              <Input
                label="Email address (not editable)"
                value={user?.email}
                editable={false}
                disabled
                leftIcon="email-outline"
              />
              <Input
                label="Contact number"
                value={contactNumber}
                onChangeText={setContactNumber}
                keyboardType="phone-pad"
                leftIcon="phone-outline"
                autoComplete="tel"
              />
              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                leftIcon="storefront-outline"
              />
              <Input label="Registered address" placeholder="City" value={city} onChangeText={setCity} leftIcon="city-variant-outline" />
              <Input placeholder="District" value={district} onChangeText={setDistrict} leftIcon="map-outline" />
              <Input placeholder="State" value={state} onChangeText={setState} leftIcon="map-marker-outline" />
              {!!saveProfile.error && <ErrorBanner message={saveProfile.error} />}
            </>
          ) : (
            <>
              <View>
                <Row label="Full name" value={user?.name || 'N/A'} />
                <Row label="Email address" value={user?.email || 'N/A'} />
                <Row label="Contact number" value={user?.contactNumber || 'N/A'} mono />
                <Row label="Business name" value={user?.businessName || 'N/A'} />
                <Row label="Registered address" value={addressLine || 'N/A'} last />
              </View>
              <Text style={styles.sectionLabel}>Identity documents</Text>
              <View style={styles.documentStack}>
                <DocumentTile
                  title="Aadhaar"
                  number={user?.aadhaarNumber}
                  uri={user?.aadhaarPicture}
                  onPress={() => user?.aadhaarPicture && setDocument({ title: 'Aadhaar', uri: user.aadhaarPicture })}
                />
                <DocumentTile
                  title="PAN"
                  number={user?.panNumber}
                  uri={user?.panPicture}
                  onPress={() => user?.panPicture && setDocument({ title: 'PAN', uri: user.panPicture })}
                />
              </View>
              <Banner
                tone="info"
                message="Identity details can't be changed here. Contact support for help with KYC details."
              />
            </>
          )}
        </View>
      </Sheet>

      {/* Password and PIN share one OTP-gated flow. */}
      <Sheet
        visible={passwordStep > 0}
        onClose={resetSecurity}
        dismissible={!(requestOtp.pending || changePassword.pending || changePin.pending)}
        title={securityMode === 'pin' ? 'Change wallet PIN' : 'Change password'}
        subtitle={
          passwordStep === 1
            ? 'Verify your identity to proceed.'
            : securityMode === 'pin'
              ? 'Enter the OTP and your new 4-digit PIN.'
              : 'Enter the OTP and your new password.'
        }
        icon={securityMode === 'pin' ? 'form-textbox-password' : 'lock-outline'}
        footer={
          passwordStep === 1 ? (
            <Button
              onPress={async () => {
                setEmailError('');
                if (email !== user?.email) {
                  setEmailError('Incorrect email address');
                  return;
                }
                const res = await requestOtp.run();
                if (res) setPasswordStep(2);
              }}
              disabled={!email}
              loading={requestOtp.pending}
              icon="email-outline"
              fullWidth
            >
              Send OTP
            </Button>
          ) : (
            <Button
              onPress={async () => {
                const isPin = securityMode === 'pin';
                const res = isPin ? await changePin.run() : await changePassword.run();
                if (res) {
                  setNotice(isPin ? 'Wallet PIN changed successfully!' : 'Password changed successfully!');
                  resetSecurity();
                }
              }}
              disabled={!step2Valid}
              loading={changePassword.pending || changePin.pending}
              icon="shield-check-outline"
              fullWidth
            >
              {securityMode === 'pin' ? 'Change PIN' : 'Change password'}
            </Button>
          )
        }
      >
        <View style={styles.form}>
          {passwordStep === 1 ? (
            <>
              <Input
                label="Registered email"
                helperText={`Hint: ${maskEmail(user?.email || '')}`}
                value={email}
                onChangeText={setEmail}
                placeholder="Full email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon="email-outline"
                error={emailError || undefined}
              />
              {!!requestOtp.error && <ErrorBanner message={requestOtp.error} />}
            </>
          ) : (
            <>
              <SuccessBanner message="OTP sent to your email" />
              <Input
                label="OTP"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="email-check-outline"
                autoComplete="one-time-code"
                placeholder="6-digit OTP"
              />
              {securityMode === 'password' ? (
                <Input
                  label="New password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry={!showPassword}
                  leftIcon="lock-outline"
                  rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  rightIconLabel={showPassword ? 'Hide password' : 'Show password'}
                />
              ) : (
                <Input
                  label="New wallet PIN"
                  value={newPin}
                  onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4 digits"
                  secureTextEntry={!showPassword}
                  keyboardType="number-pad"
                  maxLength={4}
                  leftIcon="dialpad"
                  rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  rightIconLabel={showPassword ? 'Hide PIN' : 'Show PIN'}
                />
              )}
              {!!changePassword.error && <ErrorBanner message={changePassword.error} />}
              {!!changePin.error && <ErrorBanner message={changePin.error} />}
            </>
          )}
        </View>
      </Sheet>

      <Sheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="Appearance" icon="theme-light-dark">
        <View style={styles.themeRow}>
          {(['light', 'dark', 'system'] as const).map((option) => {
            const active = theme === option;
            return (
              <Pressable
                key={option}
                onPress={() => setTheme(option)}
                style={({ pressed }) => [styles.themeChip, active && styles.themeChipActive, pressed && { opacity: 0.75 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option} theme`}
              >
                <MaterialCommunityIcons
                  name={option === 'light' ? 'white-balance-sunny' : option === 'dark' ? 'weather-night' : 'cellphone-cog'}
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
      </Sheet>

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

/** Mockup menu row: 40px rounded-square chip, title, optional sub-line, chevron. */
/** BHIM's menu row: a grey circle with a line icon, title and hint, chevron. */
const MenuRow: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
    accessibilityRole="button"
    accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
  >
    <IconTile icon={icon} size={48} iconSize={22} />
    <View style={styles.menuText}>
      <Text style={styles.menuTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
  </Pressable>
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
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  back: { width: 40, height: 44, justifyContent: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 20, fontWeight: '600', color: c.foreground },
  who: { flex: 1, minWidth: 0, gap: 4 },
  userName: { fontSize: t.title + 1, fontWeight: '500', color: c.foreground },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  userMeta: { fontSize: t.body, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  body: { gap: space.lg, paddingTop: space.xs },
  card: { backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border },
  kycCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  kycText: { flex: 1, minWidth: 0, gap: 2 },
  kycTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  kycSubtitle: { fontSize: t.small, color: c.mutedForeground },
  menu: { paddingVertical: space.xs, paddingHorizontal: space.lg },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 72 },
  menuText: { flex: 1, minWidth: 0, gap: 3 },
  menuTitle: { fontSize: t.bodyLg, fontWeight: '400', color: c.foreground },
  menuSubtitle: { fontSize: t.small, color: c.mutedForeground },
  logout: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  logoutText: { fontSize: t.bodyLg, fontWeight: '500', color: c.destructive },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl },
  footerBrand: { fontSize: t.body, fontWeight: '700', color: c.foreground, letterSpacing: 0.3 },
  footerVersion: { fontSize: t.body, color: c.mutedForeground, marginLeft: space.sm },
  form: { gap: space.lg },
  actionRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  picker: { borderRadius: radius.md, backgroundColor: c.secondary, padding: space.xs },
  pickerItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  documentStack: { gap: space.sm },
  sectionLabel: { fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
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
  // One pill track, like the mockup's segmented control.
  themeRow: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
  },
  themeChip: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
  },
  themeChipActive: { backgroundColor: c.primary },
  themeText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  themeTextActive: { color: c.primaryForeground },
}));

export default ProfileScreen;
