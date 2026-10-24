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
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import {
  Screen,
  Banner,
  ErrorBanner,
  Row,
  StatusPill,
  SuccessBanner,
  shortDate,
} from '@/components/ui/Screen';
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { INDIAN_STATES } from '@/constants';
import { useResponsive } from '@/hooks/useResponsive';
import { pickImage, type PickedFile } from '@/services/imagePicker';
import api from '@/services/api';
import { PAYSPRINT_ENABLED } from '@/constants/services';

/** distributorId comes back populated on a retailer and as a plain id elsewhere. */
const distributorLabel = (value: unknown) =>
  typeof value === 'string' ? value : (value as any)?.distributorId || (value as any)?.name;

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
  const [stateOpen, setStateOpen] = useState(false);
  const [photo, setPhoto] = useState<PickedFile | null>(null);

  // Password and PIN share one OTP-gated flow: the code request in step 1 is
  // identical for both, only the fields in step 2 differ.
  const [securityMode, setSecurityMode] = useState<'password' | 'pin'>('password');
  const [passwordStep, setPasswordStep] = useState<0 | 1 | 2>(0);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [showKyc, setShowKyc] = useState(false);
  const [document, setDocument] = useState<{ title: string; uri: string } | null>(null);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const navigation = useNavigation<any>();

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const isRetailer = user?.role === 'retailer';
  const isAdmin = user?.role === 'admin';
  const merchant = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode: user?.retailerId || user?.code })).data,
    [user?.retailerId],
    // PaySprint's merchant status; there is nothing to ask while it is off.
    isRetailer && PAYSPRINT_ENABLED
  );

  const banks = useAsync<any[]>(async () => (await api.getSavedBanks()).data ?? [], [], isRetailer);

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

  const changePin = useAction(async () => {
    const res = await api.changeWalletPin({ otp: otp.trim(), newPin });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const otpValid = otp.trim().length === 6;
  const passwordValid = otpValid && newPassword.length >= 6 && newPassword === confirmPassword;
  const pinValid = otpValid && /^\d{4}$/.test(newPin) && newPin === confirmPin;

  const resetSecurity = () => {
    setPasswordStep(0);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setNewPin('');
    setConfirmPin('');
  };

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

  const userId = user?.retailerId || user?.adminId || distributorLabel(user?.distributorId) || user?.code || '—';
  const initials = (user?.name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const openSecurity = (mode: 'password' | 'pin') => {
    resetSecurity();
    setSecurityMode(mode);
    setPasswordStep(1);
  };

  const firstBank = banks.data?.[0];
  const themeLabel = theme[0].toUpperCase() + theme.slice(1);

  const pickPhoto = () =>
    Alert.alert('Profile photo', 'Choose a source', [
      { text: 'Take a photo', onPress: () => changePhoto.run('camera') },
      { text: 'Pick from gallery', onPress: () => changePhoto.run('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  // Mockup 16: identity centred on the band, no app bar.
  const [showId, setShowId] = useState(false);
  // BHIM's profile header: back, avatar, name, and the masked ID that the eye
  // reveals. Profile opens as a full-screen drawer, so this row is its only
  // way back besides the swipe.
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
        onPress={() => setPersonalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Personal details"
        style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitial}>{initials}</Text>
        )}
      </Pressable>
      <View style={styles.who}>
        <Text style={styles.userName} numberOfLines={1}>
          {user?.name || 'User'}
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
              {masked}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Screen
      refreshing={balances.refreshing}
      onRefresh={() => {
        balances.refresh();
        if (isRetailer) {
          merchant.refresh();
          banks.refresh();
        }
      }}
      error={balances.error}
      onRetry={balances.reload}
      header={band}
    >
      <View style={styles.body}>
        {!!notice && <SuccessBanner message={notice} />}

        {isRetailer && PAYSPRINT_ENABLED && (
          <Pressable
            onPress={() => (kycDone ? navigation.navigate('KycStatus') : setShowKyc(true))}
            style={({ pressed }) => [styles.card, styles.kycCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={kycDone ? 'KYC verified. View KYC status' : 'KYC pending. Complete merchant eKYC'}
          >
            <MaterialCommunityIcons
              name={kycDone ? 'check-decagram' : 'shield-alert'}
              size={28}
              color={kycDone ? colors.success : colors.warning}
            />
            <View style={styles.kycText}>
              <Text style={styles.kycTitle}>{kycDone ? 'KYC verified' : 'KYC pending'}</Text>
              <Text style={styles.kycSubtitle}>
                {kycDone ? 'Merchant eKYC complete' : 'Complete merchant eKYC to unlock AEPS'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.tabBarInactive} />
          </Pressable>
        )}

        <View style={[styles.card, styles.menu]}>
          <MenuRow icon="account-outline" title="Personal details" subtitle="Name, contact and documents" onPress={() => setPersonalOpen(true)} />
          {isRetailer && (
            <MenuRow
              icon="bank-outline"
              title="Settlement bank"
              subtitle={
                firstBank
                  ? `${firstBank.bankName || 'Bank'} ·· ${String(firstBank.accountNumber).slice(-4)}`
                  : banks.data
                    ? 'Add a bank account'
                    : undefined
              }
              onPress={() => navigation.navigate('AepsSettlement')}
            />
          )}
          <MenuRow
            icon="dialpad"
            title="Wallet PIN"
            subtitle={balances.data && !balances.data.hasPin ? 'Not set yet' : 'Change your 4-digit PIN'}
            onPress={() => openSecurity('pin')}
          />
          <MenuRow icon="lock-outline" title="Change password" subtitle="Verified by email OTP" onPress={() => openSecurity('password')} />
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

      <MerchantKycSheet visible={showKyc} onClose={() => setShowKyc(false)} onCompleted={merchant.refresh} />

      {/* Personal details: view, edit and photo — hidden while a document is open over it. */}
      <Sheet
        visible={personalOpen && !document}
        onClose={() => {
          if (editing) cancelEdit();
          setPersonalOpen(false);
        }}
        title="Personal details"
        icon="account-outline"
        footer={
          editing ? (
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
                    setPersonalOpen(false);
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
              <Button variant="outline" icon="camera-outline" onPress={pickPhoto} fullWidth>
                {photo ? 'Photo selected — change' : 'Change profile photo'}
              </Button>
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
            </>
          ) : (
            <>
              <View>
                <Row label="User ID" value={user?.code || user?.retailerId || user?.adminId || '—'} mono />
                <Row label="Email" value={user?.email} />
                <Row label="Mobile" value={user?.contactNumber} mono />
                {isRetailer && !!distributorLabel(user?.distributorId) && (
                  <Row label="Distributor" value={distributorLabel(user?.distributorId)} mono />
                )}
                <Row label="Role" value={(user?.role || 'user').toUpperCase()} />
                <Row label="Status" value={<StatusPill status={user?.isActive === false ? 'INACTIVE' : 'ACTIVE'} />} />
                <Row label="Member since" value={shortDate(user?.createdAt)} />
                <Row label="Business name" value={user?.businessName || '—'} />
                <Row label="Business address" value={user?.businessAddress || '—'} />
                <Row label="City" value={user?.address?.city || '—'} />
                <Row label="District" value={user?.address?.district || '—'} />
                <Row label="State" value={user?.address?.state || '—'} last={!user?.gstNumber} />
                {!!user?.gstNumber && <Row label="GST number" value={user.gstNumber} mono last />}
              </View>
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
                    user?.aadhaarPicture && setDocument({ title: 'Aadhaar document', uri: user.aadhaarPicture })
                  }
                />
                <DocumentTile
                  title="PAN"
                  number={user?.panNumber}
                  uri={user?.panPicture}
                  onPress={() => user?.panPicture && setDocument({ title: 'PAN document', uri: user.panPicture })}
                />
              </View>
            </>
          )}
        </View>
      </Sheet>

      {/* Password and PIN share one OTP-gated flow. */}
      <Sheet
        visible={passwordStep > 0}
        onClose={resetSecurity}
        dismissible={!(requestOtp.pending || changePassword.pending || changePin.pending)}
        title={securityMode === 'pin' ? 'Wallet PIN' : 'Change password'}
        icon={securityMode === 'pin' ? 'form-textbox-password' : 'lock-outline'}
        footer={
          passwordStep === 1 ? (
            <Button
              onPress={async () => {
                const res = await requestOtp.run();
                if (res) setPasswordStep(2);
              }}
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
                  setNotice(isPin ? 'Wallet PIN updated.' : 'Password updated.');
                  resetSecurity();
                }
              }}
              disabled={securityMode === 'pin' ? !pinValid : !passwordValid}
              loading={changePassword.pending || changePin.pending}
              icon="shield-check-outline"
              fullWidth
            >
              Update
            </Button>
          )
        }
      >
        <View style={styles.form}>
          {passwordStep === 1 ? (
            <>
              <Banner
                tone="info"
                message={`We will email a 6-digit code to ${user?.email ?? 'your registered address'} to confirm it is you.`}
              />
              {!!requestOtp.error && <ErrorBanner message={requestOtp.error} />}
            </>
          ) : (
            <>
              <SuccessBanner message="OTP sent to your email." />
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
              {securityMode === 'password' ? (
                <>
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
                      confirmPassword && confirmPassword !== newPassword ? 'Passwords do not match' : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <Input
                    label="New wallet PIN"
                    required
                    value={newPin}
                    onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                    secureTextEntry={!showPassword}
                    keyboardType="number-pad"
                    maxLength={4}
                    leftIcon="dialpad"
                    rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onRightIconPress={() => setShowPassword(!showPassword)}
                    rightIconLabel={showPassword ? 'Hide PIN' : 'Show PIN'}
                    helperText="4 digits — approves wallet transfers, DMT and settlements"
                  />
                  <Input
                    label="Confirm new PIN"
                    required
                    value={confirmPin}
                    onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
                    secureTextEntry={!showPassword}
                    keyboardType="number-pad"
                    maxLength={4}
                    leftIcon="dialpad"
                    error={confirmPin && confirmPin !== newPin ? 'PINs do not match' : undefined}
                  />
                </>
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
