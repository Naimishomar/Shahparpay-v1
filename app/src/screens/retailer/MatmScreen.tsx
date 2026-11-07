import React, { useState } from 'react';
import { View, Text, Platform, PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  Row,
  SectionTitle,
  Segmented,
  money,
  dateTime,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { StatusText } from '@/components/aeps/TransactionReceipt';
import api from '@/services/api';
import { coordsPayload } from '@/services/location';

const TRANSACTION_TYPES = [
  { key: 'ATMCW', label: 'Cash withdrawal' },
  { key: 'ATMBE', label: 'Balance enquiry' },
] as const;

type TxnType = (typeof TRANSACTION_TYPES)[number]['key'];

/** The SDK scans for the device over BLE; Android 12+ asks for these at runtime. */
const ensureBluetooth = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  if (Object.values(result).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error('Allow Bluetooth access so the app can find your Micro-ATM device.');
  }
};

// Built into our APK by plugins/withFingpayMatm; retypes the extras for the SDK.
const FINGPAY_ACTIVITY = 'com.shahparpay.app.FingpayMatmActivity';
// Fingpay's transaction types (com.fingpay.microatmsdk.utils.Constants).
const FINGPAY_TYPE: Record<TxnType, number> = { ATMCW: 2, ATMBE: 4 };

/**
 * The SDK's result in the shape Icchhamati's /matm-request takes, which the
 * server reports to Icchhamati before crediting a withdrawal.
 */
export const matmRequestData = (extra: Record<string, any>, txnType: TxnType, txnId: string) => {
  const ok = String(extra.TRANS_STATUS) === 'true';
  return {
    terminalId: extra.TERMINAL_ID || '',
    requestTransactionTime: extra.TIME_STAMP || '',
    transactionAmount: Number(extra.TRANS_AMOUNT) || 0,
    transactionStatus: ok ? 'successful' : 'failed',
    balanceAmount: Number(extra.BALANCE_AMOUNT) || 0,
    bankRRN: extra.RRN || '',
    transactionType: txnType === 'ATMCW' ? 'WDLS' : 'BAL',
    fpTransactionId: extra.FP_TRANS_ID || '',
    errorCode: ok ? '00' : String(extra.RESPONSE_CODE || extra.STATUS_CODE || ''),
    errorMessage: extra.MESSAGE || (ok ? 'Success' : 'Failed'),
    merchantTransactionId: extra.TRANS_ID || txnId,
    cardType: extra.CARD_TYPE || '',
    bankName: extra.BANK_NAME || '',
    cardNumber: extra.CARD_NAME || '',
  };
};

/** Micro ATM on Icchhamati's (Fingpay) SDK. */
export const MatmScreen: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [txnType, setTxnType] = useState<TxnType>('ATMCW');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [launchError, setLaunchError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ message: string; data: Record<string, any> } | null>(null);
  const history = useAsync<any[]>(async () => (await api.getMatmHistory()).data ?? [], []);

  // Same rules and messages as the web portal and the backend.
  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = 'Enter the customer’s 10-digit mobile number.';
    const value = Number(amount);
    if (txnType === 'ATMCW' && !(value >= 1 && value <= 10000)) next.amount = 'Amount must be between ₹1 and ₹10,000.';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const launch = async () => {
    setLaunchError('');
    if (!validate()) return;
    if (Platform.OS !== 'android') return setLaunchError('Micro ATM works only in the Android app with a paired device.');
    setBusy(true);
    setReceipt(null);
    try {
      let result: IntentLauncher.IntentLauncherResult;
      let txnId = '';
      try {
        await ensureBluetooth();
        const coords = await coordsPayload();
        const sdk = await api.getMatmSdk().catch((e: any) => e?.response?.data);
        if (!sdk?.success || !sdk.data?.merchantUserId) throw new Error(sdk?.message || 'Could not start Micro ATM.');
        txnId = sdk.data.txnId;
        result = await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
          className: FINGPAY_ACTIVITY,
          packageName: 'com.shahparpay.app',
          extra: {
            MERCHANT_USERID: sdk.data.merchantUserId,
            MERCHANT_PASSWORD: sdk.data.merchantPassword,
            SUPER_MERCHANTID: sdk.data.superMerchantId,
            MOBILE_NUMBER: mobile,
            AMOUNT: txnType === 'ATMCW' ? amount : '0',
            REMARKS: remarks || (txnType === 'ATMCW' ? 'Cash withdrawal' : 'Balance enquiry'),
            TXN_ID: txnId,
            LATITUDE: String(coords.latitude),
            LONGITUDE: String(coords.longitude),
            TYPE: String(FINGPAY_TYPE[txnType]),
          },
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        return setLaunchError(
          /no activity|resolve|not found|unable to find explicit activity/i.test(msg)
            ? 'The Micro ATM SDK is not in this app build. Install the latest app and try again.'
            : msg || 'Could not start the Micro ATM device.'
        );
      }

      const extra = (result.extra ?? {}) as Record<string, any>;
      if (!Object.keys(extra).length) return setLaunchError('Micro ATM transaction cancelled.');
      const data = matmRequestData(extra, txnType, txnId);
      // Nothing reached the bank (login or device failed): nothing to record.
      if (!data.fpTransactionId) {
        return setReceipt({ message: data.errorMessage || 'Transaction failed on the device.', data });
      }

      // Whatever the card said, the result is recorded; only the backend decides about money.
      const recorded = await api
        .processMatm({ mobile, data })
        .catch((e: any) => e?.response?.data || { success: false, message: 'Network error. Please try again.' });
      setReceipt({ message: recorded.message || data.errorMessage, data });
      if (recorded.success) {
        setMobile('');
        setAmount('');
        setRemarks('');
      }
      history.reload();
    } finally {
      setBusy(false);
    }
  };

  const rows = receipt
    ? ([
        ['Amount', receipt.data.transactionAmount ? money(receipt.data.transactionAmount) : null],
        ['Account balance', receipt.data.balanceAmount !== undefined ? money(receipt.data.balanceAmount) : null],
        ['Card', [receipt.data.cardType, receipt.data.cardNumber].filter(Boolean).join(' ')],
        ['Bank', receipt.data.bankName],
        ['Bank RRN', receipt.data.bankRRN],
        ['Transaction ID', receipt.data.fpTransactionId],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return (
    <Screen refreshing={history.refreshing} onRefresh={history.refresh}>
      <View style={styles.card}>
        <View style={styles.row}>
          <IconTile icon="credit-card-outline" size={48} iconSize={22} />
          <View style={styles.info}>
            <Text style={styles.title}>Micro ATM</Text>
            <Text style={styles.meta}>Card cash withdrawal and balance enquiry</Text>
          </View>
        </View>
        <Text style={[styles.help, styles.gapTop]}>
          Turn on the Micro ATM device and Bluetooth. The device is paired on the next screen; the customer then inserts or swipes the card and enters the PIN.
        </Text>
      </View>

      <View style={[styles.card, styles.form]}>
        <Segmented options={TRANSACTION_TYPES as unknown as { key: TxnType; label: string }[]} value={txnType} onChange={setTxnType} scroll={false} />
        <Input
          label="Customer mobile"
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
          keyboardType="number-pad"
          maxLength={10}
          error={errors.mobile}
        />
        {txnType === 'ATMCW' && (
          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
            leftIcon="currency-inr"
            placeholder="Up to ₹10,000"
            error={errors.amount}
          />
        )}
        <Input label="Remarks (optional)" value={remarks} onChangeText={setRemarks} />
        {!!launchError && <ErrorBanner message={launchError} />}
        <Button onPress={launch} loading={busy} icon="credit-card-outline" haptic="medium" fullWidth>
          {busy ? 'Follow the device…' : 'Start — insert or swipe the card'}
        </Button>
      </View>

      <View>
        <SectionTitle>Recent Micro ATM transactions</SectionTitle>
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          <View style={styles.list}>
            {history.data.map((txn: any, index: number, all: any[]) => (
              <View key={txn._id || txn.transactionId} style={[styles.txn, index === all.length - 1 && styles.txnLast]}>
                <IconTile icon="credit-card-outline" size={44} iconSize={20} />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>{txn.metadata?.transactionType || '—'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{dateTime(txn.createdAt)}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amount}>{money(txn.amount || 0)}</Text>
                  <StatusText status={txn.status} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="credit-card-outline" title="No Micro ATM transactions yet." />
        )}
      </View>

      <Sheet visible={!!receipt} onClose={() => setReceipt(null)} title="Result" icon="receipt">
        {!!receipt && (
          <View>
            <Text style={[styles.title, styles.resultMessage]}>{receipt.message}</Text>
            {rows.map(([label, value], i) => (
              <Row key={label} label={label} value={value} mono={label !== 'Bank'} last={i === rows.length - 1} />
            ))}
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = themed((c) => ({
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  form: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  info: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  meta: { fontSize: t.caption, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  gapTop: { marginTop: space.lg },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  list: {
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  txnLast: { borderBottomWidth: 0 },
  right: { alignItems: 'flex-end', gap: 3 },
  amount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  resultMessage: { fontWeight: '600', marginBottom: space.md },
}));

export default MatmScreen;
