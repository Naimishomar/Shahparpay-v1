import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { themed, space, type as t, radius } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  Row,
  StatusPill,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

/**
 * Self-service wallet top-up over a Razorpay UPI QR.
 *
 * The retailer picks an amount, scans the QR from any UPI app, and the main
 * wallet is credited when Razorpay confirms the payment. The screen polls the
 * backend for that confirmation instead of asking the retailer whether they
 * paid — only a captured payment credits anything.
 */

const MIN_TOPUP = 100;
const MAX_TOPUP = 100000;
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

/** `qrImage` is Razorpay's hosted QR poster; the API returns no raw UPI string. */
type Topup = { transactionId: string; qrImage: string; amount: number };

export const AddMoneyScreen: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [topup, setTopup] = useState<Topup | null>(null);
  const [status, setStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED'>('PENDING');
  const [notice, setNotice] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const history = useAsync<any[]>(async () => (await api.getTopupHistory()).data ?? [], []);

  const create = useAction(async (value: number) => {
    const res = await api.createTopupQr(value);
    if (!res.success) throw new Error(res.message);
    return res.data as Topup;
  });

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  // A screen the retailer navigated away from must stop hitting the API.
  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (!topup || status !== 'PENDING') return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.getTopupStatus(topup.transactionId);
        const next = res?.data?.status;
        if (next && next !== 'PENDING') {
          stopPolling();
          setStatus(next);
          setNotice(
            next === 'SUCCESS'
              ? `${money(res.data.amount)} added to your main wallet.`
              : ''
          );
          // The balance in the header is cached; a credit has to invalidate it.
          api.invalidateCache();
          history.reload();
        }
      } catch {
        // A dropped poll is not a failed payment: the webhook still settles it.
      }
    }, 4000);
    return stopPolling;
  }, [topup, status]);

  const value = Number(amount);
  const valid = value >= MIN_TOPUP && value <= MAX_TOPUP;

  const onGenerate = async () => {
    setNotice('');
    const data = await create.run(value);
    if (data) {
      setTopup(data);
      setStatus('PENDING');
    }
  };

  const reset = () => {
    stopPolling();
    setTopup(null);
    setAmount('');
    setStatus('PENDING');
    setNotice('');
    history.reload();
  };

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
    >
      <Card>
        <CardHeader>
          <CardTitle icon="qrcode-scan">Add money by UPI</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!topup ? (
            <>
              <Input
                label="Amount"
                required
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                leftIcon="currency-inr"
                helperText={`Minimum ${money(MIN_TOPUP)}, maximum ${money(MAX_TOPUP)} per payment`}
                error={amount && !valid ? `Enter between ${money(MIN_TOPUP)} and ${money(MAX_TOPUP)}` : undefined}
              />

              <View style={styles.quickRow}>
                {QUICK_AMOUNTS.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setAmount(String(preset))}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickText}>{money(preset)}</Text>
                  </Pressable>
                ))}
              </View>

              {!!create.error && <ErrorBanner message={create.error} />}

              <Button
                onPress={onGenerate}
                disabled={!valid}
                loading={create.pending}
                icon="qrcode"
                size="lg"
                fullWidth
              >
                Generate UPI QR
              </Button>
            </>
          ) : (
            <View style={styles.qrBlock}>
              <Text style={styles.qrHint}>
                Scan with any UPI app to pay {money(topup.amount)}
              </Text>
              {/* Razorpay's poster is a tall 674x1644 sheet, not a bare square
                  code. Forced into a square box it was cropped/squashed and UPI
                  apps read it as an invalid QR, so the box keeps the poster's
                  shape and `contain` never distorts it. */}
              <View style={styles.qrFrame}>
                <Image
                  source={{ uri: topup.qrImage }}
                  style={styles.qrImage}
                  resizeMode="contain"
                  accessibilityLabel="UPI QR code"
                />
              </View>
              <Text style={styles.reference}>Ref {topup.transactionId}</Text>

              {status === 'PENDING' && (
                <Text style={styles.waiting}>Waiting for your payment…</Text>
              )}
              {!!notice && <SuccessBanner message={notice} />}
              {status === 'FAILED' && <ErrorBanner message="The payment did not go through." />}

              <Button
                onPress={reset}
                variant={status === 'PENDING' ? 'ghost' : 'default'}
                icon={status === 'PENDING' ? 'close' : 'plus'}
                fullWidth
              >
                {status === 'PENDING' ? 'Cancel' : 'Add more money'}
              </Button>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent top-ups</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.map((row: any) => (
              <View key={row._id} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(row.amount)}</Text>
                  <StatusPill status={row.status} />
                </View>
                <Row label="Reference" value={row.transactionId} />
                <Row label="Paid on" value={shortDate(row.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState
              icon="wallet-outline"
              title="No top-ups yet"
              subtitle="Money you add by UPI shows up here"
            />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  quickText: { fontSize: t.caption, color: c.foreground, fontWeight: '600' },
  qrBlock: { gap: space.lg, alignItems: 'center' },
  qrHint: { fontSize: t.body, color: c.mutedForeground, textAlign: 'center' },
  qrImage: { width: 260, height: 634 },
  qrFrame: {
    backgroundColor: '#fff',
    padding: space.lg,
    borderRadius: radius.lg,
  },
  reference: { fontSize: t.caption, color: c.mutedForeground },
  waiting: { fontSize: t.caption, color: c.mutedForeground },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  itemAmount: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
}));
