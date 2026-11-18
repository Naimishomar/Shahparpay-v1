import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, EmptyState, ErrorBanner, SectionTitle, StatusPill, money, dateTime, SkeletonRows } from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useInterval } from '@/hooks';
import { coordsPayload } from '@/services/location';
import api from '@/services/api';

const POLL_MS = 4000;
// Rate card range; the backend refuses anything outside it.
const MIN = 500;
const MAX = 5000;
const MOBILE_RE = /^[6-9]\d{9}$/;

type Txn = { transactionId: string; amount: number; status: string; customerMobile?: string; bankRRN?: string; payerName?: string; message?: string; createdAt?: string };
type Qr = { transactionId: string; qrCode: string; amount: number; expiresAt: number };

const failure = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;
const settled = (txn?: Txn | null) => txn?.status === 'SUCCESS' || txn?.status === 'FAILED';

/**
 * UPI cash withdrawal. Mirrors frontend/src/pages/UpiCashWithdrawal.tsx: the
 * customer scans a QR for the amount and pays from their UPI app; the Trade
 * wallet is credited when the bank confirms, and only then is cash handed over.
 */
export const UpiCashWithdrawalScreen: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [mobile, setMobile] = useState('');
  const [qr, setQr] = useState<Qr | null>(null);
  const [result, setResult] = useState<Txn | null>(null);
  const [now, setNow] = useState(Date.now());

  const history = useAsync<Txn[]>(async () => (await api.upiCwHistory()).data ?? [], []);

  const start = useAction(async () => {
    const coords = await coordsPayload();
    let res: any;
    try {
      res = await api.upiCwInitiate({ amount: Number(amount), customerMobile: mobile, ...coords });
    } catch (err) {
      throw new Error(failure(err, 'Could not start the UPI cash withdrawal'));
    }
    const d = res.data;
    setResult(null);
    setQr({ transactionId: d.transactionId, qrCode: d.qrCode, amount: d.amount, expiresAt: Date.now() + d.expiresIn * 1000 });
    setNow(Date.now());
    history.refresh();
    return true;
  });

  const check = useAction(async (transactionId: string) => {
    let res: any;
    try {
      res = await api.upiCwStatus(transactionId);
    } catch (err) {
      throw new Error(failure(err, 'Could not check the status'));
    }
    const txn: Txn = res.data;
    if (settled(txn)) {
      setQr(null);
      setResult(txn);
      history.refresh();
    }
    return txn;
  });

  // While a QR is up: tick the countdown and ask the bank every few seconds.
  useInterval(() => setNow(Date.now()), qr ? 1000 : null);
  useInterval(() => {
    if (qr && !check.pending) check.run(qr.transactionId);
  }, qr ? POLL_MS : null);

  const reset = () => {
    setQr(null);
    setResult(null);
    setAmount('');
    setMobile('');
  };
  const secondsLeft = qr ? Math.max(0, Math.round((qr.expiresAt - now) / 1000)) : 0;
  const valid = Number(amount) >= MIN && Number(amount) <= MAX && MOBILE_RE.test(mobile);

  return (
    <Screen refreshing={history.refreshing} onRefresh={history.refresh}>
      {result ? (
        <View style={[styles.card, styles.center]}>
          <Ionicons
            name={result.status === 'SUCCESS' ? 'checkmark-circle' : 'close-circle'}
            size={56}
            color={result.status === 'SUCCESS' ? colors.success : colors.destructive}
          />
          <Text style={styles.title}>{result.status === 'SUCCESS' ? `Received ${money(result.amount)}` : 'Payment failed'}</Text>
          <Text style={styles.muted}>
            {result.status === 'SUCCESS'
              ? `Credited to your Trade Wallet. Hand over ${money(result.amount)} cash now.`
              : result.message || 'No money was received. Do not give cash.'}
          </Text>
          {!!result.bankRRN && (
            <Text style={styles.muted}>
              RRN {result.bankRRN}
              {result.payerName ? ` · ${result.payerName}` : ''}
            </Text>
          )}
          <Button onPress={reset} fullWidth>
            New withdrawal
          </Button>
        </View>
      ) : qr ? (
        <View style={[styles.card, styles.center]}>
          <Text style={styles.muted}>Ask the customer to scan and pay</Text>
          <Text style={styles.amount}>{money(qr.amount)}</Text>
          {/* White in both themes: UPI apps need dark-on-light to read it. */}
          <View style={[styles.qrFrame, !secondsLeft && { opacity: 0.3 }]}>
            <QRCode value={qr.qrCode} size={220} color="#000" backgroundColor="#fff" />
          </View>
          <Text style={styles.label}>
            {secondsLeft
              ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} · waiting for payment…`
              : 'QR expired. If the customer already paid, check the status.'}
          </Text>
          <Text style={styles.warning}>Do not give cash until this screen shows success.</Text>
          {!!check.error && <ErrorBanner message={check.error} />}
          <Button variant="outline" icon="refresh" onPress={() => check.run(qr.transactionId)} loading={check.pending} fullWidth>
            Check status
          </Button>
          <Button variant="ghost" onPress={reset} fullWidth>
            Cancel
          </Button>
        </View>
      ) : (
        <View style={[styles.card, styles.form]}>
          <Input
            label="Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="e.g. 500"
          />
          <Text style={styles.hint}>₹{MIN} – ₹{MAX.toLocaleString('en-IN')} · Commission ₹1 (up to ₹1,000), ₹3 (up to ₹3,000), ₹6 (up to ₹5,000)</Text>
          <Input
            label="Customer Mobile"
            required
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="10-digit mobile"
          />
          {!!start.error && <ErrorBanner message={start.error} />}
          <Button icon="qrcode" onPress={() => start.run()} loading={start.pending} disabled={!valid} fullWidth>
            {start.pending ? 'Generating…' : 'Generate QR'}
          </Button>
        </View>
      )}

      <SectionTitle>Recent withdrawals</SectionTitle>
      {history.loading ? (
        <SkeletonRows count={3} />
      ) : !history.data?.length ? (
        <EmptyState title="No UPI cash withdrawals yet" />
      ) : (
        <View style={styles.card}>
          {history.data.map((txn) => (
            <View key={txn.transactionId} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.label}>{money(txn.amount)}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {txn.customerMobile} · {txn.createdAt ? dateTime(txn.createdAt) : ''}
                </Text>
              </View>
              {!settled(txn) && (
                <Pressable onPress={() => check.run(txn.transactionId)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.link}>Check</Text>
                </Pressable>
              )}
              <StatusPill status={txn.status} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
};

const styles = themed((c) => ({
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.border },
  form: { gap: space.lg },
  center: { alignItems: 'center', gap: space.md },
  qrFrame: { backgroundColor: '#fff', padding: 12, borderRadius: radius.sm },
  title: { fontSize: t.title, fontWeight: '600', color: c.foreground, textAlign: 'center' },
  amount: { fontSize: t.h2, fontWeight: '700', color: c.foreground },
  label: { fontSize: t.body, fontWeight: '500', color: c.foreground, textAlign: 'center' },
  muted: { fontSize: t.small, color: c.mutedForeground, textAlign: 'center' },
  warning: { fontSize: t.small, fontWeight: '600', color: c.warning, textAlign: 'center' },
  hint: { fontSize: t.small, color: c.mutedForeground },
  link: { fontSize: t.small, fontWeight: '600', color: c.foreground, textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
}));
