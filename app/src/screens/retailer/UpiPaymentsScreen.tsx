import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { themed, space, type as t, radius } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  StatusPill,
  SuccessBanner,
  money,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

const POLL_MS = 5000;
const POLL_LIMIT = 60; // ~5 minutes, then stop and let the retailer re-check.

export const UpiPaymentsScreen: React.FC = () => {
  const { user } = useAuth();
  const [mobile, setMobile] = useState(user?.contactNumber ?? '');
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [payLink, setPayLink] = useState<string | null>(null);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [txnStatus, setTxnStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  const status = useAsync<any>(async () => (await api.getUpiMerchantStatus()).data, []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const collect = useAction(async () => {
    const res = await api.generateUpiToken({ mobile: mobile.trim(), amount: Number(amount) });
    if (!res.success || !res.data?.url) {
      throw new Error(res.message || 'Failed to generate the UPI collect link.');
    }
    return res.data;
  });

  const onboard = useAction(async () => {
    const res = await api.getPaysprintOnboardUrl(
      user?.retailerId || user?.code || '',
      false,
      'bank6',
      'https://shahparpay-v1.vercel.app/kyc-callback'
    );
    if (!res.success) throw new Error(res.message);
    if (res.alreadyOnboarded) {
      status.reload();
      throw new Error('Your merchant is already onboarded on Bank 6. Pull to refresh.');
    }
    if (!res.url) throw new Error(res.message || 'PaySprint did not return an onboarding link.');
    return res.url as string;
  });

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pollCount.current = 0;
  };

  // Clean up on unmount so a backgrounded screen never keeps polling.
  useEffect(() => stopPolling, []);

  const startPolling = (transactionId: string) => {
    stopPolling();
    setTxnId(transactionId);
    setTxnStatus('PENDING');
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > POLL_LIMIT) {
        stopPolling();
        setStatusMessage('Still waiting. Tap "Check status" once the customer has paid.');
        return;
      }
      try {
        const res = await api.getUpiTxnStatus({ transactionId });
        const data = res?.data;
        if (!res?.success || !data) return;
        setTxnStatus(data.status);
        setStatusMessage(data.message || data.transaction?.metadata?.gatewayMessage || '');
        if (data.status === 'SUCCESS' || data.status === 'FAILED') {
          stopPolling();
          if (data.status === 'SUCCESS') {
            setNotice('UPI cashout successful. Amount credited to your main wallet.');
            balances.reload();
          }
        }
      } catch {
        // Transient poll failure: keep waiting rather than dropping the flow.
      }
    }, POLL_MS);
  };

  const checkOnce = useAction(async () => {
    if (!txnId) return null;
    const res = await api.getUpiTxnStatus({ transactionId: txnId });
    if (!res?.success) throw new Error(res?.message || 'Status check failed.');
    setTxnStatus(res.data?.status);
    setStatusMessage(res.data?.message || '');
    if (res.data?.status === 'SUCCESS') balances.reload();
    return res;
  });

  const onboarded = !!status.data?.onboarded;

  const onCollect = async () => {
    setNotice('');
    setPayLink(null);
    const data = await collect.run();
    if (!data) return;
    setPayLink(data.url);
    if (data.transactionId) startPolling(data.transactionId);
    if (await Linking.canOpenURL(data.url)) await Linking.openURL(data.url);
  };

  return (
    <Screen
      loading={status.loading}
      refreshing={status.refreshing}
      onRefresh={() => {
        status.refresh();
        balances.refresh();
      }}
      error={status.error}
      onRetry={status.reload}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(balances.data?.mainBalance)} mono />
          <Row label="Merchant code" value={status.data?.merchantCode} />
          <Row label="Pipe" value={status.data?.pipe} />
          <Row
            label="Onboarding"
            value={<StatusPill status={onboarded ? 'APPROVED' : 'PENDING'} />}
            last
          />
        </CardContent>
      </Card>

      {!onboarded ? (
        <Card>
          <CardHeader>
            <CardTitle icon="account-clock-outline">UPI collect is not active yet</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Banner
              tone="warning"
              message={
                status.data?.message ||
                'Your UPI merchant onboarding on Bank 6 is still pending approval.'
              }
            />
            {!!onboard.error && <ErrorBanner message={onboard.error} />}
            <Button
              onPress={async () => {
                const url = await onboard.run();
                if (url && (await Linking.canOpenURL(url))) await Linking.openURL(url);
              }}
              loading={onboard.pending}
              icon="open-in-new"
              fullWidth
            >
              Start Bank 6 onboarding
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle icon="qrcode">Collect payment</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Input
              label="Customer mobile"
              required
              value={mobile}
              onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
              leftIcon="phone-outline"
              autoComplete="tel"
            />
            <Input
              label="Amount"
              required
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="currency-inr"
            />
            {!!collect.error && <ErrorBanner message={collect.error} />}
            {!!notice && <SuccessBanner message={notice} />}
            <Button
              onPress={onCollect}
              disabled={mobile.length !== 10 || Number(amount) <= 0}
              loading={collect.pending}
              icon="qrcode-scan"
              size="lg"
              fullWidth
            >
              Generate collect link
            </Button>
            {!!payLink && (
              <Button variant="outline" icon="open-in-new" onPress={() => Linking.openURL(payLink)} fullWidth>
                Reopen payment page
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!!txnId && (
        <Card>
          <CardHeader>
            <CardTitle icon="progress-clock">Collection status</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Row label="Reference" value={txnId} />
            <Row label="Status" value={<StatusPill status={txnStatus} />} last={!statusMessage} />
            {!!statusMessage && <Row label="Message" value={statusMessage} last />}
            {!!checkOnce.error && <ErrorBanner message={checkOnce.error} />}
            {txnStatus !== 'SUCCESS' && (
              <Button
                variant="outline"
                icon="refresh"
                onPress={() => checkOnce.run()}
                loading={checkOnce.pending}
                fullWidth
              >
                Check status
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Screen>
  );
};

const styles = themed(() => ({
  form: { gap: space.lg },
}));

export default UpiPaymentsScreen;
