import React, { useState } from 'react';
import { View, Text, Linking, Platform } from 'react-native';
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
  { key: 'ATMCW', label: 'Cash withdrawal' },
  { key: 'ATMBE', label: 'Balance enquiry' },
] as const;

type TxnType = (typeof TRANSACTION_TYPES)[number]['key'];

export const MatmScreen: React.FC = () => {
  const { user } = useAuth();
  const [mobile, setMobile] = useState(user?.contactNumber ?? '');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('PaySprint MATM');
  const [txnType, setTxnType] = useState<TxnType>('ATMCW');

  // Slip / Manual fallback fields if needed
  const [showSlipInput, setShowSlipInput] = useState(false);
  const [bankRRN, setBankRRN] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState('');
  const [fpTransactionId, setFpTransactionId] = useState('');

  const [receipt, setReceipt] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = useAsync<any>(async () => {
    const res = await api.getMatmConfig();
    if (!res.success) throw new Error(res.message || 'Could not initialize PaySprint MATM.');
    return res.data;
  }, []);

  const history = useAsync<any[]>(async () => (await api.getMatmHistory()).data ?? [], []);

  const submitAction = useAction(async (params: Record<string, any>) => {
    const res = await api.processMatm({
      mobile,
      data: params,
    });
    if (!res.success && !res.pending) throw new Error(res.message || 'MATM transaction failed.');
    return res;
  });

  const checkStatusAction = useAction(async (txnId: string) => {
    const res = await api.checkMatmStatus(txnId);
    history.reload();
    return res;
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = 'Enter a valid 10-digit mobile number';
    if (txnType === 'ATMCW' && !(Number(amount) > 0)) {
      next.amount = 'Enter a valid cash withdrawal amount';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const handleLaunchDevice = async () => {
    setNotice('');
    if (!validate()) return;

    try {
      // 1. Fetch fresh PaySprint credentials & reference ID from backend
      let cfg = config.data;
      if (!cfg?.token || !cfg?.referenceId) {
        const fresh = await api.getMatmConfig();
        if (!fresh.success) throw new Error(fresh.message || 'Failed to obtain PaySprint MATM parameters.');
        cfg = fresh.data;
      }
      if (!cfg?.token || !cfg?.referenceId) {
        throw new Error('Failed to obtain PaySprint MATM authorization parameters.');
      }

      const txnid = cfg.referenceId;
      const partnerid = cfg.partnerId;
      const partnerapikey = cfg.token;
      const submerchantid = cfg.merchantCode || user?.retailerId || '';
      const txnAmount = txnType === 'ATMCW' ? Number(amount) : 0;

      // 2. On Android handset, try launching PaySprint MATM Host Activity Intent
      if (Platform.OS === 'android') {
        const intentUrl =
          `intent:#Intent;` +
          `action=android.intent.action.MAIN;` +
          `category=android.intent.category.LAUNCHER;` +
          `component=com.finopaytech.finosdk/.activity.MatmHostActivity;` +
          `S.partnerid=${encodeURIComponent(partnerid)};` +
          `S.partnerapikey=${encodeURIComponent(partnerapikey)};` +
          `S.submerchantid=${encodeURIComponent(submerchantid)};` +
          `S.mobile=${encodeURIComponent(mobile)};` +
          `S.amount=${encodeURIComponent(String(txnAmount))};` +
          `S.remarks=${encodeURIComponent(remarks)};` +
          `S.txnid=${encodeURIComponent(txnid)};` +
          `S.ttype=${encodeURIComponent(txnType)};` +
          `end`;

        const supported = await Linking.canOpenURL(intentUrl).catch(() => false);
        if (supported) {
          await Linking.openURL(intentUrl);
          setNotice('Micro-ATM device session launched. Complete card swipe on device.');
          return;
        }
      }

      // 3. Fallback / direct processing mode
      const res = await submitAction.run({
        txnid,
        amount: txnAmount,
        transactionType: txnType,
        mobile,
        status: 'success',
        bankRRN: bankRRN.trim() || undefined,
        cardNumber: cardNumber.trim() || undefined,
        bankName: bankName.trim() || undefined,
        cardType: cardType.trim() || undefined,
        fpTransactionId: fpTransactionId.trim() || undefined,
      });

      if (res) {
        setNotice(res.message || 'MATM transaction processed.');
        setReceipt({
          ...(res.data ?? {}),
          amount: txnAmount,
          transactionType: txnType,
          status: res.data?.status || (res.success ? 'SUCCESS' : 'FAILED'),
        });
        setAmount('');
        setBankRRN('');
        setCardNumber('');
        setFpTransactionId('');
        history.reload();
      }
    } catch (err: any) {
      setNotice('');
    }
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
          <CardTitle icon="access-point-network">PaySprint Micro-ATM Terminal</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {config.error ? (
            <ErrorBanner message={config.error} onRetry={config.reload} />
          ) : config.loading ? (
            <Text style={styles.help}>Initializing PaySprint terminal session…</Text>
          ) : (
            <Banner
              tone="success"
              message={`Terminal active. Merchant Code: ${config.data?.merchantCode || user?.retailerId || 'Active'}`}
            />
          )}
          <Text style={styles.help}>
            Connect your Pax or Fino Micro-ATM device via Bluetooth to perform card withdrawals and balance enquiries.
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="credit-card-outline">Micro-ATM Transaction</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Segmented
            options={TRANSACTION_TYPES as unknown as { key: TxnType; label: string }[]}
            value={txnType}
            onChange={setTxnType}
            scroll={false}
          />

          <Input
            label="Customer Mobile"
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            leftIcon="cellphone"
            maxLength={10}
            required
            error={errors.mobile}
          />

          {txnType === 'ATMCW' && (
            <Input
              label="Withdrawal Amount"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              leftIcon="currency-inr"
              placeholder="e.g. 1000"
              required
              error={errors.amount}
            />
          )}

          <Input
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            leftIcon="text"
            placeholder="Cash withdrawal / Balance check"
          />

          {showSlipInput && (
            <View style={styles.slipContainer}>
              <Text style={styles.slipTitle}>Device Response Slip / Manual Reference</Text>
              <Input
                label="Bank RRN"
                value={bankRRN}
                onChangeText={setBankRRN}
                leftIcon="pound"
                placeholder="RRN printed on slip"
              />
              <Input
                label="Card Number (Masked)"
                value={cardNumber}
                onChangeText={setCardNumber}
                leftIcon="credit-card-multiple-outline"
                placeholder="************1234"
              />
              <Input label="Bank Name" value={bankName} onChangeText={setBankName} leftIcon="bank" />
              <Input label="Card Type" value={cardType} onChangeText={setCardType} leftIcon="credit-card-outline" placeholder="Rupay / Visa" />
              <Input label="FP Transaction ID" value={fpTransactionId} onChangeText={setFpTransactionId} leftIcon="identifier" />
            </View>
          )}

          {!!submitAction.error && <ErrorBanner message={submitAction.error} />}
          {!!notice && <SuccessBanner message={notice} />}

          <Button
            onPress={handleLaunchDevice}
            loading={submitAction.pending}
            disabled={!!config.error}
            icon="bluetooth-connect"
            size="lg"
            haptic="medium"
            fullWidth
          >
            {txnType === 'ATMCW' ? 'Launch Micro-ATM (Withdrawal)' : 'Launch Micro-ATM (Balance)'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowSlipInput(!showSlipInput)}
          >
            {showSlipInput ? 'Hide device slip input' : 'Enter device slip details manually'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">MATM History</CardTitle>
        </CardHeader>
        <CardContent>
          {!!checkStatusAction.error && <ErrorBanner message={checkStatusAction.error} />}
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Reference" value={txn.transactionId} mono />
                <Row label="Type" value={txn.metadata?.transactionType || 'ATMCW'} />
                <Row label="Bank RRN" value={txn.metadata?.bankRRN || '—'} mono />
                <Row label="Date" value={dateTime(txn.createdAt)} last />

                {txn.status === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={checkStatusAction.pending}
                    onPress={() => checkStatusAction.run(txn.transactionId)}
                    style={styles.checkStatusBtn}
                  >
                    Check Status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState
              icon="credit-card-outline"
              title="No MATM transactions yet"
              subtitle="Every Micro-ATM card transaction appears here"
            />
          )}
        </CardContent>
      </Card>

      <Sheet
        visible={!!receipt}
        onClose={() => setReceipt(null)}
        title="PaySprint MATM Receipt"
        icon="receipt"
      >
        {!!receipt && (
          <View>
            <Row label="Amount" value={money(receipt.amount || 0)} mono />
            <Row label="Status" value={<StatusPill status={receipt.status} />} />
            <Row label="Reference" value={receipt.transactionId || '—'} mono />
            <Row label="Bank RRN" value={receipt.bankRRN || '—'} mono />
            <Row label="Card Number" value={receipt.cardNumber || '—'} mono />
            <Row label="Bank Name" value={receipt.bankName || '—'} />
            <Row label="Type" value={receipt.transactionType || 'ATMCW'} last />
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  help: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  slipContainer: { gap: space.md, padding: space.md, backgroundColor: c.muted, borderRadius: 8 },
  slipTitle: { fontSize: t.caption, fontWeight: '700', color: c.foreground },
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
  checkStatusBtn: { marginTop: space.sm },
}));

export default MatmScreen;
