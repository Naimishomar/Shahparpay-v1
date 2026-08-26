import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { themed, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, SuccessBanner } from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from '@/components/aeps/BiometricCapture';
import { useAction } from '@/hooks/useAsync';
import { getCoords } from '@/services/location';
import api from '@/services/api';

/**
 * Remitter onboarding for DMT. RBI mandates Aadhaar eKYC before a new sender
 * can transfer money, so this runs the two PaySprint calls in order:
 *
 *   1. queryremitter/kyc  — biometric eKYC, returns ekyc_id + stateresp and
 *                           triggers an OTP to the remitter's mobile.
 *   2. registerremitter   — name, pincode and that OTP, replaying the SAME
 *                           PID block captured in step 1.
 */
export const RemitterRegistrationSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  mobile: string;
  /** Fired once the remitter exists so the caller can reload beneficiaries. */
  onRegistered: () => void;
}> = ({ visible, onClose, mobile, onRegistered }) => {
  const { device, setDevice } = useBiometricDevice();

  const [aadhaar, setAadhaar] = useState('');
  const [pidData, setPidData] = useState<string | null>(null);
  const [ekycId, setEkycId] = useState('');
  const [stateresp, setStateresp] = useState('');
  const [step, setStep] = useState<'ekyc' | 'register' | 'done'>('ekyc');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pincode, setPincode] = useState('');
  const [otp, setOtp] = useState('');

  const runEkyc = useAction(async () => {
    const coords = await getCoords();
    const response = await api.dmtRemitterEkyc({
      mobile,
      aadhaar_number: aadhaar,
      pidData: pidData!,
      // The DMT endpoint names these lat/long, not latitude/longitude.
      lat: coords?.latitude,
      long: coords?.longitude,
    });
    const body = response.data;
    if (!response.success || !body?.status) {
      throw new Error(body?.message || response.message || 'Aadhaar eKYC failed.');
    }
    setEkycId(body.ekyc_id || body.data?.ekyc_id || '');
    setStateresp(body.stateresp || body.data?.stateresp || '');
    setStep('register');
    return response;
  });

  const register = useAction(async () => {
    const response = await api.registerDmtRemitter({
      mobile,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      pincode: pincode.trim(),
      aadhaar,
      // Same PID block as the eKYC call — PaySprint matches them.
      pidData,
      ekyc_id: ekycId,
      otp,
      stateresp,
    });
    const body = response.data;
    if (!response.success || !body?.status) {
      throw new Error(body?.message || response.message || 'Remitter registration failed.');
    }
    setStep('done');
    onRegistered();
    return response;
  });

  const registerReady =
    !!firstName.trim() && !!lastName.trim() && pincode.length === 6 && otp.length >= 4;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Register remitter"
      subtitle="Aadhaar eKYC is mandated by RBI for new senders"
      icon="account-plus-outline"
      dismissible={!runEkyc.pending && !register.pending}
      footer={
        step === 'done' ? (
          <Button icon="check" onPress={onClose} fullWidth>
            Done
          </Button>
        ) : step === 'ekyc' ? (
          <Button
            icon="shield-check-outline"
            size="lg"
            onPress={runEkyc.run}
            loading={runEkyc.pending}
            disabled={!pidData || aadhaar.length !== 12}
            fullWidth
          >
            Verify eKYC
          </Button>
        ) : (
          <Button
            icon="account-check-outline"
            haptic="success"
            size="lg"
            onPress={register.run}
            loading={register.pending}
            disabled={!registerReady}
            fullWidth
          >
            Register remitter
          </Button>
        )
      }
    >
      <View style={styles.summary}>
        <Row label="Sender mobile" value={mobile} mono last />
      </View>

      {step === 'ekyc' && (
        <>
          <Input
            label="Sender's Aadhaar number"
            required
            value={aadhaar}
            onChangeText={(v) => {
              setAadhaar(v.replace(/\D/g, '').slice(0, 12));
              setPidData(null);
            }}
            keyboardType="number-pad"
            leftIcon="card-account-details-outline"
            placeholder="12 digits"
            helperText="Used once for eKYC. Never stored on this device."
          />

          <BiometricCapture
            device={device}
            onDeviceChange={setDevice}
            pidData={pidData}
            onCaptured={setPidData}
            // No WADH here: PaySprint's DMT eKYC rejects a WADH-bound capture
            // with "WADH validation failed in RD(WW)".
            label="Capture sender's fingerprint"
            confirmMessage="Ask the SENDER to place their finger on the scanner. This registers them for money transfer."
            blockedReason={aadhaar.length !== 12 ? 'Enter the 12-digit Aadhaar number first.' : null}
          />

          {!!runEkyc.error && <Banner tone="error" message={runEkyc.error} />}
        </>
      )}

      {step === 'register' && (
        <>
          <Banner
            tone="success"
            message="eKYC verified. An OTP has been sent to the sender's mobile number."
          />
          <Input
            label="First name"
            required
            value={firstName}
            onChangeText={setFirstName}
            leftIcon="account-outline"
            autoCapitalize="words"
            helperText="Exactly as printed on the Aadhaar card"
          />
          <Input
            label="Last name"
            required
            value={lastName}
            onChangeText={setLastName}
            leftIcon="account-outline"
            autoCapitalize="words"
          />
          <Input
            label="Pincode"
            required
            value={pincode}
            onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            leftIcon="map-marker-outline"
            placeholder="6 digits"
          />
          <Input
            label="OTP"
            required
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            leftIcon="message-lock-outline"
            autoComplete="one-time-code"
            placeholder="Sent to the sender's mobile"
          />
          {!!register.error && <Banner tone="error" message={register.error} />}
        </>
      )}

      {step === 'done' && (
        <SuccessBanner message="Remitter registered. You can now add beneficiaries and transfer money." />
      )}

      <Text style={styles.hint}>
        Registration is a one-time step per sender. Their transfer limit is set by the bank.
      </Text>
    </Sheet>
  );
};

const styles = themed((c) => ({
  summary: {
    paddingHorizontal: space.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  hint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default RemitterRegistrationSheet;
