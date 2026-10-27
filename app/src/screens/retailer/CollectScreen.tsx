import React, { useState } from 'react';
import { View, Text, Share, TextInput, Pressable, Linking, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { TxnRow } from '@/components/ui/TransactionReport';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SectionTitle,
  SuccessBanner,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

/** The gateway refuses anything smaller: "Minimum amount is 200.00". */
const MIN_ORDER_AMOUNT = 200;

/** The gateway refuses an order with no email, though it documents it optional. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Collecting money from a customer.
 *
 * A payment link is a one-off order the customer pays by UPI, card or
 * netbanking; the wallet is credited only once the gateway confirms it, which is
 * why nothing here trusts the customer saying they paid and every order is
 * checked against the gateway.
 *
 * The standing counter QR is issued here too. Its payments settle into the
 * platform's Icchhamati wallet and are credited to the retailer's QR wallet,
 * less Icchhamati's charge, from which the retailer moves them to Main.
 */
export const CollectScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [notice, setNotice] = useState('');

  const history = useAsync<any[]>(async () => (await api.getCollectionHistory()).data ?? [], []);

  const createOrder = useAction(async () => {
    const res = await api.createCollectionOrder({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      amount: Number(amount),
    });
    if (!res.success) throw new Error(res.message);
    return res.data;
  });

  const verify = useAction(async (transactionId: string) => {
    const res = await api.verifyCollectionOrder(transactionId);
    // A customer who has not paid yet is not an error, so `success` being false
    // on a pending order must not read as a failure.
    return { status: res.data?.status ?? 'PENDING', message: res.message };
  });

  const orderValid =
    name.trim().length > 2 &&
    mobile.length === 10 &&
    EMAIL_RE.test(email.trim()) &&
    Number(amount) >= MIN_ORDER_AMOUNT;

  const onCheck = async (transactionId: string) => {
    const res = await verify.run(transactionId);
    if (!res) return;
    setNotice(res.message || `Payment ${res.status.toLowerCase()}`);
    setOrder((prev: any) =>
      prev && prev.transactionId === transactionId ? { ...prev, status: res.status } : prev
    );
    history.reload();
  };

  const reset = () => {
    setOrder(null);
    setAmount('');
    setNotice('');
  };

  const initials = (order?.name || 'C')
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
    >
      {!order ? (
        <>
          <View style={styles.entry}>
            <Text style={styles.entryTitle}>Request a payment</Text>
            <View style={styles.amountRow}>
              <Text style={[styles.amountSymbol, !amount && styles.amountPlaceholder]}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.borderStrong}
                style={[styles.amountInput, { width: Math.max(1, amount.length) * 30 + 8 }]}
                accessibilityLabel="Amount"
                maxLength={9}
              />
            </View>
            <Text
              style={[styles.entryHint, !!amount && Number(amount) < MIN_ORDER_AMOUNT && styles.entryError]}
            >
              {amount && Number(amount) < MIN_ORDER_AMOUNT
                ? `The minimum payment amount is ₹${MIN_ORDER_AMOUNT}`
                : 'Customer pays by UPI, card or netbanking'}
            </Text>
          </View>

          <SectionTitle>Customer</SectionTitle>
          <View style={[styles.card, styles.form]}>
            <Input
              label="Customer name"
              required
              value={name}
              onChangeText={setName}
              leftIcon="account-outline"
            />
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
              label="Customer email"
              required
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="email-outline"
              error={email.trim() && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : undefined}
            />
          </View>
          {!!createOrder.error && <ErrorBanner message={createOrder.error} />}
          <Button
            onPress={async () => {
              setNotice('');
              const data = await createOrder.run();
              if (data) {
                setOrder({ ...data, name: name.trim(), status: 'PENDING' });
                history.reload();
              }
            }}
            loading={createOrder.pending}
            disabled={!orderValid}
            fullWidth
          >
            Create payment link
          </Button>
        </>
      ) : (
        <>
          {/* BHIM's profile QR: the link as a white code on a dark card, the
              payee row under it, and Open | Share split across the bottom. */}
          <View style={styles.qrCard}>
            {!!order.paymentUrl && (
              <View style={styles.qrFrame}>
                {/* White in both themes: UPI apps need dark-on-light to read it. */}
                <QRCode value={String(order.paymentUrl)} size={220} color="#000" backgroundColor="#fff" />
              </View>
            )}
            <Text style={styles.link} selectable numberOfLines={2}>
              {order.paymentUrl}
            </Text>
            <View style={styles.payeeRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.payeeText}>
                <Text style={styles.payee} numberOfLines={1}>
                  {order.name}
                </Text>
                <Text style={styles.payeeMeta} numberOfLines={1}>
                  Order {order.orderId}
                </Text>
              </View>
              <View style={styles.payeeRight}>
                <Text style={styles.payeeAmount}>{money(order.amount)}</Text>
                {/* Pending is the strip below; only a settled order needs its status. */}
                {order.status !== 'PENDING' && (
                  <Text
                    style={[
                      styles.payeeStatus,
                      { color: order.status === 'SUCCESS' ? colors.success : order.status === 'FAILED' ? colors.destructive : colors.warning },
                    ]}
                  >
                    {String(order.status).charAt(0) + String(order.status).slice(1).toLowerCase()}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.split}>
              <Pressable
                onPress={() => Linking.openURL(order.paymentUrl).catch(() => {})}
                style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Open link"
              >
                <Ionicons name="open-outline" size={20} color={colors.foreground} />
                <Text style={styles.splitText}>Open link</Text>
              </Pressable>
              <View style={styles.splitRule} />
              <Pressable
                onPress={() =>
                  Share.share({
                    message: `Pay ₹${order.amount} here: ${order.paymentUrl}`,
                  })
                }
                style={({ pressed }) => [styles.splitAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Send link"
              >
                <Ionicons name="share-outline" size={20} color={colors.foreground} />
                <Text style={styles.splitText}>Send link</Text>
              </Pressable>
            </View>
          </View>

          {order.status === 'PENDING' && (
            <View style={styles.waiting} accessibilityRole="text">
              <Ionicons name="time-outline" size={22} color={colors.mutedForeground} />
              <View style={styles.waitingText}>
                <Text style={styles.waitingTitle}>Waiting for payment</Text>
                {/* This screen does not poll: say so rather than promise it updates. */}
                <Text style={styles.waitingHint}>Check the status once the customer has paid</Text>
              </View>
            </View>
          )}
          {!!verify.error && <ErrorBanner message={verify.error} />}
          {!!notice && <SuccessBanner message={notice} />}

          <Button
            onPress={() => onCheck(order.transactionId)}
            loading={verify.pending}
            fullWidth
          >
            Check payment status
          </Button>
          <Button variant="outline" onPress={reset} fullWidth>
            New amount
          </Button>
          <Text style={styles.footnote}>
            Your wallet is credited only once the gateway confirms the payment.
          </Text>
        </>
      )}

      <CounterQr onMoved={history.reload} />

      <SectionTitle>Recent collections</SectionTitle>
      {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
        <View style={styles.listCard}>
          {history.data.slice(0, 20).map((txn: any, index: number, list: any[]) => (
            <View key={txn.transactionId}>
              <TxnRow
                icon={txn.metadata?.collectionChannel === 'QR' ? 'qrcode' : 'link-variant'}
                title={txn.metadata?.payerName || txn.metadata?.remitterName || (txn.metadata?.collectionChannel === 'QR' ? 'Counter QR' : 'Payment link')}
                subtitle={txn.transactionId}
                date={shortDate(txn.createdAt)}
                amount={`${txn.status === 'SUCCESS' ? '+ ' : ''}${money(txn.amount)}`}
                credit={txn.status === 'SUCCESS'}
                failed={txn.status === 'FAILED'}
                status={txn.status}
                last={txn.status === 'PENDING' || index === list.length - 1}
              />
              {txn.status === 'PENDING' && (
                <View style={[styles.recheck, index === list.length - 1 && styles.recheckLast]}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    onPress={() => onCheck(txn.transactionId)}
                  >
                    Check status
                  </Button>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon="link-variant-off" title="No payment requests yet" />
      )}
    </Screen>
  );
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The retailer's standing counter QR, and the QR wallet its payments land in. */
const CounterQr: React.FC<{ onMoved: () => void }> = ({ onMoved }) => {
  const { user } = useAuth();
  const qr = useAsync<any>(async () => (await api.getCollectionQr()).data ?? null, []);
  const balance = useAsync<number>(async () => Number((await api.getWalletBalance()).data?.qrBalance) || 0, []);
  const [holder, setHolder] = useState(user?.name || '');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState('');

  const generate = useAction(async () => {
    const res = await api.generateCollectionQr({ name: holder.trim(), account_number: account, account_ifsc: ifsc });
    if (!res.success) throw new Error(res.message);
    qr.reload();
  });

  const move = useAction(async () => {
    const res = await api.transferQrToMain({ amount: Number(amount), pin });
    if (!res.success) throw new Error(res.message);
    setAmount('');
    setPin('');
    setNotice(res.message || 'Moved to your main wallet');
    balance.reload();
    onMoved();
  });

  const qrBalance = balance.data ?? 0;
  const code = qr.data;

  return (
    <>
      <SectionTitle>Counter QR</SectionTitle>
      <View style={[styles.card, styles.form]}>
        {qr.loading ? (
          <SkeletonRows count={2} />
        ) : code ? (
          <View style={styles.counterQr}>
            {!!code.qrImage && (
              <View style={styles.qrFrame}>
                <Image source={{ uri: code.qrImage }} style={styles.qrImage} accessibilityLabel="Your UPI QR code" />
              </View>
            )}
            {!!code.upiHandle && <Text style={styles.payee} selectable>{code.upiHandle}</Text>}
            <Text style={styles.payeeMeta}>Virtual account {code.virtualAccountId}</Text>
            <Text style={styles.footnote}>Print this for your counter. Every payment is credited to your QR wallet automatically.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.payeeMeta}>A standing UPI QR for your counter. Payments are credited to your QR wallet automatically.</Text>
            <Input label="Account holder name" required value={holder} onChangeText={setHolder} leftIcon="account-outline" />
            <Input
              label="Account number"
              required
              value={account}
              onChangeText={(v) => setAccount(v.replace(/\D/g, '').slice(0, 18))}
              keyboardType="number-pad"
              leftIcon="bank-outline"
            />
            <Input
              label="IFSC"
              required
              value={ifsc}
              onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
              autoCapitalize="characters"
              error={ifsc.length === 11 && !IFSC_RE.test(ifsc) ? 'Enter a valid IFSC' : undefined}
            />
            {!!generate.error && <ErrorBanner message={generate.error} />}
            <Button
              icon="qrcode"
              onPress={() => generate.run()}
              loading={generate.pending}
              disabled={holder.trim().length < 3 || account.length < 6 || !IFSC_RE.test(ifsc)}
              fullWidth
            >
              Generate QR
            </Button>
          </>
        )}
      </View>

      <SectionTitle>QR wallet</SectionTitle>
      <View style={[styles.card, styles.form]}>
        <View>
          <Text style={styles.payeeAmount}>{money(qrBalance)}</Text>
          <Text style={styles.payeeMeta}>Counter QR payments land here, less the provider's charge.</Text>
        </View>
        <Input
          label="Amount"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          leftIcon="currency-inr"
          error={Number(amount) > qrBalance ? 'More than your QR wallet balance' : undefined}
        />
        <Input
          label="Wallet PIN"
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          leftIcon="lock-outline"
        />
        {!!move.error && <ErrorBanner message={move.error} />}
        {!!notice && <SuccessBanner message={notice} />}
        <Button
          icon="bank-transfer-in"
          onPress={() => { setNotice(''); move.run(); }}
          loading={move.pending}
          disabled={!(Number(amount) > 0) || Number(amount) > qrBalance || pin.length !== 4}
          fullWidth
        >
          Move to main wallet
        </Button>
      </View>
    </>
  );
};

const styles = themed((c) => ({
  counterQr: { alignItems: 'center', gap: space.sm },
  qrImage: { width: 220, height: 220 },
  entry: { alignItems: 'center', paddingTop: space.lg, paddingBottom: space.sm, gap: space.md },
  entryTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
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
  link: { marginTop: space.md, fontSize: t.caption, color: c.mutedForeground, textAlign: 'center' },
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', paddingVertical: space.lg },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  payeeText: { flex: 1, minWidth: 0, gap: 2 },
  payee: { fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
  payeeMeta: { fontSize: t.small, color: c.mutedForeground },
  payeeRight: { alignItems: 'flex-end', gap: 2 },
  payeeAmount: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  payeeStatus: { fontSize: t.caption, fontWeight: '500' },
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
