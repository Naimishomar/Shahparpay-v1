import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
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
  Segmented,
  StatusPill,
  SuccessBanner,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const MODES = [
  { key: 'IMPS', label: 'IMPS' },
  { key: 'NEFT', label: 'NEFT' },
];

interface Beneficiary {
  id: string;
  name: string;
  account: string;
  ifsc: string;
  bank?: string;
  branch?: string;
  verified?: boolean;
}

/**
 * Domestic money transfer.
 *
 * There is no remitter to register on this rail: a beneficiary carries the
 * sender's mobile number itself and is activated by an OTP sent to that number.
 * Only a verified beneficiary can be paid, so the OTP is part of adding one.
 */
export const DmtScreen: React.FC = () => {
  const [mobile, setMobile] = useState('');
  // The sender the list below belongs to. Set only once a lookup succeeds, so
  // editing the number cannot silently repoint an open transfer.
  const [sender, setSender] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('IMPS');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');

  const [showAddBene, setShowAddBene] = useState(false);
  const [beneName, setBeneName] = useState('');
  const [beneAccount, setBeneAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [beneIfsc, setBeneIfsc] = useState('');

  // The beneficiary an OTP is being collected for, and what it is meant to do.
  const [otpFor, setOtpFor] = useState<{ bene: Beneficiary; action: 'verify' | 'delete' } | null>(
    null
  );
  const [otp, setOtp] = useState('');

  const history = useAsync<any[]>(async () => (await api.getDmtHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const loadBeneficiaries = async (mob: string) => {
    const res = await api.fetchDmtBeneficiaries(mob);
    if (!res.success) throw new Error(res.message || 'Failed to fetch beneficiaries');
    const list: Beneficiary[] = res.data ?? [];
    setBeneficiaries(list);
    // The selected row may have just been verified or removed, so it is refreshed
    // from the list rather than left pointing at a stale copy.
    setSelected((prev) => (prev ? list.find((b) => b.id === prev.id) ?? null : null));
    return list;
  };

  const lookup = useAction(async () => {
    const list = await loadBeneficiaries(mobile.trim());
    setSender(mobile.trim());
    return list;
  });

  const addBene = useAction(async () => {
    const res = await api.addDmtBeneficiary({
      mobile: sender,
      benename: beneName.trim(),
      beneaccount: beneAccount.trim(),
      ifsc: beneIfsc.trim().toUpperCase(),
    });
    if (!res.success) throw new Error(res.message || 'Failed to add beneficiary');
    return res;
  });

  const sendOtp = useAction(async (bene: Beneficiary) => {
    const res = await api.sendDmtBeneficiaryOtp(bene.id);
    if (!res.success) throw new Error(res.message || 'Failed to send OTP');
    return res;
  });

  const submitOtp = useAction(async () => {
    const { bene, action } = otpFor!;
    const res =
      action === 'verify'
        ? await api.verifyDmtBeneficiary({ beneficiary_id: bene.id, otp })
        : await api.deleteDmtBeneficiary({ beneficiary_id: bene.id, otp });
    if (!res.success) throw new Error(res.message || 'That OTP was not accepted');
    return res;
  });

  // A payout is accepted before the beneficiary bank confirms it. The
  // reconciliation cron settles it either way, but a retailer standing in front
  // of a customer should not have to wait for the next run to find out.
  const checkStatus = useAction(async (transactionId: string) => {
    const res = await api.getDmtTransferStatus(transactionId);
    if (!res.success) throw new Error(res.message);
    return res.data;
  });

  const transfer = useAction(async () => {
    const res = await api.transferDmt({
      mobile: sender,
      beneficiary_id: selected!.id,
      amount: Number(amount),
      transfer_mode: mode,
      beneaccount: selected!.account,
      ifsc: selected!.ifsc,
      pin,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  // An unverified beneficiary cannot be paid, so it cannot be transferred to.
  const canTransfer =
    !!selected && !!selected.verified && Number(amount) > 0 && !overBalance && pin.length === 4;
  const ifscValid = IFSC_RE.test(beneIfsc.trim().toUpperCase());
  const beneValid =
    beneName.trim().length > 2 &&
    beneAccount.trim().length >= 6 &&
    beneAccount === confirmAccount &&
    ifscValid;

  const startOtp = async (bene: Beneficiary, action: 'verify' | 'delete') => {
    setOtp('');
    setOtpFor({ bene, action });
    await sendOtp.run(bene);
  };

  const confirmRemoveBene = (b: Beneficiary) =>
    Alert.alert(
      'Remove beneficiary?',
      `${b.name} will be removed once you confirm the OTP sent to ${sender}.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => startOtp(b, 'delete') },
      ]
    );

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={() => {
        history.refresh();
        balances.refresh();
      }}
      error={history.error}
      onRetry={history.reload}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(available)} mono last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="account-search-outline">Sender</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Input
            label="Customer mobile number"
            required
            value={mobile}
            onChangeText={(v) => {
              setMobile(v.replace(/\D/g, '').slice(0, 10));
              setSender('');
              setBeneficiaries([]);
              setSelected(null);
            }}
            keyboardType="number-pad"
            placeholder="10-digit mobile number"
            leftIcon="phone-outline"
            autoComplete="tel"
          />
          {!!lookup.error && <ErrorBanner message={lookup.error} />}
          <Button
            onPress={() => lookup.run()}
            loading={lookup.pending}
            disabled={mobile.length !== 10}
            icon="magnify"
            fullWidth
          >
            Find beneficiaries
          </Button>
        </CardContent>
      </Card>

      {!!sender && (
        <Card>
          <CardHeader>
            <CardTitle icon="account-multiple-outline">Beneficiaries</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            {!!sendOtp.error && <ErrorBanner message={sendOtp.error} />}
            {beneficiaries.length ? (
              beneficiaries.map((b) => {
                const active = selected?.id === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setSelected(b)}
                    style={({ pressed }) => [
                      styles.beneRow,
                      active && styles.beneRowActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${b.name}, account ending ${String(b.account).slice(-4)}${
                      b.verified ? '' : ', not verified'
                    }`}
                  >
                    <View style={styles.beneInfo}>
                      <Text style={styles.beneName} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={styles.beneMeta} numberOfLines={1}>
                        ••••{String(b.account).slice(-4)} · {b.ifsc}
                        {b.bank ? ` · ${b.bank}` : ''}
                      </Text>
                      {!b.verified && <Text style={styles.beneUnverified}>Not verified</Text>}
                    </View>
                    {!b.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon="shield-check-outline"
                        onPress={() => startOtp(b, 'verify')}
                        accessibilityLabel={`Verify ${b.name}`}
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash-can-outline"
                      onPress={() => confirmRemoveBene(b)}
                      accessibilityLabel={`Remove ${b.name}`}
                    >
                      {''}
                    </Button>
                  </Pressable>
                );
              })
            ) : (
              <EmptyState
                icon="account-off-outline"
                title="No beneficiaries yet"
                subtitle="Add the account this customer wants to send money to"
              />
            )}

            <Button
              variant={showAddBene ? 'secondary' : 'outline'}
              size="sm"
              icon={showAddBene ? 'close' : 'plus'}
              onPress={() => setShowAddBene(!showAddBene)}
              fullWidth
            >
              {showAddBene ? 'Cancel' : 'Add beneficiary'}
            </Button>

            {showAddBene && (
              <View style={styles.form}>
                <Input
                  label="Beneficiary name"
                  required
                  value={beneName}
                  onChangeText={setBeneName}
                  leftIcon="account-outline"
                />
                <Input
                  label="Account number"
                  required
                  value={beneAccount}
                  onChangeText={(v) => setBeneAccount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  leftIcon="numeric"
                />
                <Input
                  label="Confirm account number"
                  required
                  value={confirmAccount}
                  onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  leftIcon="numeric"
                  error={
                    confirmAccount && confirmAccount !== beneAccount
                      ? 'Account numbers do not match'
                      : undefined
                  }
                />
                <Input
                  label="IFSC code"
                  required
                  value={beneIfsc}
                  onChangeText={setBeneIfsc}
                  autoCapitalize="characters"
                  maxLength={11}
                  leftIcon="bank-outline"
                  error={beneIfsc.length === 11 && !ifscValid ? 'Invalid IFSC format' : undefined}
                />
                {!!addBene.error && <ErrorBanner message={addBene.error} />}
                <Button
                  onPress={async () => {
                    const res = await addBene.run();
                    if (!res) return;
                    setNotice(res.message || 'Beneficiary added.');
                    setBeneName('');
                    setBeneAccount('');
                    setConfirmAccount('');
                    setBeneIfsc('');
                    setShowAddBene(false);
                    const list = await loadBeneficiaries(sender);
                    // It is not payable until it is verified, so the OTP is asked
                    // for now rather than left for the retailer to find later.
                    const added = res.data?.id
                      ? list.find((b) => b.id === String(res.data.id))
                      : undefined;
                    if (added) startOtp(added, 'verify');
                  }}
                  loading={addBene.pending}
                  disabled={!beneValid}
                  icon="account-plus-outline"
                  fullWidth
                >
                  Save beneficiary
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {/* OTP — activation or deletion */}
      {!!otpFor && (
        <Card>
          <CardHeader>
            <CardTitle icon="shield-key-outline">
              {otpFor.action === 'verify' ? 'Verify beneficiary' : 'Confirm removal'}
            </CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Banner
              tone="info"
              message={`Enter the OTP sent to ${sender} to ${
                otpFor.action === 'verify' ? 'activate' : 'remove'
              } ${otpFor.bene.name}.`}
            />
            <Input
              label="OTP"
              required
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6-digit OTP"
              leftIcon="message-text-outline"
            />
            {!!submitOtp.error && <ErrorBanner message={submitOtp.error} />}
            <Button
              onPress={async () => {
                const res = await submitOtp.run();
                if (!res) return;
                setNotice(
                  res.message ||
                    (otpFor.action === 'verify' ? 'Beneficiary verified.' : 'Beneficiary removed.')
                );
                setOtpFor(null);
                setOtp('');
                loadBeneficiaries(sender);
              }}
              loading={submitOtp.pending}
              disabled={otp.length !== 6}
              icon="check"
              fullWidth
            >
              {otpFor.action === 'verify' ? 'Verify' : 'Remove beneficiary'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => startOtp(otpFor.bene, otpFor.action)}
              loading={sendOtp.pending}
              fullWidth
            >
              Resend OTP
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setOtpFor(null);
                setOtp('');
              }}
              fullWidth
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {!!selected && (
        <Card>
          <CardHeader>
            <CardTitle icon="send-outline">Send money</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <View style={styles.infoBox}>
              <Row label="To" value={selected.name} />
              <Row label="Account" value={`••••${String(selected.account).slice(-4)}`} />
              <Row label="IFSC" value={selected.ifsc} last />
            </View>

            {!selected.verified && (
              <Banner
                tone="warning"
                message="This beneficiary is not verified yet. Verify it with the OTP before sending money."
              />
            )}

            <Input
              label="Amount"
              required
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="currency-inr"
              error={overBalance ? 'Amount exceeds your main wallet balance' : undefined}
            />
            <Segmented options={MODES} value={mode} onChange={setMode} />
            <Input
              label="Wallet PIN"
              required
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={4}
              placeholder="••••"
              leftIcon="lock-outline"
              rightIcon={showPin ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPin(!showPin)}
              rightIconLabel={showPin ? 'Hide PIN' : 'Show PIN'}
            />
            {!!transfer.error && <ErrorBanner message={transfer.error} />}
            {!!notice && <SuccessBanner message={notice} />}
            <Button
              onPress={async () => {
                setNotice('');
                const res = await transfer.run();
                if (res) {
                  // A transfer is accepted before the beneficiary bank confirms
                  // it, so the wording must not claim it has landed.
                  setNotice(
                    res.message ||
                      (res.pending ? 'Transfer accepted and is being processed.' : 'Transfer successful.')
                  );
                  setAmount('');
                  setPin('');
                  balances.reload();
                  history.reload();
                }
              }}
              disabled={!canTransfer}
              loading={transfer.pending}
              icon="send-outline"
              size="lg"
              fullWidth
            >
              Transfer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="history">Transfer history</CardTitle>
        </CardHeader>
        <CardContent>
          {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Beneficiary" value={txn.beneficiaryAccount} />
                <Row label="Reference" value={txn.apiReference || txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
                {(txn.status === 'PENDING' || txn.status === 'PROCESSING') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    loading={checkStatus.pending}
                    onPress={async () => {
                      const data = await checkStatus.run(txn.transactionId);
                      if (!data) return;
                      setNotice(`Transfer ${String(data.status).toLowerCase()}.`);
                      history.reload();
                      balances.reload();
                    }}
                  >
                    Check status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState icon="send-outline" title="No transfers yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  infoBox: { padding: space.md, borderRadius: radius.md, backgroundColor: c.secondary },
  beneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  beneRowActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  beneInfo: { flex: 1, minWidth: 0, gap: 2 },
  beneName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  beneMeta: { fontSize: t.micro, color: c.mutedForeground },
  beneUnverified: { fontSize: t.micro, fontWeight: '700', color: c.warning },
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

export default DmtScreen;
