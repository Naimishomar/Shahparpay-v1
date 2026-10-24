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

/**
 * Micro ATM. PaySprint withdrew its MATM APIs, and Icchhamati's Micro ATM
 * needs its own Android SDK, which is not in the app yet; until then the
 * retailer is sent to the web portal, where Icchhamati's MATM driver works.
 * The PaySprint flow below stays for when PAYSPRINT_ENABLED is switched back.
 */
export const MatmScreen: React.FC = () =>
  PAYSPRINT_ENABLED ? (
    <PaysprintMatmScreen />
  ) : (
    <Screen>
      <EmptyState
        icon="credit-card-outline"
        title="Micro ATM is on the web portal for now"
        subtitle="Use Micro ATM from the Shahparpay web portal on a computer with the Micro ATM driver installed. It is coming to the app soon."
      />
    </Screen>
  );

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
