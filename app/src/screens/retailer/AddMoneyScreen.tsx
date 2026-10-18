import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Share, TextInput, Linking, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, space, type as t, radius } from '../../theme/colors';
import { TxnRow } from '@/components/ui/TransactionReport';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  SectionTitle,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

/** Whole-rupee amounts read as the design writes them: ₹ 500, not ₹ 500.00. */
const rupees = (value: number) => money(value).replace(/\.00$/, '');

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
type Topup = { transactionId: string; qrImage: string; amount: number; expiresAt?: string };

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

  const expiresIn = useCountdown(status === 'PENDING' ? topup?.expiresAt : undefined);

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
    >
      {!topup ? (
        <View style={styles.entry}>
          <IconTile icon="wallet-outline" size={64} iconSize={28} />
          <Text style={styles.entryTitle}>Add money to main wallet</Text>
          <View style={styles.entryChip}>
            <Ionicons name="qr-code-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.entryChipText}>Pay by any UPI app</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={[styles.amountSymbol, !amount && styles.amountPlaceholder]}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.borderStrong}
              style={[styles.amountInput, { width: amountWidth(amount) }]}
              accessibilityLabel="Amount"
              maxLength={9}
            />
          </View>
          <Text style={[styles.entryHint, !!amount && !valid && styles.entryError]}>
            {amount && !valid
              ? `Enter between ${rupees(MIN_TOPUP)} and ${rupees(MAX_TOPUP)}`
              : `Minimum ${rupees(MIN_TOPUP)}, maximum ${rupees(MAX_TOPUP)} per payment`}
          </Text>

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((preset) => {
              const on = Number(amount) === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  style={({ pressed }) => [styles.quickChip, on && styles.quickChipOn, pressed && styles.pressed]}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Add ${rupees(preset)}`}
                >
                  <Text style={[styles.quickText, on && styles.quickTextOn]}>{rupees(preset)}</Text>
                </Pressable>
              );
            })}
          </View>

          {!!create.error && <ErrorBanner message={create.error} />}

          <Button onPress={onGenerate} disabled={!valid} loading={create.pending} fullWidth style={styles.entryButton}>
            Generate UPI QR
          </Button>
        </View>
      ) : (
        <>
          {/* BHIM's profile QR: a dark card holding the white code, the payee
              row under it, then Download | Share split across the bottom. */}
          <View style={styles.qrCard}>
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
            <View style={styles.payeeRow}>
              <IconTile icon="wallet-outline" size={44} iconSize={20} />
              <View style={styles.payeeText}>
                {/* The QR is created under this name (topup.controller). */}
                <Text style={styles.payee}>Wallet top-up</Text>
                <Text style={styles.payeeMeta} numberOfLines={1}>
                  {expiresIn || 'Scan with any UPI app'}
                </Text>
              </View>
              <Text style={styles.payeeAmount}>{rupees(topup.amount)}</Text>
            </View>
            <View style={styles.split}>
              <Pressable
                onPress={() => Linking.openURL(topup.qrImage).catch(() => {})}
                style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Download QR"
              >
                <Ionicons name="download-outline" size={20} color={colors.foreground} />
                <Text style={styles.splitText}>Download QR</Text>
              </Pressable>
              <View style={styles.splitRule} />
              <Pressable
                onPress={() =>
                  Share.share({ message: `Scan to pay ${money(topup.amount)} by UPI: ${topup.qrImage}` })
                }
                style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Share QR"
              >
                <Ionicons name="share-outline" size={20} color={colors.foreground} />
                <Text style={styles.splitText}>Share QR</Text>
              </Pressable>
            </View>
          </View>

          {status === 'PENDING' && (
            <View style={styles.waiting} accessibilityRole="text">
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <View style={styles.waitingText}>
                <Text style={styles.waitingTitle}>Waiting for payment</Text>
                <Text style={styles.waitingHint}>Updates on its own</Text>
              </View>
            </View>
          )}
          {!!notice && <SuccessBanner message={notice} />}
          {status === 'FAILED' && <ErrorBanner message="The payment did not go through." />}

          {status === 'PENDING' ? (
            <Button onPress={reset} variant="outline" fullWidth>
              New amount
            </Button>
          ) : (
            <Button onPress={reset} fullWidth>
              Add more money
            </Button>
          )}
        </>
      )}

      <SectionTitle>Recent top-ups</SectionTitle>
      {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
        <View style={styles.listCard}>
          {history.data.map((row: any, index: number) => (
            <TxnRow
              key={row._id ?? row.transactionId}
              icon="qrcode"
              title="UPI collected"
              subtitle="Wallet top-up"
              date={shortDate(row.createdAt)}
              amount={`${row.status === 'SUCCESS' ? '+ ' : ''}${money(row.amount)}`}
              credit={row.status === 'SUCCESS'}
              failed={row.status === 'FAILED'}
              status={row.status}
              last={index === history.data!.length - 1}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="wallet-outline"
          title="No top-ups yet"
          subtitle="Money you add by UPI shows up here"
        />
      )}
    </Screen>
  );
};

/** "Expires in 09:42" until `iso`, ticking each second; '' once gone or unknown. */
const useCountdown = (iso?: string) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  const left = iso ? Math.floor((new Date(iso).getTime() - now) / 1000) : NaN;
  if (!Number.isFinite(left)) return '';
  if (left <= 0) return 'This QR has expired';
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return `Expires in ${mm}:${ss}`;
};

/** Width of the big amount field: it grows with the digits so "₹ 2,000" stays centred. */
const amountWidth = (value: string) => Math.max(1, value.length) * 30 + 8;

const styles = themed((c) => ({
  entry: { alignItems: 'center', paddingTop: space.lg, gap: space.md },
  entryTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginTop: space.xs },
  entryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  entryChipText: { fontSize: t.small, color: c.mutedForeground },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  amountSymbol: { fontSize: 44, fontWeight: '300', color: c.foreground, marginRight: 6 },
  amountPlaceholder: { color: c.borderStrong },
  amountInput: {
    fontSize: 52,
    fontWeight: '300',
    color: c.foreground,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
    outlineStyle: 'none',
  } as any,
  entryHint: { fontSize: t.small, color: c.mutedForeground, textAlign: 'center' },
  entryError: { color: c.destructive },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.sm },
  quickChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  quickChipOn: { backgroundColor: c.surfaceAlt, borderColor: c.foreground },
  quickText: { fontSize: t.body, color: c.mutedForeground },
  quickTextOn: { color: c.foreground, fontWeight: '500' },
  entryButton: { marginTop: space.lg, alignSelf: 'stretch' },
  pressed: { opacity: 0.6 },
  qrCard: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  // White in both themes: UPI apps need dark-on-light to read the code.
  qrFrame: { backgroundColor: '#fff', padding: 10, borderRadius: radius.sm },
  // 220 wide; the poster's own height follows.
  qrImage: { width: 220, height: Math.round((220 * 1644) / 674) },
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', paddingVertical: space.lg },
  payeeText: { flex: 1, minWidth: 0, gap: 2 },
  payee: { fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
  payeeMeta: { fontSize: t.small, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  payeeAmount: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  split: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  splitAction: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  splitText: { fontSize: t.body + 1, color: c.foreground },
  splitRule: { width: 1, height: 36, backgroundColor: c.border },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  waitingText: { flex: 1, gap: 2 },
  waitingTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  waitingHint: { fontSize: t.small, color: c.mutedForeground },
  listCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
}));
