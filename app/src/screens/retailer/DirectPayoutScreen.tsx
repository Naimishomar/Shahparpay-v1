import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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

export const DirectPayoutScreen: React.FC = () => {
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [mode, setMode] = useState('IMPS');
  const [notice, setNotice] = useState('');

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const banks = useAsync<any[]>(async () => (await api.getSavedBanks()).data ?? [], []);
  const history = useAsync<any[]>(
    async () => (await api.getSettlementHistory({ type: 'DIRECT_PAYOUT' })).data ?? [],
    []
  );

  const payout = useAction(async () => {
    const res = await api.initiateDirectPayout({
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      bankName: bankName.trim(),
      amount: Number(amount),
      pin,
      mode,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  const ifscValid = IFSC_RE.test(ifscCode.trim().toUpperCase());
  const accountsMatch = accountNumber === confirmAccount;
  const valid =
    accountHolderName.trim().length > 2 &&
    accountNumber.trim().length >= 6 &&
    accountsMatch &&
    ifscValid &&
    bankName.trim().length > 1 &&
    Number(amount) > 0 &&
    !overBalance &&
    pin.length === 4;

  const onPayout = async () => {
    setNotice('');
    const res = await payout.run();
    if (res) {
      setNotice(res.message || 'Payout submitted.');
      setAmount('');
      setPin('');
      balances.reload();
      history.reload();
    }
  };

  /** Saved settlement banks double as a beneficiary book: tap to prefill. */
  const useBank = (bank: any) => {
    setAccountHolderName(bank.accountHolderName || '');
    setAccountNumber(String(bank.accountNumber || ''));
    setConfirmAccount(String(bank.accountNumber || ''));
    setIfscCode(String(bank.ifscCode || ''));
    setBankName(bank.bankName || '');
  };

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={() => {
        balances.refresh();
        banks.refresh();
        history.refresh();
      }}
      error={history.error}
      onRetry={history.reload}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(available)} mono last />
        </CardContent>
      </Card>

      {!!banks.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle icon="account-multiple-outline">Saved beneficiaries</CardTitle>
          </CardHeader>
          <CardContent>
            {banks.data.map((bank: any, i: number) => (
              <Pressable
                key={bank._id}
                onPress={() => useBank(bank)}
                style={({ pressed }) => [
                  styles.bankRow,
                  i === banks.data!.length - 1 && styles.bankRowLast,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${bank.accountHolderName || bank.bankName}`}
              >
                <View style={styles.bankInfo}>
                  <Text style={styles.bankName} numberOfLines={1}>
                    {bank.accountHolderName || bank.bankName}
                  </Text>
                  <Text style={styles.bankMeta} numberOfLines={1}>
                    ••••{String(bank.accountNumber).slice(-4)} · {bank.ifscCode}
                  </Text>
                </View>
                <Text style={styles.useText}>Use</Text>
              </Pressable>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="cash-fast">New payout</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Banner
            tone="warning"
            message="Payouts are irreversible. Check the account number and IFSC before you submit."
          />
          <Input
            label="Beneficiary name"
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
            error={confirmAccount && !accountsMatch ? 'Account numbers do not match' : undefined}
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
          />
          <Input
            label="Bank name"
            required
            value={bankName}
            onChangeText={setBankName}
            leftIcon="office-building-outline"
          />
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
          <View style={styles.field}>
            <Text style={styles.label}>Transfer mode</Text>
            <Segmented options={MODES} value={mode} onChange={setMode} />
          </View>
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
          {!!payout.error && <ErrorBanner message={payout.error} />}
          {!!notice && <SuccessBanner message={notice} />}
          <Button
            onPress={onPayout}
            disabled={!valid}
            loading={payout.pending}
            icon="send-outline"
            size="lg"
            fullWidth
          >
            Process payout
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Payout history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Beneficiary" value={txn.metadata?.accountHolderName} />
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState icon="send-outline" title="No payouts yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  bankRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  bankRowLast: { borderBottomWidth: 0 },
  bankInfo: { flex: 1, minWidth: 0, gap: 2 },
  bankName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  bankMeta: { fontSize: t.micro, color: c.mutedForeground },
  useText: { fontSize: t.small, fontWeight: '700', color: c.accent },
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

export default DirectPayoutScreen;
