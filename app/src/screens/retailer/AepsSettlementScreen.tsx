import React, { useState } from 'react';
import { View, Text, Alert, Pressable, ScrollView, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  SectionTitle,
  Segmented,
  Row,
  money,
  dateTime,
  SkeletonRows,
  SkeletonCard,
  SkeletonTitle,
  SkeletonField,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { bankInitials } from '@/components/aeps/BiometricCapture';
import { StatusText } from '@/components/aeps/TransactionReceipt';
import api from '@/services/api';
import { DoneBody, type PayReceipt } from './RechargeScreen';

// Mirrors frontend/src/pages/AepsSettlement.tsx; the backend enforces the same.
const SETTLEMENT_BASE_CHARGE = 5;
const SETTLEMENT_GST_RATE = 18;
const SETTLEMENT_FEE = SETTLEMENT_BASE_CHARGE + Math.round(SETTLEMENT_BASE_CHARGE * (SETTLEMENT_GST_RATE / 100) * 100) / 100;
// Icchhamati refuses payouts of ₹500 or less.
const SETTLEMENT_MIN = 501;
const SETTLEMENT_MAX = 25000;
const MODES = [
  { key: 'IMPS', label: 'IMPS · Instant' },
  { key: 'NEFT', label: 'NEFT · Batch' },
];
const bankStatus = (status?: string) =>
  status === 'VERIFIED'
    ? { label: 'Active', tone: colors.success }
    : status === 'PENDING'
      ? { label: 'Pending Activation', tone: colors.warning }
      : { label: 'Rejected', tone: colors.destructive };
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RECEIPT_LABELS = {
  SUCCESS: 'Settlement successful',
  PENDING: 'Awaiting bank confirmation',
  FAILED: 'Settlement failed',
} as const;

/** The web's SettlementReceipt rows, in the app's shared receipt shape (DoneBody). */
export const settlementReceipt = (r: {
  status: keyof typeof RECEIPT_LABELS;
  message?: string;
  transactionId: string;
  utr?: string;
  amount: number;
  fee: number;
  mode: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  beneficiaryMobile?: string;
}): PayReceipt => {
  const heading = RECEIPT_LABELS[r.status];
  return {
    settled: r.status === 'SUCCESS',
    heading,
    amount: inr(r.amount),
    rows: [
      { label: 'Message', value: r.message && r.message !== heading ? r.message : null },
      { label: 'Type', value: 'Trade Wallet Settlement', dashBefore: true },
      { label: 'Amount', value: inr(r.amount) },
      { label: 'Charges (incl. GST)', value: inr(r.fee) },
      { label: 'Total debited', value: r.status === 'FAILED' ? `${inr(0)} (refunded)` : inr(r.amount + r.fee) },
      { label: 'Mode', value: r.mode },
      { label: 'Account holder', value: r.accountHolderName },
      { label: 'Bank', value: r.bankName },
      { label: 'Account number', value: r.accountNumber },
      { label: 'Beneficiary mobile', value: r.beneficiaryMobile },
      { label: 'UTR', value: r.utr, dashBefore: true },
      { label: 'Reference ID', value: r.transactionId },
      { label: 'Note', value: 'System generated receipt; no signature required.', dashBefore: true },
    ],
  };
};

/** The backend's message from a thrown request, else the web's fallback. */
const failure = (err: any, fallback: string) => err?.response?.data?.message || fallback;

export const AepsSettlementScreen: React.FC = () => {
  const [bankId, setBankId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('IMPS');
  const [beneficiaryMobile, setBeneficiaryMobile] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);

  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [showBankNames, setShowBankNames] = useState(false);
  // A new payout bank is activated, and a saved one removed, with an OTP to the registered mobile.
  const [otpStep, setOtpStep] = useState<{ id: string; purpose: 'add' | 'delete' } | null>(null);
  const [otp, setOtp] = useState('');

  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  /** Banks created on the provider whose activation OTP was never entered. */
  const [pendingBanks, setPendingBanks] = useState<any[]>([]);
  const banks = useAsync<any[]>(async () => {
    const res = await api.getSavedBanks();
    const list = res.data ?? [];
    setPendingBanks((res as any).pending ?? []);
    setBankId((prev) => (prev && list.some((b: any) => b._id === prev) ? prev : list[0]?._id ?? null));
    return list;
  }, []);
  const bankNames = useAsync<string[]>(async () => (await api.icchAepsSettlementBanks())?.data ?? [], []);
  const history = useAsync<any[]>(
    async () => (await api.getSettlementHistory({ type: 'AEPS_SETTLEMENT' })).data ?? [],
    []
  );

  /** Calls a settlement endpoint; a refusal throws the web's message for that call. */
  const call = async (request: () => Promise<any>, fallback: string, refused = fallback) => {
    let res: any;
    try {
      res = await request();
    } catch (err) {
      throw new Error(failure(err, fallback));
    }
    if (!res?.success) throw new Error(res?.message || refused);
    return res;
  };

  const settle = useAction(async () => {
    if (!bankId || !amount || !pin) throw new Error('Please fill all required fields');
    const value = Number(amount);
    if (value < SETTLEMENT_MIN || value > SETTLEMENT_MAX) {
      throw new Error(`Settlement amount must be between ₹${SETTLEMENT_MIN} and ₹${SETTLEMENT_MAX}`);
    }
    let body: any;
    let thrown = false;
    try {
      body = await api.initiateSettlement({ bankId, amount: value, pin, mode, beneficiaryMobile });
    } catch (err: any) {
      body = err?.response?.data;
      thrown = true;
    }
    const ok = !thrown && !!body?.success;
    // A receipt whenever the backend created a transaction, whatever its outcome (as the web's issueReceipt).
    const transactionId = body?.data?.transactionId || body?.transactionId;
    if (transactionId) {
      const bank = banks.data?.find((b: any) => b._id === bankId);
      setReceipt(
        settlementReceipt({
          status: ok ? (body.pending ? 'PENDING' : 'SUCCESS') : 'FAILED',
          message: body?.message || '',
          transactionId,
          utr: body?.data?.response?.rrn || body?.data?.response?.utr || '',
          amount: value,
          fee: SETTLEMENT_FEE,
          mode,
          bankName: bank?.bankName || '',
          accountNumber: String(bank?.accountNumber || ''),
          accountHolderName: bank?.accountHolderName || '',
          beneficiaryMobile,
        })
      );
      if (!ok) history.refresh();
      return { ok, receipt: true };
    }
    if (!ok) throw new Error(body?.message || (thrown ? 'Failed to initiate settlement' : 'Settlement failed'));
    return { ok, receipt: false };
  });

  const askOtp = (id: string, purpose: 'add' | 'delete') => {
    setOtp('');
    setOtpStep({ id, purpose });
  };

  /** Resolves true when the bank is already active, false when it now waits for the OTP. */
  const addBank = useAction(async () => {
    const res = await call(
      () => api.addSettlementBank({ benename: accountHolderName.trim(), beneaccount: accountNumber, ifsc: ifscCode }),
      'Failed to add bank account'
    );
    const id = res.data?.id;
    if (!id || res.data?.verified) return true;
    try {
      await call(() => api.sendSettlementBankOtp(id), 'Could not send the OTP');
    } catch (err: any) {
      if (/already verified|active/i.test(err?.message || '')) return true;
      throw err;
    }
    askOtp(id, 'add');
    return false;
  });
  const confirmOtp = useAction(async () => {
    if (!otpStep) return null;
    await (otpStep.purpose === 'add'
      ? call(() => api.verifySettlementBank(otpStep.id, otp), 'Could not verify that OTP')
      : call(() => api.deleteSettlementBank(otpStep.id, otp), 'Failed to remove bank account'));
    return otpStep.purpose;
  });
  /** Picks up an earlier add at the OTP step instead of paying for a second penny drop. */
  const resumeBank = useAction(async (id: string) => {
    await call(() => api.sendSettlementBankOtp(id), 'Could not send the OTP');
    askOtp(id, 'add');
    return true;
  });
  const syncBanks = useAction(() => call(() => api.syncSavedBanks(), 'Failed to sync banks'));
  const removeBank = useAction(async (id: string) => {
    await call(() => api.sendSettlementBankDeleteOtp(id), 'Could not send the deletion OTP');
    askOtp(id, 'delete');
    return true;
  });
  const checkStatus = useAction((transactionId: string) =>
    call(() => api.checkSettlementStatus(transactionId), 'Failed to check settlement status', 'Status enquiry failed')
  );
  const checkAccount = useAction((id: string) => call(() => api.getSettlementAccountStatus(id), 'Failed to check account status'));

  const available = balances.data?.aepsBalance ?? 0;
  const amt = Number(amount);
  const amountValid = amt >= SETTLEMENT_MIN && amt <= SETTLEMENT_MAX;

  const reloadAll = () => {
    balances.refresh();
    banks.refresh();
    history.refresh();
  };

  /** Runs an action; on success shows `message` (or the server's, when `useServer`) and refreshes `after`. */
  const run = async (action: () => Promise<any>, message: string, after: () => void, useServer = false) => {
    setNotice('');
    const res = await action();
    if (res) {
      setNotice((useServer && res.message) || message);
      after();
    }
  };

  const finishAdd = (message: string) => {
    setNotice(message);
    setAccountNumber('');
    setIfscCode('');
    setBankName('');
    setAccountHolderName('');
    setShowAddBank(false);
    setOtpStep(null);
    banks.reload();
  };

  const submitAdd = async () => {
    setNotice('');
    if ((await addBank.run()) === true) finishAdd('Bank account added successfully!');
  };

  const submitOtp = async () => {
    const purpose = await confirmOtp.run();
    if (purpose === 'add') finishAdd('Bank account activated for settlement');
    if (purpose === 'delete') {
      setNotice('Bank account removed successfully!');
      setOtpStep(null);
      banks.refresh();
    }
  };

  const confirmRemove = (bank: any) =>
    Alert.alert('Remove bank account?', 'Are you sure you want to remove this bank account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setNotice('');
          removeBank.run(bank._id);
        },
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
      {/* The web shows this balance in its header bar, which the app does not have. */}
      <View style={styles.card}>
        <Text style={styles.muted}>Trade Wallet</Text>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
          {money(available)}
        </Text>
        <Text style={styles.muted}>Move your Trade Wallet balance to your bank account</Text>
      </View>

      {!!notice && <SuccessBanner message={notice} />}
      {!!removeBank.error && <ErrorBanner message={removeBank.error} />}
      {!!otpStep && (
        <View style={[styles.card, styles.form]}>
          <Text style={styles.bankName}>{otpStep.purpose === 'add' ? 'Activate Bank Account' : 'Remove Bank Account'}</Text>
          <Text style={styles.muted}>Enter the OTP sent to your registered mobile number.</Text>
          <Input
            label="OTP"
            required
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit OTP"
          />
          {!!confirmOtp.error && <ErrorBanner message={confirmOtp.error} />}
          <Button onPress={submitOtp} loading={confirmOtp.pending} disabled={otp.length < 4} fullWidth>
            {otpStep.purpose === 'add' ? 'Verify & Activate' : 'Verify & Remove'}
          </Button>
          <Button variant="ghost" onPress={() => setOtpStep(null)} fullWidth>
            Cancel
          </Button>
        </View>
      )}
      {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
      {!!checkAccount.error && <ErrorBanner message={checkAccount.error} />}

      <View>
        <SectionTitle>Settlement Account</SectionTitle>
        {pendingBanks.map((bank: any) => (
          <View key={bank._id} style={[styles.card, styles.pendingRow]}>
            <Text style={styles.pendingText}>
              {bank.bankName} · {String(bank.accountNumber || '').slice(-4)} is added but not active yet. Verify it with the OTP.
            </Text>
            <Button size="sm" onPress={() => resumeBank.run(bank._id)} loading={resumeBank.pending}>
              Verify with OTP
            </Button>
          </View>
        ))}
        {!!resumeBank.error && <ErrorBanner message={resumeBank.error} />}
        {banks.data?.length ? (
          <View style={styles.list}>
            {banks.data.map((bank: any, index: number) => {
              const selected = bankId === bank._id;
              const last4 = String(bank.accountNumber || '').slice(-4);
              const state = bankStatus(bank.status);
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
                        •••• {last4} · {bank.ifscCode}
                      </Text>
                      <Text style={styles.bankMeta} numberOfLines={1}>
                        Beneficiary: {bank.accountHolderName || '—'}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.highlight : colors.mutedForeground}
                    />
                  </Pressable>
                  <View style={styles.bankLinks}>
                    <Text style={[styles.statusLabel, { color: state.tone }]}>{state.label}</Text>
                    <View style={styles.spacer} />
                    <Pressable
                      onPress={() => run(() => checkAccount.run(bank._id), 'Account status checked', banks.refresh, true)}
                      disabled={!bank.beneId || checkAccount.pending}
                      hitSlop={10}
                      style={[styles.link, !bank.beneId && { opacity: 0.5 }]}
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
            title="No bank account added"
            subtitle="Add the account as a DMT beneficiary on your registered mobile, then sync."
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
          <Text style={styles.addText}>{showAddBank ? 'Cancel' : 'Add Bank'}</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            run(
              async () => {
                const res = await syncBanks.run();
                return res && { message: `Synced ${res.synced ?? 0} bank account(s)` };
              },
              '',
              banks.refresh,
              true
            )
          }
          disabled={syncBanks.pending}
          style={({ pressed }) => [styles.addRow, (pressed || syncBanks.pending) && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Sync"
          accessibilityState={{ busy: syncBanks.pending }}
        >
          <IconTile icon="cloud-download-outline" size={44} iconSize={20} />
          <Text style={styles.addText}>{syncBanks.pending ? 'Syncing...' : 'Sync Banks'}</Text>
        </Pressable>
        {!!syncBanks.error && <ErrorBanner message={syncBanks.error} />}

        {showAddBank && (
          <View style={[styles.card, styles.form]}>
            <Text style={styles.bankName}>Add Bank Account</Text>
            <View>
              <SelectField
                label="Bank Name"
                required
                value={bankName || undefined}
                placeholder="Select a Bank"
                open={showBankNames}
                onPress={() => setShowBankNames(!showBankNames)}
              />
              {showBankNames && (
                <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {(bankNames.data ?? []).map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setBankName(name);
                        setShowBankNames(false);
                      }}
                      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.addText}>{name}</Text>
                      {name === bankName && <Ionicons name="checkmark" size={18} color={colors.highlight} />}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            <Text style={styles.muted}>
              Enter the Account Holder Name exactly as per bank records: a penny-drop checks it (₹4 from your Utility Wallet), then an OTP to your registered mobile activates the account.
            </Text>
            <Input
              label="Account Holder Name"
              required
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="As per bank records"
            />
            <Input
              label="Account Number"
              required
              value={accountNumber}
              onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Account Number"
            />
            <Input
              label="IFSC Code"
              required
              value={ifscCode}
              onChangeText={(v) => setIfscCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="e.g. SBIN0001234"
            />
            {!!addBank.error && <ErrorBanner message={addBank.error} />}
            <Button
              onPress={submitAdd}
              loading={addBank.pending}
              disabled={!bankName || !accountHolderName.trim() || !accountNumber || !ifscCode || !!otpStep}
              fullWidth
            >
              {addBank.pending ? 'Adding...' : 'Add Bank'}
            </Button>
          </View>
        )}
      </View>

      <View>
        <SectionTitle>Transfer to Bank</SectionTitle>
        <View style={[styles.card, styles.form]}>
          <Input
            label="Beneficiary Mobile"
            value={beneficiaryMobile}
            onChangeText={(v) => setBeneficiaryMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="Enter Mobile"
            leftIcon="phone-outline"
          />
          <Input
            label="Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="currency-inr"
            helperText={`Between ₹${SETTLEMENT_MIN} and ₹${SETTLEMENT_MAX.toLocaleString('en-IN')}`}
          />
          <Input
            label="Transaction PIN"
            required
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry={!showPin}
            maxLength={6}
            placeholder="Enter 4-6 digit PIN"
            rightIcon={showPin ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPin(!showPin)}
            rightIconLabel={showPin ? 'Hide PIN' : 'Show PIN'}
          />
          <View style={styles.modeField}>
            <Text style={styles.fieldLabel}>Transaction Mode</Text>
            <Segmented options={MODES} value={mode} onChange={setMode} scroll={false} />
          </View>
        </View>
      </View>

      <View>
        <SectionTitle>Summary</SectionTitle>
        <View style={[styles.card, styles.form]}>
          <View>
            <Row label="Amount credited to bank" value={`₹${amountValid ? amt.toFixed(2) : '0.00'}`} />
            <Row label={`Charge (₹${SETTLEMENT_BASE_CHARGE} + ${SETTLEMENT_GST_RATE}% GST)`} value={`₹${SETTLEMENT_FEE.toFixed(2)}`} />
            <Row label="Mode" value={mode} />
            <Row label="Total deduction from Trade Wallet" value={`₹${amountValid ? (amt + SETTLEMENT_FEE).toFixed(2) : '0.00'}`} last />
          </View>
          <Text style={styles.muted}>
            {`Available 24×7\n₹${SETTLEMENT_MIN} – ₹${SETTLEMENT_MAX.toLocaleString('en-IN')} per settlement\nOnly active (verified) accounts can receive funds`}
          </Text>
          {!!settle.error && <ErrorBanner message={settle.error} />}
          <Button
            onPress={async () => {
              setNotice('');
              const res = await settle.run();
              balances.refresh();
              if (!res?.ok) return;
              if (!res.receipt) setNotice('Settlement request submitted successfully!');
              setAmount('');
              setPin('');
              history.refresh();
            }}
            disabled={!bankId}
            loading={settle.pending}
            haptic="medium"
            fullWidth
          >
            {settle.pending ? 'Processing...' : 'Submit Settlement'}
          </Button>
        </View>
      </View>

      <View>
        <SectionTitle>Settlement History</SectionTitle>
        {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
          <View style={styles.list}>
            {history.data.map((txn: any, index: number, rows: any[]) => {
              const pending = ['PENDING', 'PROCESSING'].includes(String(txn.status).toUpperCase());
              return (
                <View
                  key={txn._id || txn.transactionId}
                  style={[styles.txn, index === rows.length - 1 && styles.rowLast]}
                >
                  <IconTile icon="bank-transfer-out" size={44} iconSize={20} />
                  <View style={styles.bankInfo}>
                    <Text style={styles.bankName} numberOfLines={1}>
                      {txn.metadata?.bankName}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1}>
                      A/C: {txn.metadata?.bankAccount}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1}>
                      {dateTime(txn.createdAt)}
                    </Text>
                    <Text style={styles.bankMeta} numberOfLines={1} selectable>
                      {txn.transactionId}
                    </Text>
                    {!!txn.metadata?.utr && (
                      <Text style={[styles.bankMeta, { color: colors.success }]} numberOfLines={1} selectable>
                        UTR: {txn.metadata.utr}
                      </Text>
                    )}
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={styles.amount}>₹{Number(txn.amount).toFixed(2)}</Text>
                    <StatusText status={txn.status} />
                    {pending && (
                      <Pressable
                        onPress={() => run(() => checkStatus.run(txn.transactionId), 'Status checked', history.refresh, true)}
                        disabled={checkStatus.pending}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Check status"
                      >
                        <Text style={styles.linkText}>{checkStatus.pending ? 'Checking...' : 'Check Status'}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="bank-transfer" title="No settlement history found." />
        )}
      </View>
      <Modal visible={!!receipt} animationType="slide" onRequestClose={() => setReceipt(null)} statusBarTranslucent>
        {receipt && (
          <DoneBody receipt={receipt} onDone={() => setReceipt(null)} shareTitle="SHAHPARPAY — SETTLEMENT RECEIPT" />
        )}
      </Modal>
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
  muted: { fontSize: t.small, color: c.mutedForeground },
  balance: {
    fontSize: 44,
    fontWeight: '300',
    color: c.foreground,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  modeField: { gap: 7 },
  fieldLabel: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  statusLabel: { fontSize: t.caption, fontWeight: '500' },
  options: { maxHeight: 260, marginTop: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space.lg },
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
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, borderColor: c.warning },
  pendingText: { flex: 1, fontSize: t.small, color: c.foreground },
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
