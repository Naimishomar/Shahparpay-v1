import React, { useState } from 'react';
import { View, Text, Platform, PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
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

export const MatmScreen: React.FC = () => {
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

          {!!launchError && <ErrorBanner message={launchError} />}
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
            {receipt.balance != null && <Row label="Account Balance" value={money(receipt.balance)} mono />}
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
