import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Screen, Banner, ErrorBanner, Row, StatusPill, shortDate } from '@/components/ui/Screen';
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
      'https://shahparpay-v1.vercel.app/kyc-callback'
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
      refreshing={status.refreshing || pipes.refreshing}
      onRefresh={() => {
        status.refresh();
        pipes.refresh();
        plan.refresh();
      }}
      error={status.error}
      onRetry={status.reload}
    >
      <Card variant={kycDone ? 'accent' : 'default'}>
        <CardContent style={styles.overall}>
          <View style={[styles.statusCircle, kycDone && styles.statusCircleDone]}>
            <MaterialCommunityIcons
              name={kycDone ? 'shield-check' : 'clock-outline'}
              size={26}
              color={kycDone ? colors.accentForeground : colors.warning}
            />
          </View>
          <View style={styles.overallText}>
            <Text style={[styles.statusTitle, kycDone && { color: colors.accentForeground }]}>
              {kycDone ? 'KYC complete' : 'KYC in progress'}
            </Text>
            <Text style={[styles.statusDesc, kycDone && { color: colors.accentForeground }]}>
              {kycDone
                ? 'Your merchant account is verified with PaySprint.'
                : 'Finish web KYC to unlock AEPS services.'}
            </Text>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="store-outline">Merchant details</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Merchant code" value={merchantId} />
          <Row label="Active pipes" value={activePipes.length ? activePipes.join(', ') : 'None'} />
          <Row
            label="Daily 2FA today"
            value={<StatusPill status={status.data?.isDailyAuthDoneToday ? 'SUCCESS' : 'PENDING'} />}
          />
          <Row label="Last daily auth" value={shortDate(status.data?.lastDailyAuthDate)} last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="format-list-numbered">Verification steps</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {steps.map((step, i) => (
            <View key={step.id} style={styles.step}>
              <View style={[styles.stepNumber, step.done && styles.stepNumberDone]}>
                {step.done ? (
                  <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                ) : (
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>{step.name}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              <StatusPill status={step.done ? 'COMPLETED' : 'PENDING'} />
            </View>
          ))}

          {!!onboard.error && <ErrorBanner message={onboard.error} />}
          {!!openError && <ErrorBanner message={openError} />}
          <Button
            onPress={onOpenOnboarding}
            loading={onboard.pending}
            disabled={!merchantId}
            icon="open-in-new"
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
        <Card>
          <CardHeader>
            <CardTitle icon="map-marker-path">
              {`Onboarding plan · ${targetPipe}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planSteps.map((step: any, i: number) => (
              <Row
                key={i}
                label={step.title || step.label || `Step ${i + 1}`}
                value={<StatusPill status={step.done ? 'COMPLETED' : 'PENDING'} />}
                last={i === planSteps.length - 1}
              />
            ))}
          </CardContent>
        </Card>
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

const styles = themed((c) => ({
  overall: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  statusCircle: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: c.warningSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircleDone: { backgroundColor: 'rgba(0,0,0,0.14)' },
  overallText: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  statusDesc: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 17 },
  form: { gap: space.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberDone: { backgroundColor: c.success, borderColor: c.success },
  stepNumberText: { fontSize: t.micro, fontWeight: '700', color: c.foreground },
  stepInfo: { flex: 1, minWidth: 0, gap: 2 },
  stepName: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  stepDesc: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 15 },
}));

export default KycStatusScreen;
