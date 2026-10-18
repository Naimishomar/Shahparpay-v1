import React, { useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  SectionTitle,
  Segmented,
  money,
  shortDate,
  SkeletonRows,
  SkeletonCard,
  SkeletonTitle,
  SkeletonField,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { bankInitials } from '@/components/aeps/BiometricCapture';
import { StatusText } from '@/components/aeps/TransactionReceipt';
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
      skeleton={<View style={{ gap: 16 }}><SkeletonCard><SkeletonRows count={1} avatar={48} /></SkeletonCard><SkeletonTitle /><SkeletonCard><SkeletonRows count={2} amount={false} /></SkeletonCard><SkeletonTitle /><SkeletonField /><SkeletonField /></View>}
      refreshing={banks.refreshing || history.refreshing}
      onRefresh={reloadAll}
      error={banks.error}
      onRetry={banks.reload}
    >
      {/* BHIM's balance card: the figure big and light, the rest as captions. */}
      <View style={styles.card}>
        <Text style={styles.muted}>AEPS wallet</Text>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
          {money(available)}
        </Text>
        <View style={styles.stats}>
          <Stat label="Pending" value={money(summary.pending)} tone={colors.warning} />
          <Stat label="Settled" value={money(summary.settled)} tone={colors.success} />
          <Stat label="Failed" value={String(summary.failed)} tone={colors.destructive} />
        </View>
      </View>

      {!!notice && <SuccessBanner message={notice} />}
      {!!removeBank.error && <ErrorBanner message={removeBank.error} />}
      {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
      {!!checkAccount.error && <ErrorBanner message={checkAccount.error} />}

      <View>
        <SectionTitle>Settlement bank</SectionTitle>
        {banks.data?.length ? (
          <View style={styles.list}>
            {banks.data.map((bank: any, index: number) => {
              const selected = bankId === bank._id;
              const last4 = String(bank.accountNumber).slice(-4);
              return (
                <View key={bank._id} style={[styles.bankRow, index === banks.data!.length - 1 && styles.rowLast]}>
                  <Pressable
                    onPress={() => setBankId(bank._id)}
                    style={({ pressed }) => [styles.bankMain, pressed && { opacity: 0.7 }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${bank.bankName}, account ending ${last4}`}
                  >
                    <View style={styles.logo}>
                      <Text style={styles.logoText}>{bankInitials(bank.bankName || 'Bank')}</Text>
                    </View>
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankName} numberOfLines={1}>
                        {bank.bankName || 'Bank account'}
                      </Text>
                      <Text style={styles.bankMeta} numberOfLines={1}>
                        *** {last4} · {bank.ifscCode}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.highlight : colors.mutedForeground}
                    />
                  </Pressable>
                  <View style={styles.bankLinks}>
                    <StatusText status={bank.verificationStatus || bank.status} />
                    <View style={styles.spacer} />
                    <Pressable
                      onPress={() => run(() => checkAccount.run(bank._id), 'Account status refreshed.')}
                      hitSlop={10}
                      style={styles.link}
                      accessibilityRole="button"
                      accessibilityLabel="Refresh account verification status"
                    >
                      <Text style={styles.linkText}>Check status</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemove(bank)}
                      hitSlop={10}
                      style={styles.link}
                      accessibilityRole="button"
                      accessibilityLabel="Remove bank account"
                    >
                      <Text style={styles.linkMuted}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="bank-off-outline"
            title="No settlement bank yet"
            subtitle="Add the account you want your balance settled into, or pull one in from PaySprint"
          />
        )}

        {/* BHIM's dashed "Add new bank account" rows. */}
        <Pressable
          onPress={() => setShowAddBank(!showAddBank)}
          style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={showAddBank ? 'Cancel' : 'Add bank'}
          accessibilityState={{ expanded: showAddBank }}
        >
          <IconTile icon={showAddBank ? 'close' : 'bank-outline'} size={44} iconSize={20} />
          <Text style={styles.addText}>{showAddBank ? 'Cancel' : 'Add new bank account'}</Text>
        </Pressable>
        <Pressable
          onPress={() => run(() => syncBanks.run(), 'Banks synced from PaySprint.')}
          disabled={syncBanks.pending}
          style={({ pressed }) => [styles.addRow, (pressed || syncBanks.pending) && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Sync"
          accessibilityState={{ busy: syncBanks.pending }}
        >
          <IconTile icon="cloud-download-outline" size={44} iconSize={20} />
          <Text style={styles.addText}>{syncBanks.pending ? 'Syncing…' : 'Sync banks from PaySprint'}</Text>
        </Pressable>
        {!!syncBanks.error && <ErrorBanner message={syncBanks.error} />}

        {showAddBank && (
          <View style={[styles.card, styles.form]}>
            <Input
              label="Account holder name"
              required
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="Exactly as per bank records"
            />
            <Input
              label="Account number"
              required
              value={accountNumber}
              onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <Input
              label="Confirm account number"
              required
              value={confirmAccount}
              onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
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
              error={ifscCode.length === 11 && !ifscValid ? 'Invalid IFSC format' : undefined}
              helperText="11 characters, e.g. HDFC0001234"
            />
            <Input label="Bank name" required value={bankName} onChangeText={setBankName} />
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
              fullWidth
            >
              Save bank account
            </Button>
          </View>
        )}
      </View>

      <View>
        <SectionTitle>Withdraw to bank</SectionTitle>
        <View style={[styles.card, styles.form]}>
          {!bankId && (
            <Banner tone="warning" message="Add and select a settlement bank before you can settle." />
          )}
          <Segmented options={MODES} value={mode} onChange={setMode} scroll={false} />
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
            haptic="medium"
            fullWidth
          >
            Settle now
          </Button>
        </View>
      </View>

      <View>
        <SectionTitle>Settlement history</SectionTitle>
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          <View style={styles.list}>
            {history.data.slice(0, 20).map((txn: any, index: number, rows: any[]) => {
              const pending = ['PENDING', 'PROCESSING'].includes(String(txn.status).toUpperCase());
              return (
                <View
                  key={txn._id || txn.transactionId}
                  style={[styles.txn, index === rows.length - 1 && styles.rowLast]}
                >
                  <IconTile icon="bank-transfer-out" size={44} iconSize={20} />
                  <View style={styles.bankInfo}>
                    <Text style={styles.bankName} numberOfLines={1}>
                      {txn.metadata?.beneficiaryName || txn.metadata?.bankName || 'Settlement'}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1}>
                      {[
                        txn.metadata?.beneficiaryName ? txn.metadata?.bankName : null,
                        txn.metadata?.bankAccount ? `*** ${String(txn.metadata.bankAccount).slice(-4)}` : null,
                        shortDate(txn.createdAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1} selectable>
                      {txn.transactionId}
                    </Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={styles.amount}>{money(txn.amount)}</Text>
                    <StatusText status={txn.status} />
                    {pending && (
                      <Pressable
                        onPress={() => run(() => checkStatus.run(txn.transactionId), 'Status checked.')}
                        disabled={checkStatus.pending}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Check status"
                      >
                        <Text style={styles.linkText}>{checkStatus.pending ? 'Checking…' : 'Check status'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="bank-transfer" title="No settlements yet" />
        )}
      </View>
    </Screen>
  );
};

const Stat: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <View style={styles.stat}>
    <Text style={styles.muted}>{label}</Text>
    <Text style={[styles.statValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  muted: { fontSize: t.small, color: c.mutedForeground },
  balance: {
    fontSize: 44,
    fontWeight: '300',
    color: c.foreground,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  stat: { flex: 1, gap: 3 },
  statValue: { fontSize: t.body, fontWeight: '500', fontVariant: ['tabular-nums'] },
  form: { gap: space.lg },
  list: {
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  rowLast: { borderBottomWidth: 0 },
  bankRow: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  bankMain: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tileGradient[0],
  },
  logoText: { fontSize: t.small, fontWeight: '500', color: c.tileForeground },
  bankInfo: { flex: 1, minWidth: 0, gap: 3 },
  bankName: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  bankMeta: { fontSize: t.caption, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  bankLinks: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingLeft: 44 + space.md },
  spacer: { flex: 1 },
  link: { minHeight: 32, justifyContent: 'center' },
  linkText: { fontSize: t.small, fontWeight: '500', color: c.accent, textDecorationLine: 'underline' },
  linkMuted: { fontSize: t.small, color: c.mutedForeground },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 72,
    paddingHorizontal: space.lg,
    marginTop: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
  },
  addText: { flex: 1, fontSize: t.body, color: c.foreground },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  amount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
}));

export default AepsSettlementScreen;
