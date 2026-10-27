import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, SuccessBanner } from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from './BiometricCapture';
import { useAction } from '@/hooks/useAsync';
import { coordsPayload } from '@/services/location';
import { pickImage, recordVideo, type PickedFile } from '@/services/imagePicker';
import type { DeviceBrand } from '@/services/rdService';
import api from '@/services/api';

/**
 * Icchhamati (Fingpay) AEPS onboarding, one step at a time. The backend reads
 * the provider's draft and says which step is next (GET /status); this sheet
 * renders that step and asks for the status again once it succeeds, so the
 * order of steps lives in one place.
 */

export type IcchStep =
  | 'register' | 'pan' | 'mobile' | 'email' | 'aadhaar' | 'bank'
  | 'video' | 'video_review' | 'onboard' | 'ekyc' | 'twofa' | 'ready';

export interface IcchStatus {
  step: IcchStep;
  outletId: string | null;
  aadhaarPayReady?: boolean;
  ekycOtpVerified?: boolean;
  remarks?: string | null;
  primaryKeyId?: string | null;
  encodeFPTxnId?: string | null;
  deviceIMEI?: string;
  deviceName?: string;
  profile: Record<string, string | undefined>;
}

// Fingpay's eKYC capture must carry this WADH; 2FA and transactions must not.
const EKYC_WADH = 'E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc=';

const SHOP_PHOTOS = [
  { key: 'shop_inner', label: 'Photo inside the shop' },
  { key: 'shop_outer', label: 'Photo of the shop front' },
];

/** The scanner model name the provider registers: "Mantra", "Morpho"… */
export const providerDeviceName = (brand: DeviceBrand) => brand[0].toUpperCase() + brand.slice(1);

const TITLES: Record<IcchStep, string> = {
  register: 'Shop & settlement bank',
  pan: 'Verify PAN',
  mobile: 'Verify mobile',
  email: 'Verify email',
  aadhaar: 'Verify Aadhaar',
  bank: 'Verify bank account',
  video: 'Video KYC',
  video_review: 'Video KYC under review',
  onboard: 'Activate AEPS',
  ekyc: 'Biometric eKYC',
  twofa: 'Daily login',
  ready: 'AEPS is ready',
};

/** A failed envelope becomes a thrown message for useAction to show. */
const ok = (res: any, fallback: string) => {
  if (!res?.success) throw new Error(res?.message || fallback);
  return res;
};

export const IcchhamatiOnboardingSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  status: IcchStatus | null;
  /** Refetches the status; the sheet then shows whichever step is next. */
  onChanged: () => void;
  /** Aadhaar Pay has its own daily login, separate from AEPS. */
  serviceType?: 'AEPS' | 'AP';
}> = ({ visible, onClose, status, onChanged, serviceType = 'AEPS' }) => {
  const step: IcchStep =
    serviceType === 'AP'
      ? status?.aadhaarPayReady === false ? 'twofa' : 'ready'
      : status?.step ?? 'register';
  const title = serviceType === 'AP' ? 'Aadhaar Pay login' : TITLES[step];

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={status?.outletId ? `Outlet ${status.outletId}` : 'AEPS onboarding'} icon="shield-account-outline">
      {status && (
        // Keyed so each step starts with an empty form.
        <StepBody key={`${step}-${serviceType}`} step={step} status={status} onChanged={onChanged} onClose={onClose} serviceType={serviceType} />
      )}
    </Sheet>
  );
};

const StepBody: React.FC<{
  step: IcchStep;
  status: IcchStatus;
  onChanged: () => void;
  onClose: () => void;
  serviceType: 'AEPS' | 'AP';
}> = ({ step, status, onChanged, onClose, serviceType }) => {
  const { device, setDevice } = useBiometricDevice();
  const [serial, setSerial] = useState(status.deviceIMEI || '');
  const [pidData, setPidData] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [txnid, setTxnid] = useState('');
  // OTP verified earlier: resume at the fingerprint with the ids Icchhamati kept.
  const resumeIds = status.ekycOtpVerified && status.primaryKeyId && status.encodeFPTxnId
    ? { primaryKeyId: String(status.primaryKeyId), encodeFPTxnId: status.encodeFPTxnId } : null;
  const [fpIds, setFpIds] = useState<{ primaryKeyId: string; encodeFPTxnId: string } | null>(resumeIds);
  const [otpVerified, setOtpVerified] = useState(!!resumeIds);
  const [video, setVideo] = useState<PickedFile | null>(null);
  const [shopPhotos, setShopPhotos] = useState<Record<string, boolean>>({});

  /** Runs one provider call; success refreshes the status, which advances the sheet. */
  const action = useAction(async (call: () => Promise<any>, advance = true) => {
    const res = ok(await call(), 'Request failed. Please try again.');
    if (advance) onChanged();
    return res;
  });
  const stepCall = (path: string, body: Record<string, any> = {}) => () => api.icchAepsStep(path, body);

  /** eKYC and 2FA are tied to a registered scanner; register it when it changed. */
  const ensureDevice = async () => {
    if (!serial.trim()) throw new Error('Enter the scanner serial number.');
    const name = providerDeviceName(device);
    if (serial === status.deviceIMEI && name === status.deviceName) return;
    ok(await api.icchAepsStep('device', { deviceIMEI: serial.trim(), deviceName: name }), 'Could not register the scanner.');
  };

  const deviceFields = (
    <Input
      label="Scanner serial number"
      required
      value={serial}
      onChangeText={(v) => setSerial(v.trim())}
      autoCapitalize="characters"
      placeholder="Printed under the scanner"
      helperText="Registered with the provider for eKYC and daily login"
    />
  );

  const error = action.error ? <Banner tone="error" message={action.error} /> : null;

  switch (step) {
    case 'register':
      return <RegisterStep status={status} onChanged={onChanged} />;

    case 'pan':
    case 'bank':
      return (
        <>
          <Text style={styles.body}>
            {step === 'pan'
              ? `PAN ${status.profile.pan || ''} is checked with NSDL against your name.`
              : 'A ₹1 penny drop confirms the settlement account is in your name.'}
          </Text>
          {error}
          <Button icon="check-decagram-outline" onPress={() => action.run(stepCall(step === 'pan' ? 'pan/verify' : 'bank/verify'))} loading={action.pending} fullWidth>
            Verify
          </Button>
        </>
      );

    case 'mobile':
    case 'email':
    case 'aadhaar': {
      const target = step === 'mobile' ? status.profile.phone : step === 'email' ? status.profile.email : `the mobile linked to Aadhaar ${status.profile.aadhaar}`;
      return (
        <>
          <Text style={styles.body}>{`An OTP is sent to ${target}.`}</Text>
          {otpSent && (
            <Input
              label="OTP"
              required
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
            />
          )}
          {error}
          {otpSent ? (
            <Button icon="check" onPress={() => action.run(stepCall(`${step}/verify-otp`, { otp, txnid }))} loading={action.pending} disabled={otp.length < 4} fullWidth>
              Verify
            </Button>
          ) : (
            <Button
              icon="send-outline"
              loading={action.pending}
              fullWidth
              onPress={async () => {
                const res = await action.run(stepCall(`${step}/send-otp`), false);
                if (res) {
                  setOtpSent(true);
                  setTxnid(res.data?.txnid || '');
                }
              }}
            >
              Send OTP
            </Button>
          )}
        </>
      );
    }

    case 'video':
      return (
        <>
          {!!status.remarks && <Banner tone="error" message={`Sent back by the provider: ${status.remarks}`} />}
          <Text style={styles.body}>Two photos of your shop, then a short video (up to 30 seconds) of yourself holding your PAN card inside it.</Text>
          {SHOP_PHOTOS.map(({ key, label }) => (
            <Button
              key={key}
              variant="outline"
              icon={shopPhotos[key] ? 'check-circle' : 'camera-outline'}
              loading={action.pending}
              fullWidth
              onPress={async () => {
                const photo = await pickImage('camera', key);
                if (!photo) return;
                const res = await action.run(async () => api.icchAepsShopImage({ image_type: key, ...(await coordsPayload()) }, photo), false);
                if (res) setShopPhotos((p) => ({ ...p, [key]: true }));
              }}
            >
              {shopPhotos[key] ? `${label} uploaded` : label}
            </Button>
          ))}
          {video && <Row label="Recorded" value={video.name} last />}
          {error}
          <Button
            variant="outline"
            icon="video-outline"
            fullWidth
            onPress={async () => {
              action.setError(null);
              try {
                const clip = await recordVideo();
                if (clip) setVideo(clip);
              } catch (err: any) {
                action.setError(err?.message || 'Could not record the video.');
              }
            }}
          >
            {video ? 'Record again' : 'Record video'}
          </Button>
          <Button
            icon="upload"
            disabled={!video || SHOP_PHOTOS.some((p) => !shopPhotos[p.key])}
            loading={action.pending}
            fullWidth
            onPress={() => action.run(async () => api.icchAepsVideoKyc(await coordsPayload(), video!))}
          >
            Upload video
          </Button>
        </>
      );

    case 'video_review':
      return (
        <>
          <Text style={styles.body}>The provider is reviewing your video. This usually takes a few hours.</Text>
          <Button variant="outline" icon="refresh" onPress={onChanged} fullWidth>
            Check again
          </Button>
        </>
      );

    case 'onboard':
      return (
        <>
          <Text style={styles.body}>All checks passed. Create your AEPS merchant account.</Text>
          {error}
          <Button icon="check-decagram-outline" onPress={() => action.run(stepCall('onboard'))} loading={action.pending} fullWidth>
            Activate
          </Button>
        </>
      );

    case 'ekyc':
      return (
        <>
          <Text style={styles.body}>One time: confirm your identity with an OTP and your own fingerprint.</Text>
          {deviceFields}
          {fpIds && !otpVerified && (
            <Input label="OTP" required value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
          )}
          {otpVerified && (
            <BiometricCapture
              device={device}
              onDeviceChange={setDevice}
              pidData={pidData}
              onCaptured={setPidData}
              options={{ wadh: EKYC_WADH }}
              label="Scan your fingerprint"
              confirmMessage="Place YOUR OWN finger on the scanner."
            />
          )}
          {error}
          {!fpIds ? (
            <Button
              icon="send-outline"
              loading={action.pending}
              fullWidth
              onPress={async () => {
                const res = await action.run(async () => {
                  await ensureDevice();
                  return api.icchAepsStep('ekyc/send-otp', { ...(await coordsPayload()), deviceIMEI: serial });
                }, false);
                if (res?.data?.primaryKeyId) setFpIds({ primaryKeyId: res.data.primaryKeyId, encodeFPTxnId: res.data.encodeFPTxnId });
              }}
            >
              Send OTP
            </Button>
          ) : !otpVerified ? (
            <>
              <Button
                icon="check"
                loading={action.pending}
                disabled={otp.length < 4}
                fullWidth
                onPress={async () => {
                  const res = await action.run(stepCall('ekyc/verify-otp', { otp, deviceIMEI: serial, ...fpIds }), false);
                  if (res) setOtpVerified(true);
                }}
              >
                Verify OTP
              </Button>
              <Button icon="refresh" variant="ghost" disabled={action.pending} fullWidth onPress={() => { setFpIds(null); setOtp(''); }}>
                OTP not received? Send again
              </Button>
            </>
          ) : (
            <Button icon="shield-check-outline" loading={action.pending} disabled={!pidData} fullWidth onPress={() => action.run(stepCall('ekyc/biometric', { xml: pidData, deviceIMEI: serial, ...fpIds }))}>
              Complete eKYC
            </Button>
          )}
        </>
      );

    case 'twofa':
      return (
        <>
          <Text style={styles.body}>
            {serviceType === 'AP' ? 'Aadhaar Pay needs its own daily login.' : 'Scan your own fingerprint once a day before serving customers.'}
          </Text>
          {deviceFields}
          <BiometricCapture
            device={device}
            onDeviceChange={setDevice}
            pidData={pidData}
            onCaptured={setPidData}
            label="Scan your fingerprint"
            confirmMessage="Place YOUR OWN finger on the scanner — this authenticates you as the agent for today."
            blockedReason={serial.trim() ? null : 'Enter the scanner serial number first.'}
          />
          {error}
          <Button
            icon="shield-check-outline"
            loading={action.pending}
            disabled={!pidData}
            fullWidth
            onPress={() =>
              action.run(async () => {
                await ensureDevice();
                // A PID block is single-use whatever the outcome.
                const xml = pidData;
                setPidData(null);
                return api.icchAepsStep('2fa', {
                  xml,
                  deviceIMEI: serial,
                  deviceType: providerDeviceName(device),
                  primaryKeyId: status.primaryKeyId,
                  encodeFPTxnId: status.encodeFPTxnId,
                  serviceType,
                });
              })
            }
          >
            Authenticate
          </Button>
        </>
      );

    case 'ready':
      return (
        <>
          <SuccessBanner message="AEPS is active. You can serve customers now." />
          <Button icon="check" onPress={onClose} fullWidth>
            Continue
          </Button>
        </>
      );
  }
};

/** Shop location and settlement bank; identity comes from the KYC profile. */
const RegisterStep: React.FC<{ status: IcchStatus; onChanged: () => void }> = ({ status, onChanged }) => {
  const [form, setForm] = useState<Record<string, string>>({
    shop_address: status.profile.shopAddress || '',
    shop_city: status.profile.city || '',
    shop_district: status.profile.district || '',
    state_id: '',
    shop_pin_code: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    bank_branch: '',
  });
  const [states, setStates] = useState<{ stateId: string; stateName: string }[]>([]);
  const [showStates, setShowStates] = useState(false);
  const [bankNames, setBankNames] = useState<string[]>([]);

  useEffect(() => {
    api.icchAepsStates().then((res) => res?.success && setStates(res.data || [])).catch(() => {});
    api.icchAepsSettlementBanks().then((res) => res?.success && setBankNames(res.data || [])).catch(() => {});
  }, []);

  const save = useAction(async () => {
    const res = ok(await api.icchAepsStep('register', { ...form, ...(await coordsPayload()) }), 'Registration failed.');
    onChanged();
    return res;
  });

  const set = (key: string, clean?: (v: string) => string) => (v: string) => setForm((f) => ({ ...f, [key]: clean ? clean(v) : v }));
  const digits = (max: number) => (v: string) => v.replace(/\D/g, '').slice(0, max);
  const complete =
    Object.values(form).every((v) => v.trim()) &&
    /^\d{6}$/.test(form.shop_pin_code) &&
    /^\d{9,18}$/.test(form.account_number) &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc_code);
  const stateName = states.find((s) => String(s.stateId) === form.state_id)?.stateName;
  // Suggestions while typing; a bank missing from the list can still be typed in full.
  const bankQuery = form.bank_name.trim().toLowerCase();
  const bankMatches = bankQuery && !bankNames.some((n) => n.toLowerCase() === bankQuery)
    ? bankNames.filter((n) => n.toLowerCase().includes(bankQuery)).slice(0, 6)
    : [];

  return (
    <>
      <View style={styles.summary}>
        <Row label="Name" value={status.profile.name} />
        <Row label="PAN" value={status.profile.pan} mono />
        <Row label="Aadhaar" value={status.profile.aadhaar} mono />
        <Row label="Shop" value={status.profile.shopName} last />
      </View>
      <Input label="Shop address" required value={form.shop_address} onChangeText={set('shop_address')} />
      <Input label="City" required value={form.shop_city} onChangeText={set('shop_city')} />
      <Input label="District" required value={form.shop_district} onChangeText={set('shop_district')} />
      <SelectField label="State" required value={stateName} placeholder={states.length ? 'Select state' : 'Loading states…'} open={showStates} onPress={() => setShowStates(!showStates)} />
      {showStates && (
        <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {states.map((s) => (
            <Pressable
              key={s.stateId}
              onPress={() => {
                setForm((f) => ({ ...f, state_id: String(s.stateId) }));
                setShowStates(false);
              }}
              style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.listText}>{s.stateName}</Text>
              {String(s.stateId) === form.state_id && <Ionicons name="checkmark" size={18} color={colors.highlight} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Input label="Pincode" required value={form.shop_pin_code} onChangeText={set('shop_pin_code', digits(6))} keyboardType="number-pad" />
      <Input label="Bank name" required value={form.bank_name} onChangeText={set('bank_name')} placeholder="Search or type your bank" />
      {bankMatches.length > 0 && (
        <View style={styles.list}>
          {bankMatches.map((n) => (
            <Pressable
              key={n}
              onPress={() => setForm((f) => ({ ...f, bank_name: n }))}
              style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.listText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Input label="Account number" required value={form.account_number} onChangeText={set('account_number', digits(18))} keyboardType="number-pad" />
      <Input label="IFSC" required value={form.ifsc_code} onChangeText={set('ifsc_code', (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} autoCapitalize="characters" />
      <Input label="Branch" required value={form.bank_branch} onChangeText={set('bank_branch')} />
      <Text style={styles.hint}>Your current location is registered as the shop location.</Text>
      {!!save.error && <Banner tone="error" message={save.error} />}
      <Button icon="content-save-outline" onPress={save.run} loading={save.pending} disabled={!complete} fullWidth>
        Save and continue
      </Button>
    </>
  );
};

const styles = themed((c) => ({
  body: { fontSize: t.small, lineHeight: 20, color: c.mutedForeground },
  hint: { fontSize: t.micro, lineHeight: 16, color: c.mutedForeground },
  summary: {
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  list: { maxHeight: 260, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space.lg },
  listText: { fontSize: t.body, color: c.foreground },
}));

export default IcchhamatiOnboardingSheet;
