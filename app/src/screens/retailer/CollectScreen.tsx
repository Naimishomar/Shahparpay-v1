import React, { useState } from 'react';
import { View, Text, Share } from 'react-native';
import { themed, radius, space, type as t } from '../../theme/colors';
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
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

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
 * The standing counter QR is issued from UPI payments, not here, but its
 * proceeds are collections too, so they are listed below alongside the links.
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

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
    >
      <Card>
        <CardHeader>
          <CardTitle icon="link-variant">New payment request</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
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
          <Input
            label="Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder={`${MIN_ORDER_AMOUNT}.00`}
            leftIcon="currency-inr"
            error={
              amount && Number(amount) < MIN_ORDER_AMOUNT
                ? `The minimum payment amount is ₹${MIN_ORDER_AMOUNT}`
                : undefined
            }
          />
          {!!createOrder.error && <ErrorBanner message={createOrder.error} />}
          <Button
            onPress={async () => {
              setNotice('');
              const data = await createOrder.run();
              if (data) {
                setOrder({ ...data, status: 'PENDING' });
                history.reload();
              }
            }}
            loading={createOrder.pending}
            disabled={!orderValid}
            icon="link-plus"
            size="lg"
            fullWidth
          >
            Create payment link
          </Button>
        </CardContent>
      </Card>

      {!!order && (
        <Card>
          <CardHeader>
            <CardTitle icon="receipt">Payment link</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <View style={styles.infoBox}>
              <Row label="Amount" value={money(order.amount)} mono />
              <Row label="Order" value={order.orderId} />
              <Row label="Status" value={order.status} last />
            </View>
            <Text style={styles.link} selectable>
              {order.paymentUrl}
            </Text>
            <Button
              variant="outline"
              icon="share-variant-outline"
              onPress={() =>
                Share.share({
                  message: `Pay ₹${order.amount} here: ${order.paymentUrl}`,
                })
              }
              fullWidth
            >
              Send to customer
            </Button>
            {!!verify.error && <ErrorBanner message={verify.error} />}
            {!!notice && <SuccessBanner message={notice} />}
            <Button
              variant="secondary"
              icon="refresh"
              onPress={() => onCheck(order.transactionId)}
              loading={verify.pending}
              fullWidth
            >
              Check payment status
            </Button>
            <Banner
              tone="info"
              message="Your wallet is credited only once the gateway confirms the payment."
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent collections</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Customer" value={txn.metadata?.payerName || '—'} />
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
                {txn.status === 'PENDING' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    onPress={() => onCheck(txn.transactionId)}
                  >
                    Check status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState icon="link-variant-off" title="No payment requests yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  infoBox: { padding: space.md, borderRadius: radius.md, backgroundColor: c.secondary },
  link: {
    fontSize: t.caption,
    color: c.foreground,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default CollectScreen;
