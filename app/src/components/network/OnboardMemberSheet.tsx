import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { ImageField } from '@/components/ui/ImageField';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, Segmented, SuccessBanner } from '@/components/ui/Screen';
import { AEPS_PROVIDERS, PAYSPRINT_ENABLED, SERVICES, type AepsProvider } from '@/constants/services';
import { useAction } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

const PREFIXES = ['Mr', 'Mrs', 'Miss'];

/** The state as INDIAN_STATES spells it; UIDAI writes "west bengal" or "Jammu & Kashmir". Same as the web wizard. */
const knownState = (name: string) => {
  const key = (v: string) => v.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  return INDIAN_STATES.find((option) => key(option) === key(name)) || '';
};

// Same rules as the web wizard (frontend/src/components/distributor/CreateRetailerWizard.tsx).
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export type MemberKind = 'retailer' | 'distributor';

const KIND = {
  retailer: {
    title: 'Onboard a retailer',
    idLabel: 'Retailer ID',
    prefix: 'RT',
    create: (data: Record<string, any>, files: any) => api.createRetailer(data, files),
  },
  distributor: {
    title: 'Onboard a distributor',
    idLabel: 'Distributor ID',
    prefix: 'DT',
    create: (data: Record<string, any>, files: any) => api.createDistributor(data, files),
  },
} as const;

/**
 * Network onboarding, shared by the distributor portal (creates retailers) and
 * the admin portal (creates distributors). Fields, placeholders, steps and
 * rules mirror the web wizard so both portals onboard the same way; the
 * backend takes the same multipart body for both.
 */
export const OnboardMemberSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  kind: MemberKind;
  onCreated: () => void;
}> = ({ visible, onClose, kind, onCreated }) => {
  const spec = KIND[kind];
  const isRetailer = kind === 'retailer';
  // Retailers may be onboarded remotely and cannot read out an OTP, so only
  // distributors verify their email before the account is created.
  const needsOtp = !isRetailer;
  const { user } = useAuth();
  const parentName = (user as { name?: string } | null)?.name || 'you';
  const steps = ['Account', 'KYC & business', isRetailer ? 'Services & branding' : 'Branding', 'Review'];

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // Generated once per sheet open; editable only for an existing PaySprint merchant.
  const [merchantCode, setMerchantCode] = useState(
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
  const [aepsProvider, setAepsProvider] = useState<AepsProvider>(PAYSPRINT_ENABLED ? 'paysprint' : 'icchhamati');
  const isPaysprint = PAYSPRINT_ENABLED && aepsProvider !== 'icchhamati';

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarPicture, setAadhaarPicture] = useState<PickedFile | null>(null);
  const [panPicture, setPanPicture] = useState<PickedFile | null>(null);
  const [profilePicture, setProfilePicture] = useState<PickedFile | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [companyRegisterName, setCompanyRegisterName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [aadhaarBack, setAadhaarBack] = useState<PickedFile | null>(null);
  const [qrNote, setQrNote] = useState('');

  /** Reads the QR on the back of the Aadhaar and fills the address from it. */
  const readQr = useAction(async (file: PickedFile) => {
    setQrNote('');
    const res = await api.readAadhaarAddress(file);
    if (!res?.success) throw new Error(res?.message || 'Could not read the QR. Type the address instead.');
    const a = res.data || {};
    if (a.businessAddress) setBusinessAddress(a.businessAddress);
    if (a.city) setCity(a.city);
    if (a.district) setDistrict(a.district);
    if (knownState(a.state || '')) setState(knownState(a.state));
    if (a.landmark) setLandmark(a.landmark);
    setQrNote('Address filled from the Aadhaar QR. Check it before continuing.');
    return res;
  });

  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMobile, setSupportMobile] = useState('');

  // Every service is on by default; the distributor switches off what they don't want.
  const [services, setServices] = useState<Record<string, 'Yes' | 'No'>>(
    () => Object.fromEntries(SERVICES.map((svc) => [svc.key, 'Yes' as const]))
  );
  const setAllServices = (value: 'Yes' | 'No') =>
    setServices(Object.fromEntries(SERVICES.map((svc) => [svc.key, value])));

  const sendOtp = useAction(async () => {
    const res = await api.sendVerificationOtp(email.trim(), `${firstName} ${lastName}`.trim());
    if (!res.success) throw new Error(res.message || 'Failed to send OTP.');
    setOtpSent(true);
    return res;
  });

  const verifyOtp = useAction(async () => {
    const res = await api.verifyEmailOtp(email.trim(), emailOtp.trim());
    if (!res.success) throw new Error(res.message || 'Invalid Email OTP.');
    setEmailVerified(true);
    return res;
  });

  const create = useAction(async () => {
    const res = await spec.create(
      {
        merchantCode,
        prefix,
        firstName,
        lastName,
        email,
        contactNumber,
        password,
        dob,
        ...(needsOtp ? { otp: emailOtp } : {}),
        businessName,
        businessAddress,
        // Nested field: multer flattens the form, so the controller parses this.
        address: JSON.stringify({ city, landmark, district, state }),
        aadhaarNumber,
        panNumber,
        hasGst: false,
        gstNumber: '',
        brandName,
        companyRegisterName,
        website,
        supportEmail,
        supportMobile,
        ...(isRetailer
          ? {
              aepsProvider,
              isExistingMerchant: isExistingMerchant && isPaysprint,
              disabledServices: JSON.stringify(SERVICES.filter((svc) => services[svc.key] === 'No').map((svc) => svc.key)),
            }
          : {}),
      },
      {
        aadhaarPicture: aadhaarPicture ?? undefined,
        panPicture: panPicture ?? undefined,
        profilePicture: profilePicture ?? undefined,
      }
    );
    if (!res.success) throw new Error(res.message || `Failed to create ${kind}.`);
    setDone(true);
    onCreated();
    return res;
  });

  // First problem on each step, worded as on the web wizard.
  const errors: (string | null)[] = [
    !firstName.trim() ? 'First name: Required'
      : !lastName.trim() ? 'Last name: Required'
      : !EMAIL_RE.test(email) ? 'Enter a valid email'
      : needsOtp && !emailVerified ? 'Verify this email with the OTP'
      : !MOBILE_RE.test(contactNumber) ? 'Enter a 10-digit mobile number'
      : !dob ? 'Date of birth: Required'
      : password.length < 6 ? 'Password: At least 6 characters'
      : isRetailer && isPaysprint && isExistingMerchant && !merchantCode.trim() ? 'Enter the existing merchant ID'
      : null,
    !AADHAAR_RE.test(aadhaarNumber) ? 'Aadhaar is 12 digits'
      : !PAN_RE.test(panNumber) ? 'PAN format: ABCDE1234F'
      : isRetailer && !aadhaarPicture ? 'Upload the Aadhaar photo'
      : isRetailer && !panPicture ? 'Upload the PAN photo'
      : !businessName.trim() ? 'Business name: Required'
      : !businessAddress.trim() ? 'Street address: Required'
      : !city.trim() ? 'City: Required'
      : !district.trim() ? 'District: Required'
      : !state ? 'Select a state'
      : null,
    null,
    null,
  ];

  const blocked = errors[step];
  const firstInvalid = errors.findIndex(Boolean);
  const enabledServices = SERVICES.filter((svc) => services[svc.key] === 'Yes');
  const providerLabel = AEPS_PROVIDERS.find((p) => p.key === (isPaysprint ? 'paysprint' : 'icchhamati'))?.label || '';

  const review = [
    {
      title: 'Account',
      to: 0,
      rows: [
        ['Name', `${prefix} ${firstName} ${lastName}`],
        ['Email', email],
        ['Mobile', contactNumber && `+91 ${contactNumber}`],
        ['Date of birth', dob],
        [spec.idLabel, merchantCode + (isRetailer && isPaysprint && isExistingMerchant ? ' (existing)' : '')],
        ...(isRetailer ? [['AEPS provider', providerLabel]] : []),
      ],
    },
    {
      title: 'KYC & business',
      to: 1,
      rows: [
        ['Aadhaar', aadhaarNumber && `XXXX XXXX ${aadhaarNumber.slice(-4)}`],
        ['PAN', panNumber],
        ['Documents', [aadhaarPicture && 'Aadhaar', panPicture && 'PAN', profilePicture && 'Profile'].filter(Boolean).join(', ')],
        ['Business', businessName],
        ['Address', [businessAddress, city, district, state].filter(Boolean).join(', ')],
      ],
    },
    {
      title: steps[2],
      to: 2,
      rows: [
        ['Brand', brandName],
        ['Website', website],
        ...(isRetailer
          ? [['Packages', enabledServices.length === SERVICES.length ? 'All services' : enabledServices.map((svc) => svc.label).join(', ') || 'None']]
          : []),
      ],
    },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={spec.title}
      subtitle={isRetailer ? `Four short steps. They'll join your network under ${parentName}.` : 'Four short steps to add a distributor to the platform.'}
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
              <Button variant="secondary" icon="arrow-left" onPress={() => setStep(step - 1)} disabled={create.pending} style={styles.flex}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button icon="arrow-right" onPress={() => setStep(step + 1)} disabled={!!blocked} style={styles.flex}>
                {step === 2 ? 'Review' : 'Continue'}
              </Button>
            ) : (
              <Button
                icon="account-plus-outline"
                haptic="success"
                onPress={() => (firstInvalid === -1 ? create.run() : setStep(firstInvalid))}
                loading={create.pending}
                style={styles.flex}
              >
                {create.pending ? 'Creating…' : `Create ${kind}`}
              </Button>
            )}
          </View>
        )
      }
    >
      {done ? (
        <SuccessBanner
          message={
            isRetailer
              ? `Retailer created successfully! They sign in with this email and password, then complete AEPS onboarding themselves from the AEPS page.`
              : `Distributor created successfully! They sign in with this email and password and can start onboarding retailers right away.`
          }
        />
      ) : (
        <>
          <View style={styles.stepper}>
            {steps.map((label, index) => (
              <Pressable
                key={label}
                // Forward jumps only past steps that are already complete.
                onPress={() => (index <= step || errors.slice(0, index).every((e) => !e)) && setStep(index)}
                style={styles.stepperItem}
                accessibilityRole="button"
              >
                <View style={[styles.stepDot, index === step && styles.stepDotActive, index < step && styles.stepDotDone]}>
                  {index < step ? (
                    <MaterialCommunityIcons name="check" size={12} color={colors.success} />
                  ) : (
                    <Text style={[styles.stepNumber, index === step && styles.stepNumberActive]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, index === step && styles.stepLabelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {step === 0 && (
            <>
              <View>
                <SelectField label="Prefix" value={prefix} open={prefixOpen} onPress={() => setPrefixOpen(!prefixOpen)} />
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

              <Input label="First name" required value={firstName} onChangeText={setFirstName} placeholder="First name" leftIcon="account-outline" autoCapitalize="words" />
              <Input label="Last name" required value={lastName} onChangeText={setLastName} placeholder="Last name" leftIcon="account-outline" autoCapitalize="words" />

              <Input
                label="Email"
                required
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon="email-outline"
                editable={!(needsOtp && otpSent)}
                helperText={needsOtp && !emailVerified ? 'We send a 6-digit code to confirm the address.' : undefined}
              />

              {needsOtp && (emailVerified ? (
                <Banner tone="success" message="Email verified successfully!" />
              ) : (
                <>
                  {!!sendOtp.error && <Banner tone="error" message={sendOtp.error} />}
                  {!!verifyOtp.error && <Banner tone="error" message={verifyOtp.error} />}
                  {!otpSent ? (
                    <Button variant="outline" icon="email-fast-outline" onPress={sendOtp.run} loading={sendOtp.pending} disabled={!EMAIL_RE.test(email)} fullWidth>
                      Send OTP
                    </Button>
                  ) : (
                    <>
                      <Input
                        value={emailOtp}
                        onChangeText={(v) => setEmailOtp(v.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        leftIcon="email-check-outline"
                        placeholder="6-digit OTP"
                      />
                      <View style={styles.footerRow}>
                        <Button
                          variant="secondary"
                          onPress={() => {
                            setOtpSent(false);
                            setEmailOtp('');
                          }}
                          style={styles.flex}
                        >
                          Change
                        </Button>
                        <Button icon="shield-check-outline" onPress={verifyOtp.run} loading={verifyOtp.pending} disabled={emailOtp.length !== 6} style={styles.flex}>
                          Verify
                        </Button>
                      </View>
                    </>
                  )}
                </>
              ))}

              <Input
                label="Mobile"
                required
                value={contactNumber}
                onChangeText={(v) => setContactNumber(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                keyboardType="number-pad"
                leftIcon="phone-outline"
                helperText="+91"
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
                placeholder="At least 6 characters"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                leftIcon="lock-outline"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword(!showPassword)}
                rightIconLabel={showPassword ? 'Hide' : 'Show'}
                helperText="They can change it after signing in."
              />
              <ImageField label="Profile photo" value={profilePicture} onChange={setProfilePicture} />

              {!isRetailer && <Input label="Distributor ID (auto-generated)" value={merchantCode} editable={false} disabled />}

              {isRetailer && (
                <>
                  {PAYSPRINT_ENABLED && (
                    <View>
                      <Text style={styles.providerLabel}>AEPS provider</Text>
                      <Segmented
                        scroll={false}
                        options={AEPS_PROVIDERS.filter((p) => p.key !== 'both').map((p) => ({ key: p.key, label: p.label }))}
                        value={aepsProvider}
                        onChange={(p) => {
                          setAepsProvider(p);
                          if (p === 'icchhamati') setIsExistingMerchant(false);
                        }}
                      />
                      <Text style={styles.providerHint}>They start on this provider. You can add the other one later from their page.</Text>
                    </View>
                  )}
                  {isPaysprint && (
                    <Toggle
                      label="Already a PaySprint merchant"
                      hint="Tick this to migrate them with their existing merchant ID instead of a new one."
                      value={isExistingMerchant}
                      onChange={setIsExistingMerchant}
                    />
                  )}
                  <Input
                    label={isExistingMerchant ? 'Existing merchant ID' : 'Retailer ID (auto-generated)'}
                    value={merchantCode}
                    onChangeText={(v) => setMerchantCode(v.toUpperCase())}
                    editable={isExistingMerchant}
                    disabled={!isExistingMerchant}
                    autoCapitalize="characters"
                  />
                  <Input label="Parent distributor" value={parentName} editable={false} disabled />
                </>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Input
                label="Aadhaar number"
                required
                value={aadhaarNumber}
                onChangeText={(v) => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))}
                placeholder="1234 5678 9012"
                keyboardType="number-pad"
                leftIcon="card-account-details-outline"
              />
              <Input
                label="PAN number"
                required
                value={panNumber}
                onChangeText={(v) => setPanNumber(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                placeholder="ABCDE1234F"
                autoCapitalize="characters"
                leftIcon="card-text-outline"
              />
              <ImageField label="Aadhaar photo" required={isRetailer} value={aadhaarPicture} onChange={setAadhaarPicture} helperText="JPG or PNG, a clear photo" />
              <ImageField label="PAN photo" required={isRetailer} value={panPicture} onChange={setPanPicture} helperText="JPG or PNG, a clear photo" />
              <ImageField
                label="Aadhaar back photo"
                value={aadhaarBack}
                onChange={(file) => {
                  setAadhaarBack(file);
                  setQrNote('');
                  readQr.setError(null);
                  if (file) readQr.run(file);
                }}
                helperText={readQr.pending ? 'Reading the QR…' : 'Optional. The side with the QR code; the shop address is filled from it.'}
              />
              {!!readQr.error && <Banner tone="error" message={readQr.error} />}
              {!!qrNote && <SuccessBanner message={qrNote} />}

              <Text style={styles.sectionTitle}>Shop details</Text>
              <Input label="Business name" required value={businessName} onChangeText={setBusinessName} placeholder="e.g. Sharma Mobile Centre" leftIcon="storefront-outline" />
              <Input label="Company registered name" value={companyRegisterName} onChangeText={setCompanyRegisterName} placeholder="Optional" leftIcon="domain" />
              <Input label="Street address" required value={businessAddress} onChangeText={setBusinessAddress} placeholder="Shop no., street, area" leftIcon="map-marker-outline" />
              <Input label="City" required value={city} onChangeText={setCity} placeholder="City" leftIcon="city-variant-outline" />
              <Input label="District" required value={district} onChangeText={setDistrict} placeholder="District" leftIcon="map-outline" />

              <View>
                <SelectField label="State" required value={state} placeholder="Select state" open={stateOpen} onPress={() => setStateOpen(!stateOpen)} />
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

              <Input label="Landmark" value={landmark} onChangeText={setLandmark} placeholder="Optional" leftIcon="signs-post" />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.sectionTitle}>Branding & support (optional)</Text>
              <Input label="Brand name" value={brandName} onChangeText={setBrandName} placeholder="Brand name" leftIcon="tag-outline" />
              <Input label="Website" value={website} onChangeText={setWebsite} placeholder="www.company.com" autoCapitalize="none" keyboardType="url" leftIcon="web" helperText="https://" />
              <Input label="Support email" value={supportEmail} onChangeText={setSupportEmail} placeholder="support@company.com" autoCapitalize="none" keyboardType="email-address" leftIcon="email-outline" />
              <Input
                label="Support mobile"
                value={supportMobile}
                onChangeText={(v) => setSupportMobile(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="Support number"
                keyboardType="number-pad"
                leftIcon="phone-outline"
              />

              {isRetailer && (
                <>
                  <Text style={styles.sectionTitle}>Service packages</Text>
                  <Text style={styles.sectionHint}>
                    Services set to No are hidden from the retailer and blocked. You can change this later from the retailer's page.
                  </Text>
                  <View style={styles.footerRow}>
                    <Button variant="outline" size="sm" onPress={() => setAllServices('Yes')} style={styles.flex}>All Yes</Button>
                    <Button variant="outline" size="sm" onPress={() => setAllServices('No')} style={styles.flex}>All No</Button>
                  </View>
                  <View style={styles.summary}>
                    {SERVICES.map((svc, index) => (
                      <View key={svc.key} style={[styles.serviceRow, index === SERVICES.length - 1 && styles.serviceRowLast]}>
                        <View style={styles.flex}>
                          <Text style={styles.toggleLabel}>{svc.label}</Text>
                          <Text style={styles.toggleHint}>{svc.hint}</Text>
                        </View>
                        <View style={styles.serviceSwitch}>
                          <Segmented
                            scroll={false}
                            options={[{ key: 'Yes', label: 'Yes' }, { key: 'No', label: 'No' }]}
                            value={services[svc.key]}
                            onChange={(value) => setServices({ ...services, [svc.key]: value })}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {review.map((block) => (
                <View key={block.title} style={styles.summary}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.toggleLabel}>{block.title}</Text>
                    <Pressable onPress={() => setStep(block.to)} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                  </View>
                  {block.rows.map(([label, value], index) => (
                    <Row key={label} label={label} value={value || '—'} last={index === block.rows.length - 1} />
                  ))}
                </View>
              ))}
              {!!create.error && <Banner tone="error" message={create.error} />}
            </>
          )}

          {!!blocked && <Banner tone="warning" message={blocked} />}
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
  providerLabel: { fontSize: t.small, fontWeight: '500', color: c.foreground, marginBottom: 7 },
  providerHint: { fontSize: t.micro, lineHeight: 16, color: c.mutedForeground, marginTop: 6 },
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
  sectionTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground, marginTop: space.sm },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  serviceRowLast: { borderBottomWidth: 0 },
  serviceSwitch: { width: 120 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.md },
  editLink: { fontSize: t.micro, fontWeight: '700', color: c.mutedForeground },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  toggleHint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default OnboardMemberSheet;
