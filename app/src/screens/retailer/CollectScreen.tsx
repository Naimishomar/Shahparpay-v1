import React, { useState } from 'react';
import { View, Text, Share, Pressable, Linking, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { useIsFocused } from '@react-navigation/native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { TxnRow } from '@/components/ui/TransactionReport';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  SectionTitle,
  StatusPill,
  Toast,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useInterval } from '@/hooks';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

/** The gateway refuses anything smaller: "Minimum amount is 200.00". */
const MIN_ORDER_AMOUNT = 200;
const QUICK_AMOUNTS = [200, 500, 1000, 2000, 5000];

/** The gateway refuses an order with no email, though it documents it optional. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ToastState = { message: string; tone: 'error' | 'success' | 'info' };
type Notify = (message: string, tone?: ToastState['tone']) => void;

const errorMessage = (e: any, fallback: string) => e?.response?.data?.message || fallback;

/**
 * Collecting money from a customer. Mirrors the web portal's Collect page.
 *
 * A payment link is a one-off order the customer pays by UPI, card or
 * netbanking; the wallet is credited only once the gateway confirms it, which is
 * why nothing here trusts the customer saying they paid and every order is
 * checked against the gateway.
 *
 * The standing counter QR is issued here too; its payments are credited to the
 * Utility Wallet. The QR wallet card only lingers to empty an old balance.
 */
export const CollectScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<ToastState>({ message: '', tone: 'error' });
  const notify: Notify = (message, tone = 'error') => setToast({ message, tone });

  const history = useAsync<any[]>(async () => (await api.getCollectionHistory()).data ?? [], []);
  const rows = history.data ?? [];

  // Silent refetch: no skeleton flash, and a failed poll keeps the old rows.
  const fetchHistory = async () => {
    try {
      const res = await api.getCollectionHistory();
      if (res.success) history.setData(res.data || []);
    } catch {
      /* keep what is on screen */
    }
  };

  // Keep pending rows in sync while the screen is visible, but only while
  // something is actually pending; settled history never changes.
  const focused = useIsFocused();
  const hasPending = rows.some((row) => row.status === 'PENDING');
  useInterval(fetchHistory, focused && hasPending ? 20000 : null);

  const verify = async (reference: string) => {
    setVerifying(true);
    try {
      const res = await api.verifyCollectionOrder(reference);
      const status = res.data?.status || 'PENDING';
      if (status === 'SUCCESS') notify(res.message || 'Payment received', 'success');
      else if (status === 'PENDING') notify(res.message || 'Payment not completed yet', 'info');
      else notify(res.message || 'Payment failed');
      setOrder((prev: any) => (prev && prev.transactionId === reference ? { ...prev, status } : prev));
      fetchHistory();
    } catch (e) {
      notify(errorMessage(e, 'Could not verify the payment'));
    } finally {
      setVerifying(false);
    }
  };

  const createOrder = async () => {
    const value = Number(amount);
    if (!name.trim()) return notify("Enter the customer's name");
    if (mobile.length !== 10) return notify('Enter a valid 10-digit mobile number');
    if (!EMAIL_RE.test(email.trim())) return notify("Enter the customer's email address");
    if (!(value >= MIN_ORDER_AMOUNT)) return notify(`The minimum payment amount is ₹${MIN_ORDER_AMOUNT}`);

    setCreating(true);
    try {
      const res = await api.createCollectionOrder({
        name: name.trim(),
        mobile,
        email: email.trim(),
        amount: value,
      });
      if (res.success) {
        setOrder({ ...res.data, status: 'PENDING' });
        fetchHistory();
      } else {
        notify(res.message || 'Could not create the payment link');
      }
    } catch (e) {
      notify(errorMessage(e, 'Could not create the payment link'));
    } finally {
      setCreating(false);
    }
  };

  // Brings an earlier link back into the request card, to share or check again.
  const showOrder = (row: any) =>
    setOrder({
      transactionId: row.transactionId,
      orderId: row.metadata?.orderId || row.transactionId,
      paymentUrl: row.metadata?.paymentUrl,
      amount: row.amount,
      status: row.status,
    });

  const collected = rows
    .filter((r) => r.status === 'SUCCESS')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
      overlay={<Toast message={toast.message} tone={toast.tone} onHide={() => setToast((s) => ({ ...s, message: '' }))} />}
    >
      <Text style={styles.entryHint}>Send a payment link the customer can pay by UPI, card or netbanking.</Text>
      <View style={styles.stats}>
        <View style={[styles.card, styles.stat]}>
          <Text style={styles.payeeMeta}>Collected</Text>
          <Text style={styles.payeeAmount}>{money(collected)}</Text>
        </View>
        <View style={[styles.card, styles.stat]}>
          <Text style={styles.payeeMeta}>Pending</Text>
          <Text style={styles.payeeAmount}>{pendingCount}</Text>
        </View>
      </View>

      <SectionTitle>New Payment Request</SectionTitle>
      <View style={[styles.card, styles.form]}>
        <Input label="Customer Name" value={name} onChangeText={setName} placeholder="Full name" leftIcon="account-outline" />
        <Input
          label="Customer Mobile"
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
          keyboardType="number-pad"
          placeholder="10-digit mobile"
          leftIcon="phone-outline"
          autoComplete="tel"
        />
        <Input
          label="Customer Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          leftIcon="email-outline"
        />
        <View>
          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder={`Minimum ₹${MIN_ORDER_AMOUNT}`}
            leftIcon="currency-inr"
          />
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((preset) => {
              const on = amount === String(preset);
              return (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  style={({ pressed }) => [styles.quickChip, on && styles.quickChipOn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.quickText, on && styles.quickTextOn]}>₹{preset.toLocaleString('en-IN')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Button icon="link-variant" onPress={createOrder} loading={creating} fullWidth>
          Create Payment Link
        </Button>
      </View>

      {order ? (
        <View style={styles.qrCard}>
          {!!order.paymentUrl && (
            <View style={styles.qrFrame}>
              {/* White in both themes: UPI apps need dark-on-light to read it. */}
              <QRCode value={String(order.paymentUrl)} size={220} color="#000" backgroundColor="#fff" />
            </View>
          )}
          <View style={styles.payeeRow}>
            <View style={styles.payeeText}>
              <Text style={styles.payeeAmount}>{money(order.amount)}</Text>
              <Text style={styles.payeeMeta} numberOfLines={1}>
                Order {order.orderId}
              </Text>
            </View>
            <StatusPill status={order.status} />
          </View>
          <View style={styles.split}>
            <Pressable
              onPress={() => Linking.openURL(order.paymentUrl).catch(() => {})}
              style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="open-outline" size={20} color={colors.foreground} />
              <Text style={styles.splitText}>Open</Text>
            </Pressable>
            <View style={styles.splitRule} />
            {/* The web's "Copy link"; the native share sheet also offers Copy. */}
            <Pressable
              onPress={() => Share.share({ message: order.paymentUrl })}
              style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color={colors.foreground} />
              <Text style={styles.splitText}>Share</Text>
            </Pressable>
            <View style={styles.splitRule} />
            <Pressable
              onPress={() => verify(order.transactionId)}
              disabled={verifying}
              style={({ pressed }) => [styles.splitAction, (pressed || verifying) && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={20} color={colors.foreground} />
              <Text style={styles.splitText}>Status</Text>
            </Pressable>
          </View>
          <Text style={[styles.footnote, styles.qrCardFootnote]}>Credited only once the gateway confirms it.</Text>
        </View>
      ) : (
        <EmptyState icon="qrcode" title="No active request" />
      )}

      <CounterQr notify={notify} />

      <QrWallet notify={notify} qrCredits={rows.filter((r) => r.metadata?.collectionChannel === 'QR').length} />

      <SectionTitle
        action={
          <Button variant="ghost" size="sm" icon="refresh" onPress={fetchHistory}>
            Refresh
          </Button>
        }
      >
        Recent Collections
      </SectionTitle>
      {history.loading ? <SkeletonRows count={3} /> : rows.length ? (
        <View style={styles.listCard}>
          {rows.map((txn: any, index: number, list: any[]) => {
            const isQr = txn.metadata?.collectionChannel === 'QR';
            return (
              <View key={txn.transactionId}>
                <TxnRow
                  icon={isQr ? 'qrcode' : 'link-variant'}
                  title={txn.metadata?.payerName || txn.metadata?.remitterName || '—'}
                  subtitle={isQr ? 'QR' : 'Link'}
                  date={shortDate(txn.createdAt)}
                  amount={money(txn.amount)}
                  credit={txn.status === 'SUCCESS'}
                  failed={txn.status === 'FAILED'}
                  status={txn.status}
                  last={txn.status === 'PENDING' || index === list.length - 1}
                  onPress={txn.metadata?.paymentUrl ? () => showOrder(txn) : undefined}
                />
                {txn.status === 'PENDING' && (
                  <View style={[styles.recheck, index === list.length - 1 && styles.recheckLast]}>
                    <Button variant="ghost" size="sm" icon="refresh" onPress={() => verify(txn.transactionId)}>
                      Check
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState icon="inbox-outline" title="No payment requests yet." />
      )}
    </Screen>
  );
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The retailer's standing counter QR. */
const CounterQr: React.FC<{ notify: Notify }> = ({ notify }) => {
  const { user } = useAuth();
  const qr = useAsync<any>(async () => (await api.getCollectionQr()).data ?? null, []);
  const [holder, setHolder] = useState(user?.name || '');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!holder.trim() || !account || !IFSC_RE.test(ifsc)) {
      return notify('Enter the account holder name, account number and a valid IFSC');
    }
    setGenerating(true);
    try {
      const res = await api.generateCollectionQr({ name: holder, account_number: account, account_ifsc: ifsc });
      if (res.success) {
        qr.setData(res.data);
        notify(res.message || 'QR code generated', 'success');
      } else notify(res.message || 'Could not generate the QR code');
    } catch (e) {
      notify(errorMessage(e, 'Could not generate the QR code'));
    } finally {
      setGenerating(false);
    }
  };

  const code = qr.data;
  const upiUri = code?.upiHandle
    ? `upi://pay?pa=${encodeURIComponent(code.upiHandle)}${code.name ? `&pn=${encodeURIComponent(code.name)}` : ''}&cu=INR`
    : '';

  return (
    <>
      <SectionTitle>QR/UPI Transaction</SectionTitle>
      <View style={[styles.card, styles.form]}>
        <Text style={styles.payeeMeta}>
          A standing UPI QR to print for your counter. Every payment is credited to your Utility Wallet automatically.
        </Text>
        {qr.loading ? (
          <SkeletonRows count={2} />
        ) : code ? (
          <View style={styles.counterQr}>
            {code.qrImage ? (
              <View style={styles.qrFrame}>
                <Image source={{ uri: code.qrImage }} style={styles.qrImage} accessibilityLabel="Your UPI QR code" />
              </View>
            ) : !!upiUri && (
              // QRs generated before the provider's image was kept: draw it from the UPI handle.
              <View style={styles.qrFrame} accessibilityLabel="Your UPI QR code">
                <QRCode value={upiUri} size={220} />
              </View>
            )}
            {!!code.upiHandle && <Text style={styles.payee} selectable>{code.upiHandle}</Text>}
            <Text style={styles.payeeMeta}>Virtual account {code.virtualAccountId}</Text>
            {/* ponytail: opens the provider's file to save; a handle-only QR has no file, so no download there. */}
            {!!code.qrImage && (
              <Button variant="outline" icon="download" onPress={() => Linking.openURL(code.qrImage).catch(() => {})} fullWidth>
                Download QR
              </Button>
            )}
            {!!code.qrPdf && (
              <Button variant="outline" icon="download" onPress={() => Linking.openURL(code.qrPdf).catch(() => {})} fullWidth>
                Printable PDF
              </Button>
            )}
          </View>
        ) : (
          <>
            <Input label="Account holder name" value={holder} onChangeText={setHolder} leftIcon="account-outline" />
            <Input
              label="Account number"
              value={account}
              onChangeText={(v) => setAccount(v.replace(/\D/g, '').slice(0, 18))}
              keyboardType="number-pad"
              leftIcon="bank-outline"
            />
            <Input
              label="IFSC"
              value={ifsc}
              onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
              autoCapitalize="characters"
            />
            <Button icon="qrcode" onPress={generate} loading={generating} fullWidth>
              Generate QR
            </Button>
          </>
        )}
      </View>
    </>
  );
};

/** The legacy QR wallet balance, and the move out of it into Utility. */
const QrWallet: React.FC<{ notify: Notify; qrCredits: number }> = ({ notify, qrCredits }) => {
  // A QR payment arrives by webhook and shows up in the history; the balance follows it.
  const balance = useAsync<number>(async () => Number((await api.getWalletBalance()).data?.qrBalance) || 0, [qrCredits]);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [moving, setMoving] = useState(false);
  const qrBalance = balance.data ?? 0;

  const moveToUtility = async () => {
    const value = Number(amount);
    if (!(value > 0)) return notify('Enter an amount');
    if (value > qrBalance) return notify('That is more than your QR wallet balance');
    if (!/^\d{4}$/.test(pin)) return notify('Enter your 4-digit wallet PIN');
    setMoving(true);
    try {
      const res = await api.transferQrToMain({ amount: value, pin });
      if (res.success) {
        notify(res.message || 'Moved to your Utility Wallet', 'success');
        setAmount('');
        setPin('');
        balance.reload();
      } else notify(res.message || 'Transfer failed');
    } catch (e) {
      notify(errorMessage(e, 'Transfer failed'));
    } finally {
      setMoving(false);
    }
  };

  // QR payments now credit Utility directly; this only empties an old QR balance.
  if (qrBalance <= 0) return null;

  return (
    <>
      <SectionTitle>QR wallet</SectionTitle>
      <View style={[styles.card, styles.form]}>
        <View>
          <Text style={styles.payeeAmount}>{money(qrBalance)}</Text>
          <Text style={styles.payeeMeta}>QR/UPI money from before payments went straight to your Utility Wallet.</Text>
        </View>
        <View>
          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            leftIcon="currency-inr"
          />
          <Pressable onPress={() => setAmount(String(qrBalance))} hitSlop={8} accessibilityRole="button">
            <Text style={styles.fullBalance}>Use full balance</Text>
          </Pressable>
        </View>
        <Input
          label="Wallet PIN"
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          leftIcon="lock-outline"
        />
        <Button icon="bank-transfer-in" onPress={moveToUtility} loading={moving} fullWidth>
          Move to Utility Wallet
        </Button>
      </View>
    </>
  );
};

const styles = themed((c) => ({
  counterQr: { alignItems: 'center', gap: space.sm },
  qrImage: { width: 220, height: 220 },
  entryHint: { fontSize: t.small, color: c.mutedForeground },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, gap: 2 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  quickChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  quickChipOn: { backgroundColor: c.surfaceAlt, borderColor: c.foreground },
  quickText: { fontSize: t.small, color: c.mutedForeground },
  quickTextOn: { color: c.foreground, fontWeight: '500' },
  fullBalance: { marginTop: space.sm, fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
  qrCardFootnote: { paddingBottom: space.lg },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  form: { gap: space.lg },
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
  qrFrame: { backgroundColor: '#fff', padding: 12, borderRadius: radius.sm },
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', paddingVertical: space.lg },
  payeeText: { flex: 1, minWidth: 0, gap: 2 },
  payee: { fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
  payeeMeta: { fontSize: t.small, color: c.mutedForeground },
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
  footnote: { fontSize: t.caption, color: c.mutedForeground, textAlign: 'center', lineHeight: 18 },
  listCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  recheck: { alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: c.border },
  recheckLast: { borderBottomWidth: 0 },
}));

export default CollectScreen;
