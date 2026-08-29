import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { ImageField } from '@/components/ui/ImageField';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, SuccessBanner } from '@/components/ui/Screen';
import { useAction } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

/** Commission packages the backend stores verbatim against each service. */
const PACKAGES = ['Standard', 'Premium'];

const SERVICE_PACKAGES = [
  { key: 'dmtPackage', label: 'DMT' },
  { key: 'rechargePackage', label: 'Recharge' },
  { key: 'aepsPackage', label: 'AEPS' },
  { key: 'bbpsPackage', label: 'BBPS' },
  { key: 'payoutPackage', label: 'Payout' },
  { key: 'cmsPackage', label: 'CMS' },
  { key: 'ccpayPackage', label: 'CCPay' },
  { key: 'payinPackage', label: 'Payin' },
  { key: 'upiPackage', label: 'UPI' },
] as const;

const PREFIXES = ['Mr', 'Mrs', 'Miss'];

const STEPS = ['Identity', 'Business', 'Documents', 'Packages'] as const;

const AADHAAR_RE = /^[2-9][0-9]{11}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export type MemberKind = 'retailer' | 'distributor';

const KIND = {
  retailer: {
    title: 'Onboard retailer',
    subtitle: 'Creates a retailer under your distributor account',
    idLabel: 'Retailer ID',
    prefix: 'RT',
    create: (data: Record<string, any>, files: any) => api.createRetailer(data, files),
  },
  distributor: {
    title: 'Onboard distributor',
    subtitle: 'Creates a distributor on the platform',
    idLabel: 'Distributor ID',
    prefix: 'DT',
    create: (data: Record<string, any>, files: any) => api.createDistributor(data, files),
  },
} as const;

/**
 * Network onboarding, shared by the distributor portal (creates retailers) and
 * the admin portal (creates distributors). The backend takes the same
 * multipart body for both, so only the endpoint and the ID prefix differ.
 *
 * Split into four steps because the full form is ~30 fields; each step is
 * validated before the next unlocks, so errors surface next to their cause
 * rather than in one wall at submit time.
 */
export const OnboardMemberSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  kind: MemberKind;
  onCreated: () => void;
}> = ({ visible, onClose, kind, onCreated }) => {
  const spec = KIND[kind];

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // Generated once per sheet open. The backend accepts it verbatim as the
  // merchant code, so it must not change between steps.
  const [merchantCode] = useState(
    () => `${spec.prefix}${Math.floor(100000 + Math.random() * 900000)}`
  );

  const [prefix, setPrefix] = useState('Mr');
  const [prefixOpen, setPrefixOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExistingMerchant, setIsExistingMerchant] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [gstNumber, setGstNumber] = useState('');

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarPicture, setAadhaarPicture] = useState<PickedFile | null>(null);
  const [panPicture, setPanPicture] = useState<PickedFile | null>(null);
  const [profilePicture, setProfilePicture] = useState<PickedFile | null>(null);

  const [packages, setPackages] = useState<Record<string, string>>({});
  const [openPackage, setOpenPackage] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [companyRegisterName, setCompanyRegisterName] = useState('');
  const [website, setWebsite] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMobile, setSupportMobile] = useState('');

  const sendOtp = useAction(async () => {
    const res = await api.sendVerificationOtp(email.trim(), `${firstName} ${lastName}`.trim());
    if (!res.success) throw new Error(res.message || 'Could not send the verification email.');
    setOtpSent(true);
    return res;
  });

  const verifyOtp = useAction(async () => {
    const res = await api.verifyEmailOtp(email.trim(), emailOtp.trim());
    if (!res.success) throw new Error(res.message || 'That code did not match.');
    setEmailVerified(true);
    return res;
  });

  const create = useAction(async () => {
    const res = await spec.create(
      {
        merchantCode,
        prefix,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim(),
        password,
        dob,
        otp: emailOtp.trim(),
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        // Nested field: multer flattens the form, so the controller parses this.
        address: JSON.stringify({
          city: city.trim(),
          district: district.trim(),
          state,
          landmark: landmark.trim(),
        }),
        aadhaarNumber: aadhaarNumber.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        hasGst,
        gstNumber: hasGst ? gstNumber.trim().toUpperCase() : '',
        brandName: brandName.trim(),
        companyRegisterName: companyRegisterName.trim(),
        website: website.trim(),
        supportEmail: supportEmail.trim(),
        supportMobile: supportMobile.trim(),
        ...(kind === 'retailer' ? { isExistingMerchant } : {}),
        ...packages,
      },
      {
        aadhaarPicture: aadhaarPicture ?? undefined,
        panPicture: panPicture ?? undefined,
        profilePicture: profilePicture ?? undefined,
      }
    );
    if (!res.success) throw new Error(res.message || `Could not create the ${kind}.`);
    setDone(true);
    onCreated();
    return res;
  });

  const errors = useMemo(() => {
    const identity =
      !firstName.trim()
        ? 'Enter the first name.'
        : !lastName.trim()
          ? 'Enter the last name.'
          : !EMAIL_RE.test(email.trim())
            ? 'Enter a valid email address.'
            : !emailVerified
              ? 'Verify the email address with the code we sent.'
              : contactNumber.length !== 10
                ? 'Enter a 10-digit mobile number.'
                : !dob
                  ? 'Enter the date of birth as YYYY-MM-DD.'
                  : password.length < 6
                    ? 'Set a password of at least 6 characters.'
                    : null;

    const business =
      !businessName.trim()
        ? 'Enter the business name.'
        : !businessAddress.trim()
          ? 'Enter the street address.'
          : !city.trim()
            ? 'Enter the city.'
            : !district.trim()
              ? 'Enter the district.'
              : !state
                ? 'Select the state.'
                : hasGst && gstNumber.trim().length !== 15
                  ? 'A GST number is 15 characters.'
                  : null;

    const documents =
      !AADHAAR_RE.test(aadhaarNumber.trim())
        ? 'Enter a valid 12-digit Aadhaar number.'
        : !PAN_RE.test(panNumber.trim().toUpperCase())
          ? 'Enter a valid PAN, e.g. ABCDE1234F.'
          : !aadhaarPicture
            ? 'Attach a photo of the Aadhaar card.'
            : !panPicture
              ? 'Attach a photo of the PAN card.'
              : null;

    return [identity, business, documents, null];
  }, [
    firstName, lastName, email, emailVerified, contactNumber, dob, password,
    businessName, businessAddress, city, district, state, hasGst, gstNumber,
    aadhaarNumber, panNumber, aadhaarPicture, panPicture,
  ]);

  const blocked = errors[step];
  const allValid = errors.every((error) => !error);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={spec.title}
      subtitle={spec.subtitle}
      icon="account-plus-outline"
      dismissible={!create.pending}
      footer={
        done ? (
          <Button icon="check" onPress={onClose} fullWidth>
            Done
          </Button>
        ) : (
          <View style={styles.footerRow}>
            {step > 0 && (
              <Button variant="secondary" onPress={() => setStep(step - 1)} style={styles.flex}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                icon="arrow-right"
                onPress={() => setStep(step + 1)}
                disabled={!!blocked}
                style={styles.flex}
              >
                Next
              </Button>
            ) : (
              <Button
                icon="account-check-outline"
            haptic="success"
                onPress={create.run}
                loading={create.pending}
                disabled={!allValid}
                style={styles.flex}
              >
                Create {kind}
              </Button>
            )}
          </View>
        )
      }
    >
      {done ? (
        <SuccessBanner
          message={`${kind === 'retailer' ? 'Retailer' : 'Distributor'} created with ID ${merchantCode}. They can sign in with the email and password you set.`}
        />
      ) : (
        <>
          <View style={styles.stepper}>
            {STEPS.map((label, index) => (
              <View key={label} style={styles.stepperItem}>
                <View
                  style={[
                    styles.stepDot,
                    index === step && styles.stepDotActive,
                    index < step && styles.stepDotDone,
                  ]}
                >
                  {index < step ? (
                    <MaterialCommunityIcons name="check" size={12} color={colors.success} />
                  ) : (
                    <Text style={[styles.stepNumber, index === step && styles.stepNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.stepLabel, index === step && styles.stepLabelActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.summary}>
            <Row label={spec.idLabel} value={merchantCode} mono last />
          </View>

          {step === 0 && (
            <>
              <View>
                <SelectField
                  label="Prefix"
                  value={prefix}
                  open={prefixOpen}
                  onPress={() => setPrefixOpen(!prefixOpen)}
                />
                {prefixOpen && (
                  <View style={styles.picker}>
                    {PREFIXES.map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setPrefix(option);
                          setPrefixOpen(false);
                        }}
                        style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.pickerText}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <Input label="First name" required value={firstName} onChangeText={setFirstName} leftIcon="account-outline" autoCapitalize="words" />
              <Input label="Last name" required value={lastName} onChangeText={setLastName} leftIcon="account-outline" autoCapitalize="words" />

              <Input
                label="Email address"
                required
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setEmailVerified(false);
                  setOtpSent(false);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon="email-outline"
                editable={!emailVerified}
                helperText="A 6-digit code confirms the address before the account is created"
              />

              {emailVerified ? (
                <Banner tone="success" message="Email address verified." />
              ) : (
                <>
                  {!!sendOtp.error && <Banner tone="error" message={sendOtp.error} />}
                  {!!verifyOtp.error && <Banner tone="error" message={verifyOtp.error} />}
                  <Button
                    variant="outline"
                    icon="email-fast-outline"
                    onPress={sendOtp.run}
                    loading={sendOtp.pending}
                    disabled={!EMAIL_RE.test(email.trim())}
                    fullWidth
                  >
                    {otpSent ? 'Resend verification code' : 'Send verification code'}
                  </Button>
                  {otpSent && (
                    <>
                      <Input
                        label="Verification code"
                        required
                        value={emailOtp}
                        onChangeText={(v) => setEmailOtp(v.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        leftIcon="email-check-outline"
                        placeholder="6 digits"
                      />
                      <Button
                        icon="check"
                        onPress={verifyOtp.run}
                        loading={verifyOtp.pending}
                        disabled={emailOtp.length !== 6}
                        fullWidth
                      >
                        Verify email
                      </Button>
                    </>
                  )}
                </>
              )}

              <Input
                label="Mobile number"
                required
                value={contactNumber}
                onChangeText={(v) => setContactNumber(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                leftIcon="phone-outline"
              />
              <Input
                label="Date of birth"
                required
                value={dob}
                onChangeText={setDob}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                leftIcon="calendar-outline"
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
                helperText="At least 6 characters. Share it with them securely."
              />

              {kind === 'retailer' && (
                <Toggle
                  label="Already onboarded with PaySprint"
                  hint="Skips the new-merchant flow when the shop already has a PaySprint merchant code."
                  value={isExistingMerchant}
                  onChange={setIsExistingMerchant}
                />
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Input label="Business name" required value={businessName} onChangeText={setBusinessName} leftIcon="storefront-outline" />
              <Input label="Street address" required value={businessAddress} onChangeText={setBusinessAddress} leftIcon="map-marker-outline" />
              <Input label="City" required value={city} onChangeText={setCity} leftIcon="city-variant-outline" />
              <Input label="District" required value={district} onChangeText={setDistrict} leftIcon="map-outline" />

              <View>
                <SelectField
                  label="State"
                  required
                  value={state}
                  placeholder="Select the state"
                  open={stateOpen}
                  onPress={() => setStateOpen(!stateOpen)}
                />
                {stateOpen && (
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
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
                  </ScrollView>
                )}
              </View>

              <Input label="Landmark" value={landmark} onChangeText={setLandmark} leftIcon="signs-post" />

              <Toggle label="Registered for GST" value={hasGst} onChange={setHasGst} />
              {hasGst && (
                <Input
                  label="GST number"
                  required
                  value={gstNumber}
                  onChangeText={(v) => setGstNumber(v.toUpperCase().slice(0, 15))}
                  autoCapitalize="characters"
                  leftIcon="file-certificate-outline"
                  helperText="15 characters"
                />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Input
                label="Aadhaar number"
                required
                value={aadhaarNumber}
                onChangeText={(v) => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))}
                keyboardType="number-pad"
                leftIcon="card-account-details-outline"
                placeholder="12 digits"
              />
              <ImageField
                label="Aadhaar card photo"
                required
                value={aadhaarPicture}
                onChange={setAadhaarPicture}
                helperText="Both sides in one frame, or the front if the address is printed there"
              />
              <Input
                label="PAN number"
                required
                value={panNumber}
                onChangeText={(v) => setPanNumber(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                autoCapitalize="characters"
                leftIcon="card-text-outline"
                placeholder="ABCDE1234F"
              />
              <ImageField label="PAN card photo" required value={panPicture} onChange={setPanPicture} />
              <ImageField
                label="Profile photo"
                value={profilePicture}
                onChange={setProfilePicture}
                helperText="Optional. Shown on their dashboard and receipts."
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionHint}>
                Commission packages are optional — leave a service blank to keep the platform default.
              </Text>
              {SERVICE_PACKAGES.map((service) => (
                <View key={service.key}>
                  <SelectField
                    label={`${service.label} package`}
                    value={packages[service.key] ?? ''}
                    placeholder="Platform default"
                    open={openPackage === service.key}
                    onPress={() => setOpenPackage(openPackage === service.key ? null : service.key)}
                  />
                  {openPackage === service.key && (
                    <View style={styles.picker}>
                      {PACKAGES.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setPackages({ ...packages, [service.key]: option });
                            setOpenPackage(null);
                          }}
                          style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.pickerText}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              <Text style={styles.sectionHint}>Branding (optional)</Text>
              <Input label="Brand name" value={brandName} onChangeText={setBrandName} leftIcon="tag-outline" />
              <Input label="Company registered name" value={companyRegisterName} onChangeText={setCompanyRegisterName} leftIcon="domain" />
              <Input label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" leftIcon="web" />
              <Input label="Support email" value={supportEmail} onChangeText={setSupportEmail} autoCapitalize="none" keyboardType="email-address" leftIcon="email-outline" />
              <Input
                label="Support mobile"
                value={supportMobile}
                onChangeText={(v) => setSupportMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                leftIcon="phone-outline"
              />

              {!!create.error && <Banner tone="error" message={create.error} />}
            </>
          )}

          {!!blocked && step < STEPS.length - 1 && <Banner tone="warning" message={blocked} />}
          {!allValid && step === STEPS.length - 1 && (
            <Banner tone="warning" message={errors.find(Boolean) as string} />
          )}
        </>
      )}
    </Sheet>
  );
};

const Toggle: React.FC<{
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, hint, value, onChange }) => (
  <Pressable
    onPress={() => onChange(!value)}
    style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.8 }]}
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    accessibilityLabel={label}
  >
    <MaterialCommunityIcons
      name={value ? 'checkbox-marked' : 'checkbox-blank-outline'}
      size={22}
      color={value ? colors.accent : colors.mutedForeground}
    />
    <View style={styles.toggleText}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {!!hint && <Text style={styles.toggleHint}>{hint}</Text>}
    </View>
  </Pressable>
);

const styles = themed((c) => ({
  footerRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', gap: space.xs },
  stepperItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.secondary,
  },
  stepDotActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  stepDotDone: { borderColor: c.success, backgroundColor: c.successSubtle },
  stepNumber: { fontSize: t.micro, fontWeight: '700', color: c.mutedForeground },
  stepNumberActive: { color: c.accent },
  stepLabel: { fontSize: t.micro, color: c.mutedForeground },
  stepLabelActive: { color: c.foreground, fontWeight: '700' },
  summary: {
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  picker: { marginTop: 6, borderRadius: radius.md, backgroundColor: c.secondary, padding: space.xs },
  pickerScroll: {
    marginTop: 6,
    maxHeight: 220,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
    padding: space.xs,
  },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  sectionHint: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  toggleHint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default OnboardMemberSheet;
