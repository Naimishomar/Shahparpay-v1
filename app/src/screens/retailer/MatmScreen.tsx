import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { themed, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  Segmented,
  StatusPill,
  SuccessBanner,
  money,
  dateTime,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

const TRANSACTION_TYPES = [
  { key: 'WDLS', label: 'Cash withdrawal' },
  { key: 'BAL', label: 'Balance enquiry' },
] as const;

type TxnType = (typeof TRANSACTION_TYPES)[number]['key'];

/**
 * The provider wants the terminal's own clock as `DD/MM/YYYY HH:mm:ss` in
 * local time. Built by hand rather than from a locale format: `en-IN` renders
 * a 12-hour clock with an am/pm suffix, which the gateway rejects.
 */
const providerTime = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
};

/**
 * Micro ATM. The card is read on the retailer's own MATM device, which prints
 * the terminal ID, the bank RRN and the masked card number on its slip; this
 * screen posts that slip to the provider so the money settles into the wallet.
 *
 * Same flow as the web portal, including the mandatory config call — the
 * provider will not accept a transaction on a terminal it has not initialised
 * in this session.
 */
export const MatmScreen: React.FC = () => {
  const { user } = useAuth();
  const [mobile, setMobile] = useState(user?.contactNumber ?? '');
  const [amount, setAmount] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [txnType, setTxnType] = useState<TxnType>('WDLS');
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [bankRRN, setBankRRN] = useState('');
  const [fpTransactionId, setFpTransactionId] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = useAsync<any>(async () => {
    const res = await api.getMatmConfig();
    if (!res.success) throw new Error(res.message || 'Could not initialize MATM.');
    return res.data;
  }, []);

  const history = useAsync<any[]>(async () => (await api.getMatmHistory()).data ?? [], []);

  const submit = useAction(async () => {
    const res = await api.processMatm({
      mobile,
      data: {
        terminalId: terminalId.trim(),
        requestTransactionTime: providerTime(),
        transactionAmount: Number(amount),
        transactionStatus: 'successful',
        balanceAmount: 0,
        bankRRN: bankRRN.trim(),
        transactionType: txnType,
        fpTransactionId: fpTransactionId.trim(),
        errorCode: '00',
        errorMessage: 'Success',
        cardType: cardType.trim() || 'Unknown',
        bankName: bankName.trim(),
        cardNumber: cardNumber.trim(),
      },
    });
    // 202 answers carry `pending` without `success`; both mean the provider
    // took the request, so neither should surface as a failure.
    if (!res.success && !res.pending) throw new Error(res.message || 'MATM transaction failed.');
    return res;
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = 'Enter a valid 10-digit mobile number';
    if (!(Number(amount) > 0)) next.amount = 'Enter the amount printed on the slip';
    if (!terminalId.trim()) next.terminalId = 'Enter the MATM terminal ID';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const onSubmit = async () => {
    setNotice('');
    if (!validate()) return;
    const res = await submit.run();
    if (!res) return;
    setNotice(res.message || 'MATM request submitted.');
    setReceipt({ ...(res.data ?? {}), amount: Number(amount), transactionType: txnType });
    setAmount('');
    setBankRRN('');
    setFpTransactionId('');
    history.reload();
  };

  return (
    <Screen
      refreshing={history.refreshing || config.refreshing}
      onRefresh={() => {
        config.refresh();
        history.refresh();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle icon="access-point-network">Terminal</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {config.error ? (
            <ErrorBanner message={config.error} onRetry={config.reload} />
          ) : config.loading ? (
            <Text style={styles.help}>Initializing the terminal…</Text>
          ) : (
            <Banner
              tone="success"
              message="Terminal initialized. Swipe the card on your MATM device, then enter the slip below."
            />
          )}
          <Text style={styles.help}>
            Your MATM outlet is configured on the server and cannot be changed from the app.
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="credit-card-outline">Transaction slip</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Segmented
            options={TRANSACTION_TYPES as unknown as { key: TxnType; label: string }[]}
            value={txnType}
            onChange={setTxnType}
            scroll={false}
          />
          <Input
            label="Customer mobile"
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            leftIcon="cellphone"
            maxLength={10}
            required
            error={errors.mobile}
          />
          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            leftIcon="currency-inr"
            required
            error={errors.amount}
          />
          <Input
            label="Terminal ID"
            value={terminalId}
            onChangeText={setTerminalId}
            autoCapitalize="characters"
            leftIcon="devices"
            placeholder="NSD60705"
            required
            error={errors.terminalId}
          />
          <Input label="Bank name" value={bankName} onChangeText={setBankName} leftIcon="bank" />
          <Input
            label="Card type"
            value={cardType}
            onChangeText={setCardType}
            leftIcon="credit-card-outline"
            placeholder="Rupay / Visa"
          />
          <Input
            label="Card number (masked)"
            value={cardNumber}
            onChangeText={setCardNumber}
            leftIcon="credit-card-multiple-outline"
            placeholder="************3808"
          />
          <Input
            label="Bank RRN"
            value={bankRRN}
            onChangeText={setBankRRN}
            leftIcon="pound"
            helperText="Printed on the device slip"
          />
          <Input
            label="FP transaction ID"
            value={fpTransactionId}
            onChangeText={setFpTransactionId}
            leftIcon="identifier"
          />

          {!!submit.error && <ErrorBanner message={submit.error} />}
          {!!notice && <SuccessBanner message={notice} />}

          <Button
            onPress={onSubmit}
            loading={submit.pending}
            disabled={!!config.error}
            icon="send"
            size="lg"
            haptic="medium"
            fullWidth
          >
            Submit transaction
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">MATM history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Terminal" value={txn.metadata?.terminalId || '—'} />
                <Row label="Bank RRN" value={txn.metadata?.bankRRN || '—'} />
                <Row label="Date" value={dateTime(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState
              icon="credit-card-outline"
              title="No MATM transactions yet"
              subtitle="Every card transaction you submit appears here"
            />
          )}
        </CardContent>
      </Card>

      <Sheet
        visible={!!receipt}
        onClose={() => setReceipt(null)}
        title="MATM receipt"
        icon="receipt"
      >
        {!!receipt && (
          <View>
            <Row label="Amount" value={money(receipt.amount)} mono />
            <Row label="Status" value={<StatusPill status={receipt.status} />} />
            <Row label="Reference" value={receipt.transactionId || '—'} mono />
            <Row label="Provider reference" value={receipt.providerTransactionId || '—'} mono />
            <Row label="Bank RRN" value={receipt.bankRRN || '—'} mono />
            <Row label="Type" value={receipt.transactionType} last />
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  help: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default MatmScreen;
