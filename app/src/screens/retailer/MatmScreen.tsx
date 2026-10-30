import React, { useState } from 'react';
import { View, Text, Pressable, Platform, PermissionsAndroid } from 'react-native';
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
  SuccessBanner,
  money,
  dateTime,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { StatusText } from '@/components/aeps/TransactionReceipt';
import api from '@/services/api';
import { PAYSPRINT_ENABLED } from '@/constants/services';
import { coordsPayload } from '@/services/location';

const TRANSACTION_TYPES = [
  { key: 'ATMCW', label: 'Cash withdrawal' },
  { key: 'ATMBE', label: 'Balance enquiry' },
] as const;

type TxnType = (typeof TRANSACTION_TYPES)[number]['key'];

// Lives inside our APK via plugins/withPaysprintMatm (PaySprint's Fino AARs).
const MATM_ACTIVITY = 'com.example.matm.MatmHostActivity';

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

/** Micro ATM: Icchhamati's (Fingpay) SDK; the PaySprint flow stays for when PAYSPRINT_ENABLED is switched back. */
export const MatmScreen: React.FC = () => (PAYSPRINT_ENABLED ? <PaysprintMatmScreen /> : <IcchhamatiMatmScreen />);

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

const IcchhamatiMatmScreen: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [txnType, setTxnType] = useState<TxnType>('ATMCW');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [launchError, setLaunchError] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const history = useAsync<any[]>(async () => (await api.getMatmHistory()).data ?? [], []);

  const submit = useAction(async (data: Record<string, any>) => {
    const res = await api.processMatm({ mobile, data });
    // PROCESSING (202) is not a failure: the withdrawal waits for verification.
    if (!res.success && res.status !== 'PROCESSING') throw new Error(res.message || 'Micro ATM transaction failed.');
    return res;
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = 'Enter the customer’s 10-digit mobile number';
    const value = Number(amount);
    // The SDK refuses anything else.
    if (txnType === 'ATMCW' && !(value >= 100 && value <= 10000 && value % 10 === 0)) {
      next.amount = 'Amount must be ₹100 to ₹10,000, in multiples of ₹10';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const launch = async () => {
    setLaunchError('');
    submit.setError(null);
    if (!validate()) return;
    if (Platform.OS !== 'android') return setLaunchError('Micro ATM works only in the Android app with a paired device.');

    let result: IntentLauncher.IntentLauncherResult;
    let txnId = '';
    try {
      await ensureBluetooth();
      const coords = await coordsPayload();
      const sdk = await api.getMatmSdk();
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
          REMARKS: txnType === 'ATMCW' ? 'Cash withdrawal' : 'Balance enquiry',
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
    if (!data.fpTransactionId) return setLaunchError(data.errorMessage || 'Micro ATM transaction failed.');

    const res = await submit.run(data);
    history.reload();
    setReceipt({
      status: res?.status || 'FAILED',
      message: res?.message || data.errorMessage,
      type: txnType,
      ...data,
    });
    if (res) setAmount('');
  };

  return (
    <Screen refreshing={history.refreshing} onRefresh={history.refresh}>
      <View style={styles.card}>
        <View style={styles.row}>
          <IconTile icon="credit-card-outline" size={48} iconSize={22} />
          <View style={styles.info}>
            <Text style={styles.title}>Micro ATM</Text>
            <Text style={styles.meta}>Morefun device over Bluetooth</Text>
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
          required
          error={errors.mobile}
        />
        {txnType === 'ATMCW' && (
          <Input
            label="Withdrawal amount"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
            leftIcon="currency-inr"
            placeholder="₹100 to ₹10,000"
            required
            error={errors.amount}
          />
        )}
        {!!launchError && <ErrorBanner message={launchError} />}
        {!!submit.error && <ErrorBanner message={submit.error} />}
        <Button onPress={launch} loading={submit.pending} icon="bluetooth-connect" haptic="medium" fullWidth>
          {txnType === 'ATMCW' ? 'Start cash withdrawal' : 'Check balance'}
        </Button>
      </View>

      <View>
        <SectionTitle>Micro ATM history</SectionTitle>
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          <View style={styles.list}>
            {history.data.slice(0, 20).map((txn: any, index: number, rows: any[]) => (
              <View key={txn._id || txn.transactionId} style={[styles.txn, index === rows.length - 1 && styles.txnLast]}>
                <IconTile icon="credit-card-outline" size={44} iconSize={20} />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>{Number(txn.amount) > 0 ? 'Cash withdrawal' : 'Balance enquiry'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{dateTime(txn.createdAt)}</Text>
                  <Text style={styles.meta} numberOfLines={1} selectable>
                    {[txn.transactionId, txn.metadata?.bankRRN && `RRN ${txn.metadata.bankRRN}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amount}>{money(txn.amount)}</Text>
                  <StatusText status={txn.status} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="credit-card-outline" title="No Micro ATM transactions yet" subtitle="Every card transaction appears here" />
        )}
      </View>

      <Sheet visible={!!receipt} onClose={() => setReceipt(null)} title="Micro ATM receipt" icon="receipt">
        {!!receipt && (
          <View>
            <Row label="Status" value={<StatusText status={receipt.status} />} />
            {!!receipt.message && <Row label="Message" value={receipt.message} />}
            <Row label="Type" value={receipt.type === 'ATMCW' ? 'Cash withdrawal' : 'Balance enquiry'} />
            {receipt.type === 'ATMCW' && <Row label="Amount" value={money(receipt.transactionAmount)} mono />}
            <Row label="Account balance" value={money(receipt.balanceAmount)} mono />
            <Row label="Bank" value={receipt.bankName || '—'} />
            <Row label="Card" value={receipt.cardNumber || '—'} mono />
            <Row label="Bank RRN" value={receipt.bankRRN || '—'} mono />
            <Row label="Transaction ID" value={receipt.fpTransactionId || '—'} mono last />
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const PaysprintMatmScreen: React.FC = () => {
  const { user } = useAuth();
  const [mobile, setMobile] = useState(user?.contactNumber ?? '');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('PaySprint MATM');
  const [txnType, setTxnType] = useState<TxnType>('ATMCW');

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

  const [launchError, setLaunchError] = useState('');

  const handleLaunchDevice = async () => {
    setNotice('');
    setLaunchError('');
    submitAction.setError(null);
    if (!validate()) return;

    if (Platform.OS !== 'android') {
      setLaunchError('Micro-ATM works only in the Android app with a paired device.');
      return;
    }

    let txnid = '';
    let result: IntentLauncher.IntentLauncherResult;
    try {
      await ensureBluetooth();
      const coords = await coordsPayload();
      // Fresh reference every launch: PaySprint needs a unique txnid per attempt.
      const fresh = await api.getMatmConfig();
      const cfg = fresh?.data;
      if (!fresh?.success || !cfg?.token || !cfg?.referenceId) {
        throw new Error(fresh?.message || 'Failed to obtain PaySprint MATM parameters.');
      }
      txnid = cfg.referenceId;

      result = await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        className: MATM_ACTIVITY,
        extra: {
          partnerid: String(cfg.partnerId),
          partnerapikey: String(cfg.token),
          submerchantid: String(cfg.merchantCode || user?.retailerId || ''),
          mobile,
          amount: txnType === 'ATMCW' ? String(Number(amount)) : '0',
          remarks: remarks || 'PaySprint MATM',
          latitude: coords.latitude,
          longitude: coords.longitude,
          txnid,
          ttype: txnType,
        },
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      setLaunchError(
        /no activity|resolve|not found|unable to find explicit activity/i.test(msg)
          ? 'Micro-ATM SDK is not included in this app build. Update the app and try again.'
          : msg || 'Could not start the Micro-ATM device.'
      );
      return;
    }

    // SDK returns RESULT_OK with status (bool), response (int), message, data (JSON string).
    const extra = (result.extra ?? {}) as Record<string, any>;
    if (result.resultCode !== IntentLauncher.ResultCode.Success || !Object.keys(extra).length) {
      setLaunchError('Micro-ATM transaction cancelled.');
      return;
    }
    let sdk: Record<string, any> = { status: extra.status, response: extra.response, message: extra.message };
    try {
      sdk = { ...JSON.parse(extra.data || '{}'), ...sdk };
    } catch {
      // data is optional detail; the server verifies with PaySprint anyway.
    }

    // The server verifies withdrawals with PaySprint; the SDK result is only a hint.
    const res = await submitAction.run({
      ...sdk,
      txnid,
      ttype: txnType,
      amount: txnType === 'ATMCW' ? Number(amount) : 0,
    });
    history.reload();
    if (!res) return;

    setNotice(res.message || 'MATM transaction processed.');
    setReceipt({
      ...(res.data ?? {}),
      ...(res.data?.metadata ?? {}),
      amount: res.data?.amount ?? Number(amount),
      transactionType: txnType,
      status: res.status || res.data?.status,
    });
    setAmount('');
  };

  return (
    <Screen
      refreshing={history.refreshing || config.refreshing}
      onRefresh={() => {
        config.refresh();
        history.refresh();
      }}
    >
      {/* Terminal status as a BHIM list card: circle icon, title, quiet caption. */}
      <View style={styles.card}>
        <View style={styles.row}>
          <IconTile icon="credit-card-outline" size={48} iconSize={22} />
          <View style={styles.info}>
            <Text style={styles.title}>Micro-ATM terminal</Text>
            {config.loading ? (
              <Text style={styles.meta}>Initializing PaySprint terminal session…</Text>
            ) : !config.error ? (
              <Text style={styles.meta} numberOfLines={1}>
                <Text style={styles.active}>Active</Text>
                {` · Merchant ${config.data?.merchantCode || user?.retailerId || '—'}`}
              </Text>
            ) : null}
          </View>
        </View>
        {!!config.error && (
          <View style={styles.gapTop}>
            <ErrorBanner message={config.error} onRetry={config.reload} />
          </View>
        )}
        <Text style={[styles.help, styles.gapTop]}>
          Connect your Pax or Fino Micro-ATM device via Bluetooth to perform card withdrawals and balance enquiries.
        </Text>
      </View>

      <View style={[styles.card, styles.form]}>
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
          maxLength={10}
          required
          error={errors.mobile}
        />

        {txnType === 'ATMCW' && (
          <Input
            label="Withdrawal amount"
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
          placeholder="Cash withdrawal / Balance check"
        />

        {!!launchError && <ErrorBanner message={launchError} />}
        {!!submitAction.error && <ErrorBanner message={submitAction.error} />}
        {!!notice && <SuccessBanner message={notice} />}

        <Button
          onPress={handleLaunchDevice}
          loading={submitAction.pending}
          disabled={!!config.error}
          icon="bluetooth-connect"
          haptic="medium"
          fullWidth
        >
          {txnType === 'ATMCW' ? 'Launch Micro-ATM (Withdrawal)' : 'Launch Micro-ATM (Balance)'}
        </Button>
      </View>

      <View>
        <SectionTitle>MATM history</SectionTitle>
        {!!checkStatusAction.error && <ErrorBanner message={checkStatusAction.error} />}
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          <View style={styles.list}>
            {history.data.slice(0, 20).map((txn: any, index: number, rows: any[]) => (
              <View key={txn._id || txn.transactionId} style={[styles.txn, index === rows.length - 1 && styles.txnLast]}>
                <IconTile icon="credit-card-outline" size={44} iconSize={20} />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {txn.metadata?.transactionType === 'ATMBE' ? 'Balance enquiry' : 'Cash withdrawal'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {dateTime(txn.createdAt)}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1} selectable>
                    {[txn.transactionId, txn.metadata?.bankRRN && `RRN ${txn.metadata.bankRRN}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.amount}>{money(txn.amount)}</Text>
                  <StatusText status={txn.status} />
                  {txn.status === 'PENDING' && (
                    <Pressable
                      onPress={() => checkStatusAction.run(txn.transactionId)}
                      disabled={checkStatusAction.pending}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Check Status"
                    >
                      <Text style={styles.link}>{checkStatusAction.pending ? 'Checking…' : 'Check status'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="credit-card-outline"
            title="No MATM transactions yet"
            subtitle="Every Micro-ATM card transaction appears here"
          />
        )}
      </View>

      <Sheet
        visible={!!receipt}
        onClose={() => setReceipt(null)}
        title="PaySprint MATM Receipt"
        icon="receipt"
      >
        {!!receipt && (
          <View>
            <Row label="Amount" value={money(receipt.amount || 0)} mono />
            <Row label="Status" value={<StatusText status={receipt.status} />} />
            <Row label="Reference" value={receipt.transactionId || '—'} mono />
            <Row label="Bank RRN" value={receipt.bankRRN || '—'} mono />
            <Row label="Card Number" value={receipt.cardNumber || '—'} mono />
            <Row label="Bank Name" value={receipt.bankName || '—'} />
            {receipt.balance != null && <Row label="Account Balance" value={money(receipt.balance)} mono />}
            <Row label="Type" value={receipt.transactionType || 'ATMCW'} last />
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
  active: { color: c.success, fontWeight: '500' },
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
  link: { fontSize: t.small, fontWeight: '500', color: c.accent, textDecorationLine: 'underline' },
}));

export default MatmScreen;
