import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Screen,
  SectionTitle,
  Banner,
  ErrorBanner,
  Row,
  shortDate,
  SkeletonCard,
  SkeletonRows,
  SkeletonTitle,
} from '@/components/ui/Screen';
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { DailyAuthSheet } from '@/components/aeps/DailyAuthSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

export const KycStatusScreen: React.FC = () => {
  const { user } = useAuth();
  const [openError, setOpenError] = useState('');
  const [showKyc, setShowKyc] = useState(false);
  const [showDailyAuth, setShowDailyAuth] = useState(false);

  const merchantId = user?.retailerId || user?.code || '';
  const status = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode: merchantId })).data,
    [merchantId]
  );
  const pipes = useAsync<any>(async () => (await api.verifyAepsPipes()).data, []);

  const kycDone = !!status.data?.isMerchantKycComplete;
  const activePipes: string[] = status.data?.activePipes ?? [];
  const targetPipe = activePipes[0] || 'bank3';

  const plan = useAsync<any>(async () => (await api.getOnboardingPlan(targetPipe)).data, [targetPipe]);

  const onboard = useAction(async () => {
    const res = await api.getPaysprintOnboardUrl(
      merchantId,
      !kycDone,
      targetPipe,
      'https://shahparpay.in/kyc-callback'
    );
    if (!res.success) throw new Error(res.message);
    // The backend answers with `alreadyOnboarded` and no URL once KYC is done.
    if (!res.url) {
      throw new Error(
        res.alreadyOnboarded
          ? 'This merchant is already onboarded — nothing left to complete.'
          : res.message || 'PaySprint did not return an onboarding link.'
      );
    }
    return res.url as string;
  });

  const onOpenOnboarding = async () => {
    setOpenError('');
    const url = await onboard.run();
    if (!url) return;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else setOpenError('This device cannot open the PaySprint onboarding page.');
  };

  const steps = [
    { id: 'web', name: 'Web KYC', desc: 'Complete PaySprint merchant onboarding', done: kycDone },
    {
      id: 'biometric',
      name: 'Biometric activation',
      desc: 'Register your fingerprint device and pass daily 2FA',
      done: !!status.data?.isDailyAuthDoneToday,
    },
  ];

  const planSteps: any[] = plan.data?.steps ?? [];

  return (
    <Screen
      loading={status.loading}
      skeleton={<View style={{ gap: 16 }}><SkeletonCard><SkeletonRows count={1} amount={false} avatar={56} /></SkeletonCard><SkeletonTitle /><SkeletonCard><SkeletonRows count={4} amount={false} /></SkeletonCard></View>}
      refreshing={status.refreshing || pipes.refreshing}
      onRefresh={() => {
        status.refresh();
        pipes.refresh();
        plan.refresh();
      }}
      error={status.error}
      onRetry={status.reload}
    >
      <Card>
        <CardContent style={styles.overall}>
          <View style={styles.statusCircle}>
            <Ionicons
              name={kycDone ? 'shield-checkmark-outline' : 'time-outline'}
              size={26}
              color={kycDone ? colors.success : colors.warning}
            />
          </View>
          <View style={styles.overallText}>
            <Text style={styles.statusTitle}>
              {kycDone ? 'KYC complete' : 'KYC in progress'}
            </Text>
            <Text style={styles.statusDesc}>
              {kycDone
                ? 'Your merchant account is verified with PaySprint.'
                : 'Finish web KYC to unlock AEPS services.'}
            </Text>
          </View>
        </CardContent>
      </Card>

      <SectionTitle>Merchant details</SectionTitle>
      <Card>
        <CardContent>
          <Row label="Merchant code" value={merchantId} />
          <Row label="Active pipes" value={activePipes.length ? activePipes.join(', ') : 'None'} />
          <Row
            label="Daily 2FA today"
            value={<StatusText status={status.data?.isDailyAuthDoneToday ? 'SUCCESS' : 'PENDING'} />}
          />
          <Row label="Last daily auth" value={shortDate(status.data?.lastDailyAuthDate)} last />
        </CardContent>
      </Card>

      <SectionTitle>Verification steps</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          {steps.map((step, i) => (
            <View key={step.id} style={[styles.step, i === steps.length - 1 && styles.stepLast]}>
              <View style={[styles.stepNumber, step.done && styles.stepNumberDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>{step.name}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              <StatusText status={step.done ? 'COMPLETED' : 'PENDING'} />
            </View>
          ))}

          {!!onboard.error && <ErrorBanner message={onboard.error} />}
          {!!openError && <ErrorBanner message={openError} />}
          <Button
            onPress={onOpenOnboarding}
            loading={onboard.pending}
            disabled={!merchantId}
            size="lg"
            fullWidth
          >
            {kycDone ? 'Reopen onboarding portal' : 'Start web KYC'}
          </Button>
          <Button
            variant="outline"
            icon="fingerprint"
            onPress={() => setShowKyc(true)}
            disabled={!merchantId}
            fullWidth
          >
            {kycDone ? 'Run eKYC on another pipe' : 'Complete biometric eKYC'}
          </Button>
          <Button
            variant="outline"
            icon="shield-key-outline"
            onPress={() => setShowDailyAuth(true)}
            disabled={!merchantId || !!status.data?.isDailyAuthDoneToday}
            fullWidth
          >
            {status.data?.isDailyAuthDoneToday ? 'Daily 2FA done for today' : 'Do daily 2FA now'}
          </Button>
        </CardContent>
      </Card>

      {planSteps.length > 0 && (
        <>
          <SectionTitle>{`Onboarding plan · ${targetPipe}`}</SectionTitle>
          <Card>
            <CardContent>
              {planSteps.map((step: any, i: number) => (
                <Row
                  key={i}
                  label={step.title || step.label || `Step ${i + 1}`}
                  value={<StatusText status={step.done ? 'COMPLETED' : 'PENDING'} />}
                  last={i === planSteps.length - 1}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {!kycDone && (
        <Banner
          tone="info"
          message="After completing onboarding in the browser, come back and pull down to refresh this screen."
        />
      )}

      <MerchantKycSheet
        visible={showKyc}
        initialPipe={targetPipe}
        onClose={() => setShowKyc(false)}
        onCompleted={() => {
          status.refresh();
          plan.refresh();
          pipes.refresh();
        }}
      />
      <DailyAuthSheet
        visible={showDailyAuth}
        onClose={() => setShowDailyAuth(false)}
        onCompleted={status.refresh}
        onNeedsKyc={() => setShowKyc(true)}
      />
    </Screen>
  );
};

/** BHIM status: small coloured text, never a filled pill. */
const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || 'PENDING').toUpperCase();
  const color = /SUCCESS|COMPLETE|APPROVED|ACTIVE|ACCEPTED|CONVERTED/.test(s)
    ? colors.success
    : /FAIL|REJECT/.test(s)
      ? colors.destructive
      : colors.warning;
  return (
    <Text style={{ fontSize: t.small, fontWeight: '500', color }}>
      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
    </Text>
  );
};

const styles = themed((c) => ({
  overall: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  statusCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallText: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: { fontSize: t.bodyLg + 1, fontWeight: '500', color: c.foreground },
  statusDesc: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  form: { gap: space.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  stepLast: { borderBottomWidth: 0 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberDone: { backgroundColor: c.success, borderColor: c.success },
  stepNumberText: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  stepInfo: { flex: 1, minWidth: 0, gap: 2 },
  stepName: { fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
  stepDesc: { fontSize: t.small, color: c.mutedForeground, lineHeight: 18 },
}));

export default KycStatusScreen;
