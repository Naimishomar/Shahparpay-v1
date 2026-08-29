import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, LoadingBlock, Segmented, SuccessBanner } from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from './BiometricCapture';
import { useAuth } from '@/context/AuthContext';
import { useAction, useAsync } from '@/hooks/useAsync';
import { AEPS_PIPES, NATURE_OF_BUSINESS } from '@/constants';
import { coordsPayload } from '@/services/location';
import api from '@/services/api';

/**
 * Plan returned by GET /api/aeps/onboarding/plan. The per-pipe rules (which
 * eKYC method, which extra fields, which WADH) live in the backend, so this
 * sheet renders whatever the plan says rather than duplicating the pipe table.
 */
interface OnboardingPlan {
  pipe: string;
  label: string;
  wadh: string;
  status: 'ACCEPTED' | 'PENDING' | 'REJECTED' | 'NOT_ONBOARDED';
  webDone: boolean;
  canStartEkyc: boolean;
  actionHint?: string | null;
  message?: string | null;
  steps: {
    id: string;
    title: string;
    done?: boolean;
    locked?: boolean;
    method?: 'otp' | 'activate';
    fields?: string[];
  }[];
}

const STEP_ICONS: Record<string, string> = {
  web: 'web',
  ekyc: 'fingerprint',
  daily_auth: 'shield-key-outline',
  done: 'check-decagram',
};

/**
 * Merchant onboarding + eKYC. Mirrors the web MerchantKycModal but drives the
 * whole flow off the backend's onboarding plan, so every pipe (bank2-bank6) is
 * supported instead of the two the web modal hard-codes.
 */
export const MerchantKycSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  /** Called after a successful activation so the caller can refetch status. */
  onCompleted?: () => void;
  initialPipe?: string;
}> = ({ visible, onClose, onCompleted, initialPipe }) => {
  const { user } = useAuth();
  const { device, setDevice } = useBiometricDevice();

  const [pipe, setPipe] = useState(initialPipe || 'bank2');
  const [aadhaar, setAadhaar] = useState(user?.aadhaarNumber ?? '');
  const [dob, setDob] = useState(user?.dob ?? '');
  const [annualIncome, setAnnualIncome] = useState('');
  const [nature, setNature] = useState('');
  const [natureOpen, setNatureOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [ekycId, setEkycId] = useState('');
  const [stateresp, setStateresp] = useState('');
  const [pidData, setPidData] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const merchantcode = user?.retailerId || user?.code || '';

  useEffect(() => {
    if (initialPipe) setPipe(initialPipe);
  }, [initialPipe]);

  // Switching pipe invalidates everything captured for the previous one: the
  // WADH is baked into the PID block and the OTP session belongs to one pipe.
  useEffect(() => {
    setPidData(null);
    setOtp('');
    setOtpSent(false);
    setEkycId('');
    setStateresp('');
  }, [pipe]);

  const plan = useAsync<OnboardingPlan>(
    async () => (await api.getOnboardingPlan(pipe)).data,
    [pipe],
    visible
  );

  const ekycStep = plan.data?.steps.find((step) => step.id === 'ekyc');
  const needsOtp = ekycStep?.method === 'otp';
  const fields = ekycStep?.fields ?? [];
  const needsDob = fields.includes('dob');
  const needsIncome = fields.includes('annual_income');
  const needsNature = fields.includes('nature_of_bussiness');

  const openWebKyc = useAction(async () => {
    const response = await api.getPaysprintOnboardUrl(
      user?.id || user?._id || merchantcode,
      plan.data?.status === 'NOT_ONBOARDED',
      pipe,
      'shahparpay://kyc-callback'
    );
    if (response.alreadyOnboarded) {
      plan.reload();
      return response;
    }
    if (!response.success || !response.url) {
      throw new Error(response.message || 'Could not open the PaySprint KYC page.');
    }
    await Linking.openURL(response.url);
    return response;
  });

  const sendOtp = useAction(async () => {
    const response = await api.aepsKycSendOtp({
      merchantcode,
      aadhaar,
      pipe,
      ...(await coordsPayload()),
    });
    if (response.data?.response_code === 2) {
      setDone(true);
      return response;
    }
    if (!response.success || response.data?.response_code !== 1) {
      throw new Error(response.data?.message || response.message || 'Could not send the OTP.');
    }
    setEkycId(response.data.data?.otpreqid || response.data.data?.ekyc_id || '');
    setStateresp(response.data.data?.stateresp || 'unknown');
    setOtpSent(true);
    return response;
  });

  const submit = useAction(async () => {
    const coords = await coordsPayload();
    const response = needsOtp
      ? await api.aepsKycVerifyOtp({
          merchantcode,
          aadhaar,
          pipe,
          otp,
          stateresp,
          ekyc_id: ekycId,
          pidData,
          ...coords,
        })
      : await api.aepsActivateMerchant({
          merchantcode,
          aadhaar,
          // PaySprint wants YYYY/MM/DD; the field is typed as YYYY-MM-DD.
          dob: dob.replace(/-/g, '/'),
          pipe,
          pidData,
          ...(needsIncome ? { annual_income: annualIncome } : {}),
          ...(needsNature ? { nature_of_bussiness: nature } : {}),
          ...coords,
        });

    if (!response.success || String(response.data?.response_code) !== '1') {
      throw new Error(response.data?.message || response.message || 'eKYC verification failed.');
    }
    setDone(true);
    onCompleted?.();
    return response;
  });

  const detailsReady =
    aadhaar.length === 12 &&
    (!needsDob || !!dob) &&
    (!needsIncome || Number(annualIncome) > 0) &&
    (!needsNature || !!nature) &&
    (!needsOtp || otp.length === 6);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Merchant eKYC"
      subtitle="Required once per bank pipe before AEPS works"
      icon="shield-account-outline"
      dismissible={!submit.pending}
      footer={
        done ? (
          <Button icon="check" onPress={onClose} fullWidth>
            Done
          </Button>
        ) : plan.data?.canStartEkyc ? (
          <Button
            icon="shield-check-outline"
            haptic="success"
            onPress={submit.run}
            loading={submit.pending}
            disabled={!detailsReady || !pidData}
            fullWidth
            size="lg"
          >
            Submit eKYC
          </Button>
        ) : undefined
      }
    >
      {done ? (
        <SuccessBanner message={`Merchant eKYC completed on ${plan.data?.label ?? pipe}. You can now transact on this pipe.`} />
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Bank pipe</Text>
            <Segmented
              options={AEPS_PIPES.map((p) => ({ key: p.key, label: p.label }))}
              value={pipe}
              onChange={setPipe}
            />
          </View>

          {plan.loading ? (
            <LoadingBlock label="Checking onboarding status" />
          ) : plan.error ? (
            <Banner tone="error" message={plan.error} action={{ label: 'Retry', onPress: plan.reload }} />
          ) : (
            <>
              <View style={styles.steps}>
                {plan.data?.steps.map((step, index) => (
                  <View key={step.id} style={styles.step}>
                    <View
                      style={[
                        styles.stepIcon,
                        step.done && styles.stepIconDone,
                        step.locked && styles.stepIconLocked,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          (step.done
                            ? 'check'
                            : step.locked
                              ? 'lock-outline'
                              : STEP_ICONS[step.id] || 'circle-outline') as any
                        }
                        size={16}
                        color={
                          step.done
                            ? colors.success
                            : step.locked
                              ? colors.mutedForeground
                              : colors.accent
                        }
                      />
                    </View>
                    <Text
                      style={[styles.stepTitle, step.locked && styles.stepTitleLocked]}
                      numberOfLines={2}
                    >
                      {index + 1}. {step.title}
                    </Text>
                  </View>
                ))}
              </View>

              {!!plan.data?.actionHint && <Banner tone="info" message={plan.data.actionHint} />}

              {!plan.data?.webDone && plan.data?.status !== 'ACCEPTED' && (
                <>
                  {!!openWebKyc.error && <Banner tone="error" message={openWebKyc.error} />}
                  <Button
                    icon="open-in-new"
                    variant="outline"
                    onPress={openWebKyc.run}
                    loading={openWebKyc.pending}
                    fullWidth
                  >
                    Open PaySprint Web KYC
                  </Button>
                  <Text style={styles.hint}>
                    The bank's KYC page opens in your browser. Come back here and pull to refresh
                    once it is submitted — eKYC unlocks after the bank confirms it.
                  </Text>
                </>
              )}

              {plan.data?.status === 'ACCEPTED' && (
                <Banner tone="success" message={`${plan.data.label} onboarding is already complete.`} />
              )}

              {plan.data?.canStartEkyc && (
                <>
                  <Input
                    label="Aadhaar number"
                    required
                    value={aadhaar}
                    onChangeText={(v) => setAadhaar(v.replace(/\D/g, '').slice(0, 12))}
                    keyboardType="number-pad"
                    leftIcon="card-account-details-outline"
                    placeholder="12 digits"
                    helperText="Must match the Aadhaar registered with your merchant account"
                  />

                  {needsDob && (
                    <Input
                      label="Date of birth"
                      required
                      value={dob}
                      onChangeText={setDob}
                      placeholder="YYYY-MM-DD"
                      keyboardType="numbers-and-punctuation"
                      leftIcon="calendar-outline"
                    />
                  )}

                  {needsIncome && (
                    <Input
                      label="Annual income"
                      required
                      value={annualIncome}
                      onChangeText={(v) => setAnnualIncome(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      leftIcon="currency-inr"
                      placeholder="e.g. 240000"
                    />
                  )}

                  {needsNature && (
                    <View style={styles.field}>
                      <SelectField
                        label="Nature of business"
                        required
                        value={nature}
                        placeholder="Select your business type"
                        open={natureOpen}
                        onPress={() => setNatureOpen(!natureOpen)}
                      />
                      {natureOpen && (
                        <ScrollView style={styles.picker} nestedScrollEnabled>
                          {NATURE_OF_BUSINESS.map((option) => (
                            <Pressable
                              key={option}
                              onPress={() => {
                                setNature(option);
                                setNatureOpen(false);
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
                  )}

                  {needsOtp && (
                    <>
                      {!!sendOtp.error && <Banner tone="error" message={sendOtp.error} />}
                      <Button
                        variant="outline"
                        icon="message-text-outline"
                        onPress={sendOtp.run}
                        loading={sendOtp.pending}
                        disabled={aadhaar.length !== 12}
                        fullWidth
                      >
                        {otpSent ? 'Resend Aadhaar OTP' : 'Send Aadhaar OTP'}
                      </Button>
                      {otpSent && (
                        <Input
                          label="Aadhaar OTP"
                          required
                          value={otp}
                          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                          keyboardType="number-pad"
                          maxLength={6}
                          leftIcon="lock-outline"
                          autoComplete="one-time-code"
                          placeholder="6 digits"
                          helperText="Sent to the mobile number linked to this Aadhaar"
                        />
                      )}
                    </>
                  )}

                  <BiometricCapture
                    device={device}
                    onDeviceChange={setDevice}
                    pidData={pidData}
                    onCaptured={setPidData}
                    // eKYC captures are bound to the pipe's WADH; the backend
                    // returns the right one with the plan.
                    options={{ wadh: plan.data?.wadh }}
                    label="Capture your fingerprint"
                    confirmMessage="Place YOUR OWN finger on the scanner. This is the merchant's eKYC, not a customer transaction."
                    blockedReason={
                      needsOtp && !otpSent
                        ? 'Send and enter the Aadhaar OTP before capturing your fingerprint.'
                        : null
                    }
                  />

                  {!!submit.error && <Banner tone="error" message={submit.error} />}
                </>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
};

const styles = themed((c) => ({
  field: { gap: 6 },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  steps: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSubtle,
  },
  stepIconDone: { backgroundColor: c.successSubtle },
  stepIconLocked: { backgroundColor: c.muted },
  stepTitle: { flex: 1, fontSize: t.small, fontWeight: '600', color: c.foreground },
  stepTitleLocked: { color: c.mutedForeground, fontWeight: '500' },
  hint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
  picker: {
    maxHeight: 220,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
    padding: space.xs,
  },
  pickerItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.sm },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
}));

export default MerchantKycSheet;
