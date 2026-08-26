import React, { useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  Grid,
  Row,
  Segmented,
  StatusPill,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MODES = [
  { key: 'IMPS', label: 'IMPS · instant' },
  { key: 'NEFT', label: 'NEFT · batched' },
];

export const AepsSettlementScreen: React.FC = () => {
  const [bankId, setBankId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('IMPS');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);

  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const banks = useAsync<any[]>(async () => {
    const list = (await api.getSavedBanks()).data ?? [];
    setBankId((prev) => (prev && list.some((b: any) => b._id === prev) ? prev : list[0]?._id ?? null));
    return list;
  }, []);
  const history = useAsync<any[]>(
    async () => (await api.getSettlementHistory({ type: 'AEPS_SETTLEMENT' })).data ?? [],
    []
  );

  const settle = useAction(async () => {
    const res = await api.initiateSettlement({ bankId: bankId!, amount: Number(amount), pin, mode });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const addBank = useAction(async () => {
    const res = await api.addSettlementBank({
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      bankName: bankName.trim(),
      accountHolderName: accountHolderName.trim(),
      accountType: 'SAVINGS',
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const syncBanks = useAction(async () => {
    const res = await api.syncSavedBanks();
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const removeBank = useAction(async (id: string) => {
    const res = await api.deleteSettlementBank(id);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const checkStatus = useAction(async (transactionId: string) => {
    const res = await api.checkSettlementStatus(transactionId);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const checkAccount = useAction(async (id: string) => {
    const res = await api.getSettlementAccountStatus(id);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const summary = (history.data ?? []).reduce(
    (acc: any, txn: any) => {
      const status = String(txn.status || '').toUpperCase();
      const amt = Number(txn.amount || 0);
      if (status === 'PENDING' || status === 'PROCESSING') acc.pending += amt;
      if (status === 'SUCCESS') acc.settled += amt;
      if (status === 'FAILED') acc.failed += 1;
      return acc;
    },
    { pending: 0, settled: 0, failed: 0 }
  );

  const available = balances.data?.aepsBalance ?? 0;
  const overBalance = Number(amount) > available;
  const ifscValid = IFSC_RE.test(ifscCode.trim().toUpperCase());
  const canSettle = !!bankId && Number(amount) > 0 && !overBalance && pin.length === 4;

  const reloadAll = () => {
    balances.refresh();
    banks.refresh();
    history.refresh();
  };

  const run = async (action: () => Promise<any>, message: string, reload = true) => {
    setNotice('');
    const res = await action();
    if (res) {
      setNotice(res.message || message);
      if (reload) reloadAll();
    }
  };

  const confirmRemove = (bank: any) =>
    Alert.alert('Remove bank account?', `${bank.bankName} ending ${String(bank.accountNumber).slice(-4)} will be removed.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => run(() => removeBank.run(bank._id), 'Bank account removed.'),
      },
    ]);

  return (
    <Screen
      loading={banks.loading}
      refreshing={banks.refreshing || history.refreshing}
      onRefresh={reloadAll}
      error={banks.error}
      onRetry={banks.reload}
    >
      <Grid columns={2}>
        <Tile label="AEPS wallet" value={money(available)} />
        <Tile label="Pending" value={money(summary.pending)} tone="warning" />
        <Tile label="Settled" value={money(summary.settled)} tone="success" />
        <Tile label="Failed" value={String(summary.failed)} tone="error" />
      </Grid>

      {!!notice && <SuccessBanner message={notice} />}
      {!!removeBank.error && <ErrorBanner message={removeBank.error} />}
      {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
      {!!checkAccount.error && <ErrorBanner message={checkAccount.error} />}

      <Card>
        <CardHeader>
          <CardTitle icon="bank-outline">Settlement bank</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {banks.data?.length ? (
            banks.data.map((bank: any) => {
              const selected = bankId === bank._id;
              return (
                <Pressable
                  key={bank._id}
                  onPress={() => setBankId(bank._id)}
                  style={({ pressed }) => [
                    styles.bankRow,
                    selected && styles.bankRowActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${bank.bankName}, account ending ${String(bank.accountNumber).slice(-4)}`}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={selected ? colors.accent : colors.mutedForeground}
                  />
                  <View style={styles.bankInfo}>
                    <Text style={styles.bankName} numberOfLines={1}>
                      {bank.bankName || 'Bank account'}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1}>
                      ••••{String(bank.accountNumber).slice(-4)} · {bank.ifscCode}
                    </Text>
                  </View>
                  <View style={styles.bankActions}>
                    <StatusPill status={bank.verificationStatus || bank.status} />
                    <View style={styles.bankButtons}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="refresh"
                        onPress={() => run(() => checkAccount.run(bank._id), 'Account status refreshed.')}
                        accessibilityLabel="Refresh account verification status"
                      >
                        {''}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="trash-can-outline"
                        onPress={() => confirmRemove(bank)}
                        accessibilityLabel="Remove bank account"
                      >
                        {''}
                      </Button>
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <EmptyState
              icon="bank-off-outline"
              title="No settlement bank yet"
              subtitle="Add the account you want your balance settled into, or pull one in from PaySprint"
            />
          )}

          <View style={styles.bankToolbar}>
            <Button
              variant="outline"
              size="sm"
              icon="cloud-download-outline"
              onPress={() => run(() => syncBanks.run(), 'Banks synced from PaySprint.')}
              loading={syncBanks.pending}
              style={styles.flex}
            >
              Sync
            </Button>
            <Button
              variant={showAddBank ? 'secondary' : 'outline'}
              size="sm"
              icon={showAddBank ? 'close' : 'plus'}
              onPress={() => setShowAddBank(!showAddBank)}
              style={styles.flex}
            >
              {showAddBank ? 'Cancel' : 'Add bank'}
            </Button>
          </View>
          {!!syncBanks.error && <ErrorBanner message={syncBanks.error} />}

          {showAddBank && (
            <View style={styles.form}>
              <Input
                label="Account holder name"
                required
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                placeholder="Exactly as per bank records"
                leftIcon="account-outline"
              />
              <Input
                label="Account number"
                required
                value={accountNumber}
                onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ''))}
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
                  confirmAccount && confirmAccount !== accountNumber
                    ? 'Account numbers do not match'
                    : undefined
                }
              />
              <Input
                label="IFSC code"
                required
                value={ifscCode}
                onChangeText={setIfscCode}
                autoCapitalize="characters"
                maxLength={11}
                leftIcon="bank-outline"
                error={ifscCode.length === 11 && !ifscValid ? 'Invalid IFSC format' : undefined}
                helperText="11 characters, e.g. HDFC0001234"
              />
              <Input
                label="Bank name"
                required
                value={bankName}
                onChangeText={setBankName}
                leftIcon="office-building-outline"
              />
              {!!addBank.error && <ErrorBanner message={addBank.error} />}
              <Button
                onPress={async () => {
                  const res = await addBank.run();
                  if (res) {
                    setNotice(res.message || 'Bank account added.');
                    setAccountNumber('');
                    setConfirmAccount('');
                    setIfscCode('');
                    setBankName('');
                    setAccountHolderName('');
                    setShowAddBank(false);
                    banks.reload();
                  }
                }}
                loading={addBank.pending}
                disabled={
                  !accountNumber ||
                  accountNumber !== confirmAccount ||
                  !ifscValid ||
                  !bankName ||
                  !accountHolderName
                }
                icon="content-save-outline"
                fullWidth
              >
                Save bank account
              </Button>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="bank-transfer-out">Initiate settlement</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!bankId && (
            <Banner tone="warning" message="Add and select a settlement bank before you can settle." />
          )}
          <View style={styles.field}>
            <Text style={styles.label}>Transfer mode</Text>
            <Segmented options={MODES} value={mode} onChange={setMode} />
          </View>
          <Input
            label="Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="currency-inr"
            error={overBalance ? 'Amount exceeds your AEPS wallet balance' : undefined}
            helperText={`Settled from your AEPS wallet · ${money(available)} available. A settlement charge is deducted on top of this amount.`}
          />
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
          {!!settle.error && <ErrorBanner message={settle.error} />}
          <Button
            onPress={async () => {
              const res = await settle.run();
              if (res) {
                setNotice(res.message || 'Settlement initiated.');
                setAmount('');
                setPin('');
                reloadAll();
              }
            }}
            disabled={!canSettle}
            loading={settle.pending}
            icon="bank-transfer-out"
            haptic="medium"
            size="lg"
            fullWidth
          >
            Settle now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Settlement history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Bank" value={txn.metadata?.bankName || '—'} />
                <Row
                  label="Account"
                  value={
                    txn.metadata?.bankAccount
                      ? `••••${String(txn.metadata.bankAccount).slice(-4)}`
                      : '—'
                  }
                  mono
                />
                {!!txn.metadata?.beneficiaryName && (
                  <Row label="Beneficiary" value={txn.metadata.beneficiaryName} />
                )}
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
                {['PENDING', 'PROCESSING'].includes(String(txn.status).toUpperCase()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    loading={checkStatus.pending}
                    onPress={() => run(() => checkStatus.run(txn.transactionId), 'Status checked.')}
                    style={styles.inlineButton}
                  >
                    Check status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState icon="bank-transfer" title="No settlements yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const Tile: React.FC<{ label: string; value: string; tone?: 'success' | 'warning' | 'error' }> = ({
  label,
  value,
  tone,
}) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[
        styles.tileValue,
        tone === 'success' && { color: colors.success },
        tone === 'warning' && { color: colors.warning },
        tone === 'error' && { color: colors.destructive },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  tile: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 3,
  },
  tileLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.bodyLg,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  flex: { flex: 1 },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  bankRowActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  bankInfo: { flex: 1, minWidth: 0, gap: 2 },
  bankName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  bankMeta: { fontSize: t.micro, color: c.mutedForeground },
  bankActions: { alignItems: 'flex-end', gap: 2 },
  bankButtons: { flexDirection: 'row', gap: 2 },
  bankToolbar: { flexDirection: 'row', gap: space.sm },
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
  inlineButton: { alignSelf: 'flex-start', marginTop: space.xs },
}));

export default AepsSettlementScreen;
