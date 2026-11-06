import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { useModalInsets } from '@/hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t, Tone } from '../../theme/colors';
import { toneFor } from '@/components/ui/Gradient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TopGlow } from '@/components/ui/TopGlow';
import { Screen, Banner, EmptyState, ErrorBanner, SectionTitle, SuccessBanner, money } from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { DoneBody, Keypad, PayReceipt, PinBody } from './RechargeScreen';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The wallet PIN is exactly four digits (backend wallet.controller setPin). */
export const PIN_LENGTH = 4;

export const MODES = [
  { key: 'IMPS', label: 'IMPS · Instant' },
  { key: 'NEFT', label: 'NEFT · Batch' },
];

/** Smallest transfer the web portal accepts. */
export const MIN_AMOUNT = 10;
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export const initialsOf = (name: string) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/** One keypad press applied to the typed amount: digits, one '.', two decimals. */
export const typeKey = (value: string, key: string) => {
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const [whole, frac] = value.split('.');
  if (frac !== undefined) return frac.length >= 2 ? value : value + key;
  if (whole.length >= 7) return value;
  return whole === '0' ? key : value + key;
};

/** "500000" -> "5,00,000", keeping what was typed after the point. */
export const groupTyped = (value: string) => {
  const [whole, frac] = value.split('.');
  const w = whole || '0';
  const last3 = w.slice(-3);
  const rest = w.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return frac === undefined ? grouped : `${grouped}.${frac}`;
};

const rupees = (value: string) => `₹ ${groupTyped(value)}`;

/** Round initials chip, toned by name so a payee keeps one colour. */
export const Initials: React.FC<{ name: string; size?: number; fontSize?: number; tone?: Tone }> = ({
  name,
  size = 40,
  fontSize = 13,
  tone,
}) => {
  const { bg, fg } = colors.tones[tone ?? toneFor(name || '?')];
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.initialsText, { color: fg, fontSize }]}>{initialsOf(name)}</Text>
    </View>
  );
};

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

/**
 * "Two thousand rupees only" under the amount, as BHIM writes it — Indian
 * grouping. ponytail: same rule as AepsScreen's amountInWords (not exported
 * there); lift both into one helper when a third screen needs it.
 */
export const amountInWords = (value: string) => {
  const n = Math.floor(Number(value));
  if (!n || n < 0 || n > 999999999) return '';
  const parts: string[] = [];
  const push = (count: number, unit: string) => {
    if (count) parts.push(`${twoDigits(count)} ${unit}`);
  };
  push(Math.floor(n / 10000000), 'crore');
  push(Math.floor((n / 100000) % 100), 'lakh');
  push(Math.floor((n / 1000) % 100), 'thousand');
  push(Math.floor((n / 100) % 10), 'hundred');
  const rest = n % 100;
  if (rest) parts.push(twoDigits(rest));
  const words = `${parts.join(' ')} rupees only`;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const TopIcon: React.FC<{ glyph: string; label: string; onPress: () => void }> = ({ glyph, label, onPress }) => (
  <Pressable
    onPress={onPress}
    hitSlop={10}
    style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={glyph as any} size={26} color={colors.foreground} />
  </Pressable>
);

export type PayStep = 'amount' | 'pin' | 'done' | null;
export type { PayReceipt };

/**
 * Amount → Shahparpay wallet PIN → receipt, as full-screen steps over the
 * screen they start from. The amount step is BHIM's: the payee, a huge light
 * amount with its words, the mode as note pills, Pay over the app's keypad.
 * The caller owns the API call; this only collects input and shows the result.
 */
export const PayFlow: React.FC<{
  step: PayStep;
  setStep: (step: PayStep) => void;
  payeeName: string;
  payeeMeta: string;
  amount: string;
  setAmount: (v: string) => void;
  mode: string;
  setMode: (m: string) => void;
  modes: { key: string; label: string }[];
  available: number;
  /** Extra condition for leaving the amount step (e.g. a verified payee). */
  blocked?: string;
  pin: string;
  setPin: (v: string) => void;
  /** Runs the payment; resolves true when the receipt step should show. */
  onSubmit: () => Promise<boolean>;
  pending: boolean;
  error?: string | null;
  receipt: PayReceipt | null;
  onDone: () => void;
  onMore?: () => void;
}> = (p) => {
  const insets = useModalInsets();
  const dark = useTheme().resolvedTheme === 'dark';
  const overBalance = Number(p.amount) > p.available;
  const belowMin = Number(p.amount) > 0 && Number(p.amount) < MIN_AMOUNT;
  const canSend = Number(p.amount) >= MIN_AMOUNT && !overBalance && !p.blocked;

  // The keypad opens when the amount is tapped, not on arrival, so the payee
  // details and mode switch have the whole screen first. Android's back closes
  // it before it leaves the step.
  const [keypadOpen, setKeypadOpen] = useState(false);
  useEffect(() => {
    if (!p.step) setKeypadOpen(false);
  }, [p.step]);

  const back = () => {
    if (p.step === 'amount' && keypadOpen) {
      setKeypadOpen(false);
      return;
    }
    if (p.step === 'pin') {
      p.setPin('');
      p.setStep('amount');
    } else if (p.step === 'done') p.onDone();
    else p.setStep(null);
  };

  const submitPin = async () => {
    if (p.pin.length !== PIN_LENGTH || p.pending) return;
    const ok = await p.onSubmit();
    // A wrong PIN is typed again from scratch, never edited.
    if (!ok) p.setPin('');
  };

  const words = amountInWords(p.amount);

  return (
    <Modal visible={!!p.step} animationType="slide" onRequestClose={back} statusBarTranslucent>
      {p.step === 'done' && p.receipt ? (
        <DoneBody receipt={p.receipt} onDone={p.onDone} shareTitle="SHAHPARPAY — MONEY TRANSFER" />
      ) : p.step === 'pin' ? (
        // Shahparpay's own wallet PIN — deliberately not an NPCI UPI PIN pad.
        <PinBody
          payee={`Paying ${p.payeeName}`}
          amount={Number(p.amount)}
          detail={`${p.mode} · from Trade Wallet`}
          pin={p.pin}
          onPin={(v) => p.setPin(v.slice(0, PIN_LENGTH))}
          onSubmit={submitPin}
          onClose={back}
          onForgot={() => p.setStep(null)}
          pending={p.pending}
          error={p.error}
        />
      ) : (
        <View style={[styles.flowRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <TopGlow />
          <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
          <View style={styles.topbar}>
            {/* The on-screen arrow leaves the step outright; only the
                hardware back steps through the open keypad first. */}
            <TopIcon glyph="arrow-back" label="Back" onPress={() => p.setStep(null)} />
            <View style={styles.flex} />
            {!!p.onMore && <TopIcon glyph="ellipsis-vertical" label="More options" onPress={p.onMore} />}
          </View>
          <ScrollView style={styles.flex} contentContainerStyle={styles.amountBody} bounces={false}>
            <Initials name={p.payeeName} size={76} fontSize={26} />
            <Text style={styles.paying} numberOfLines={1}>
              Paying {p.payeeName}
            </Text>
            <View style={styles.idChip}>
              <Ionicons name="business-outline" size={15} color={colors.highlight} />
              <Text style={styles.idChipText} numberOfLines={1}>
                {p.payeeMeta}
              </Text>
            </View>
            <Pressable
              onPress={() => setKeypadOpen(true)}
              style={styles.bigamt}
              accessibilityRole="button"
              accessibilityLabel={`Amount ${rupees(p.amount || '0')}. Tap to enter the amount`}
            >
              <Text style={[styles.cur, !p.amount && styles.amtEmpty]}>₹</Text>
              <Text style={[styles.amt, !p.amount && styles.amtEmpty]} numberOfLines={1} adjustsFontSizeToFit>
                {groupTyped(p.amount || '0')}
              </Text>
              {keypadOpen && <View style={styles.caret} />}
            </Pressable>
            {overBalance || p.blocked || belowMin ? (
              <Text style={styles.amountError} accessibilityLiveRegion="polite">
                {overBalance
                  ? 'Amount exceeds your Trade Wallet balance'
                  : p.blocked || `Enter an amount of at least ₹${MIN_AMOUNT}`}
              </Text>
            ) : (
              <Text style={styles.words}>{words || (keypadOpen ? 'Enter amount' : 'Tap the amount to enter it')}</Text>
            )}
            <View style={styles.notes}>
              {QUICK_AMOUNTS.map((v) => {
                const on = p.amount === String(v);
                return (
                  <Pressable
                    key={v}
                    onPress={() => p.setAmount(String(v))}
                    style={({ pressed }) => [styles.chip, on && styles.noteOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.noteText, on && styles.noteTextOn]}>₹{groupTyped(String(v))}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.notes}>
              {p.modes.map((m) => {
                const on = m.key === p.mode;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => p.setMode(m.key)}
                    style={({ pressed }) => [styles.note, on && styles.noteOn, pressed && styles.pressed]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                  >
                    <Text style={[styles.noteText, on && styles.noteTextOn]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.debit}>
            <Text style={styles.debitLabel}>Debit from</Text>
            <View style={styles.debitRight}>
              <Ionicons name="wallet-outline" size={16} color={colors.foreground} />
              <Text style={styles.debitValue}>Trade Wallet · {money(p.available)}</Text>
            </View>
          </View>
          <View style={styles.sendWrap}>
            <Button
              fullWidth
              disabled={!canSend}
              haptic="medium"
              accessibilityLabel={Number(p.amount) > 0 ? `Pay ${rupees(p.amount)}` : 'Pay'}
              onPress={() => {
                p.setPin('');
                p.setStep('pin');
              }}
            >
              {Number(p.amount) > 0 ? `Pay ${rupees(p.amount)}` : 'Pay'}
            </Button>
          </View>
          {keypadOpen && (
            <Keypad last={['', '0', 'back']} onKey={(key) => p.setAmount(typeKey(p.amount, key))} />
          )}
        </View>
      )}
    </Modal>
  );
};

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
  const [step, setStep] = useState<PayStep>(null);
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('IMPS');
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState('');
  const [bankVerification, setBankVerification] = useState<any>(null);

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
    if (mobile.length !== 10) throw new Error('Enter valid 10-digit mobile number');
    const list = await loadBeneficiaries(mobile);
    setSender(mobile);
    return list;
  });

  const addBene = useAction(async () => {
    const benename = beneName;
    const beneaccount = beneAccount;
    const ifsc = beneIfsc;
    if (!benename || !beneaccount || !ifsc) throw new Error('Please fill all beneficiary details');
    // Caught here rather than at the bank: a typo in an account number sends
    // the money to a real stranger, and no refund follows.
    if (beneaccount !== confirmAccount) throw new Error('Account numbers do not match');
    if (!IFSC_RE.test(ifsc)) throw new Error('Enter a valid IFSC code');
    try {
      const res = await api.addDmtBeneficiary({ mobile: sender, benename, beneaccount, ifsc });
      if (!res.success) throw new Error(res.message || 'Failed to add beneficiary');
      setBankVerification(res.data?.bankVerification || null);
      return res;
    } catch (err: any) {
      if (err?.response) setBankVerification(err.response.data?.data?.bankVerification || null);
      throw err;
    }
  });

  const sendOtp = useAction(async (bene: Beneficiary, action: 'verify' | 'delete') => {
    const res =
      action === 'delete'
        ? await api.sendDmtBeneficiaryDeleteOtp(bene.id)
        : await api.sendDmtBeneficiaryOtp(bene.id);
    if (!res.success) throw new Error(res.message || 'Failed to send OTP');
    const expiry = res.expiresIn ? ` Valid for ${Math.ceil(Number(res.expiresIn) / 60)} minutes.` : '';
    setNotice(`${res.message || 'OTP sent'}${expiry}`);
    return res;
  });

  const submitOtp = useAction(async () => {
    if (!otpFor || otp.length !== 6) throw new Error('Enter the 6-digit OTP');
    const { bene, action } = otpFor;
    const res =
      action === 'verify'
        ? await api.verifyDmtBeneficiary({ beneficiary_id: bene.id, otp })
        : await api.deleteDmtBeneficiary({ beneficiary_id: bene.id, otp });
    if (!res.success) throw new Error(res.message || 'That OTP was not accepted');
    return res;
  });

  const transfer = useAction(async () => {
    if (!amount || Number(amount) < MIN_AMOUNT || pin.length !== PIN_LENGTH) {
      throw new Error(`Enter an amount of at least ₹${MIN_AMOUNT} and a 4-digit PIN`);
    }
    const res = await api.transferDmt({
      mobile: sender,
      beneficiary_id: selected!.id,
      beneaccount: selected!.account,
      ifsc: selected!.ifsc,
      amount: Number(amount),
      transfer_mode: mode,
      pin,
    });
    if (!res.success) throw new Error(res.message || 'Transfer failed');
    return res;
  });

  // DMT is paid from the Trade (AEPS) wallet, as on Icchhamati.
  const available = balances.data?.aepsBalance ?? 0;
  const verifiedCount = beneficiaries.filter((b) => b.verified).length;

  const startOtp = async (bene: Beneficiary, action: 'verify' | 'delete') => {
    setOtp('');
    setNotice('');
    submitOtp.setError(null);
    setOtpFor({ bene, action });
    await sendOtp.run(bene, action);
  };

  const openBene = (b: Beneficiary) => {
    setSelected(b);
    setAmount('');
    setPin('');
    setReceipt(null);
    setNotice('');
    setStep('amount');
  };

  const clearSender = () => {
    setSender('');
    setBeneficiaries([]);
    setSelected(null);
    setShowAddBene(false);
    setOtpFor(null);
    setBankVerification(null);
  };

  return (
    <>
      <Screen refreshing={balances.refreshing} onRefresh={balances.refresh}>
        {/* The sender: who the beneficiaries below belong to. */}
        <View style={styles.senderCard}>
          <View style={styles.senderAvatar}>
            <Ionicons name="person-outline" size={22} color={colors.foreground} />
          </View>
          {sender ? (
            <>
              <View style={styles.flex}>
                <Text style={styles.senderName} numberOfLines={1}>
                  Sending as +91 {sender}
                </Text>
                <Text style={styles.senderMeta} numberOfLines={1}>
                  {beneficiaries.length} beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'} · {verifiedCount} verified
                </Text>
              </View>
              <Pressable
                onPress={clearSender}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Change sender"
              >
                <Text style={styles.pillText}>Change</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.pillText}>+91</Text>
              <TextInput
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                autoComplete="tel"
                placeholder="10-digit number"
                placeholderTextColor={colors.mutedForeground}
                style={styles.senderInput}
                accessibilityLabel="Sender mobile number"
                onSubmitEditing={() => lookup.run()}
              />
              <Pressable
                onPress={() => lookup.run()}
                disabled={mobile.length !== 10 || lookup.pending}
                style={({ pressed }) => [
                  styles.pill,
                  styles.findPill,
                  (mobile.length !== 10 || lookup.pending) && styles.disabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Find"
              >
                <Text style={[styles.pillText, styles.findText]}>{lookup.pending ? '…' : 'Find'}</Text>
              </Pressable>
            </>
          )}
        </View>
        {!!lookup.error && <ErrorBanner message={lookup.error} />}

        {!!bankVerification && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { marginBottom: 0 }]} accessibilityRole="header">
                  Bank account verification
                </Text>
                <Text style={styles.senderMeta}>Verification response for the newly added beneficiary</Text>
              </View>
              <Pressable
                onPress={() => setBankVerification(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Dismiss bank account verification"
              >
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {(
              [
                ['Transaction ID', bankVerification.txnid],
                ['Status', bankVerification.status],
                ['Account Name', bankVerification.AccountName],
                ['Account Number', bankVerification.AccountNumber],
                ['Account Status', bankVerification.accountStatus],
                ['Bank', bankVerification.bank_name],
                ['UTR', bankVerification.utr],
                ['City', bankVerification.city],
                ['Branch', bankVerification.branch],
                ['MICR', bankVerification.micr],
                ['Response', bankVerification.resText],
                ['Name Match', bankVerification.nameMatch ? 'YES' : 'NO'],
                ['Account Match', bankVerification.accountMatch ? 'YES' : 'NO'],
              ] as [string, any][]
            ).map(([label, value]) => (
              <View key={label} style={styles.kv}>
                <Text style={styles.rowMeta}>{label}</Text>
                <Text style={styles.kvValue}>{String(value ?? '—')}</Text>
              </View>
            ))}
          </View>
        )}

        <SectionTitle
          action={
            sender ? (
              <Pressable
                onPress={() => setShowAddBene(!showAddBene)}
                hitSlop={12}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel={showAddBene ? 'Cancel adding beneficiary' : 'Add New'}
              >
                <Ionicons name={showAddBene ? 'close' : 'add'} size={18} color={colors.foreground} />
                <Text style={styles.linkText}>{showAddBene ? 'Cancel' : 'Add New'}</Text>
              </Pressable>
            ) : undefined
          }
        >
          Saved Beneficiaries
        </SectionTitle>
        {!!sendOtp.error && <ErrorBanner message={sendOtp.error} />}
        {!!notice && <SuccessBanner message={notice} />}

        {showAddBene && (
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Add Beneficiary
            </Text>
            <Text style={[styles.senderMeta, { marginTop: -space.md, marginBottom: space.md }]}>
              For sender +91 {sender} · ₹4 account verification from Utility Wallet
            </Text>
            <View style={styles.form}>
              <Input label="Account Holder Name" value={beneName} onChangeText={setBeneName} />
              <Input
                label="Account Number"
                value={beneAccount}
                onChangeText={(v) => setBeneAccount(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
              <Input
                label="Confirm Account Number"
                value={confirmAccount}
                onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                error={
                  confirmAccount && confirmAccount !== beneAccount ? 'Account numbers do not match' : undefined
                }
              />
              {!!confirmAccount && confirmAccount === beneAccount && (
                <Text style={styles.match}>Account numbers match</Text>
              )}
              <Input
                label="IFSC Code"
                value={beneIfsc}
                onChangeText={(v) => setBeneIfsc(v.toUpperCase())}
                autoCapitalize="characters"
              />
              {!!addBene.error && <ErrorBanner message={addBene.error} />}
              <Button
                onPress={async () => {
                  const res = await addBene.run();
                  if (!res) return;
                  setNotice(res.message || 'Beneficiary added');
                  setBeneName('');
                  setBeneAccount('');
                  setConfirmAccount('');
                  setBeneIfsc('');
                  setShowAddBene(false);
                  await loadBeneficiaries(sender).catch(() => undefined);
                  // It is not payable until it is verified, so the OTP is asked
                  // for now rather than left for the retailer to find later.
                  if (res.data?.id) startOtp({ ...res.data, id: String(res.data.id) }, 'verify');
                }}
                loading={addBene.pending}
                fullWidth
              >
                {addBene.pending ? 'Adding...' : 'Add Beneficiary'}
              </Button>
            </View>
          </View>
        )}

        {/* OTP — activation or deletion */}
        {!!otpFor && (
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {otpFor.action === 'verify' ? 'Verify Beneficiary' : 'Confirm Deletion'}
            </Text>
            <View style={styles.form}>
              <Banner
                tone="info"
                message={`Enter the OTP sent to +91 ${sender} to ${
                  otpFor.action === 'verify' ? 'activate' : 'delete'
                } ${otpFor.bene.name}.`}
              />
              <Input
                label="OTP"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              {!!submitOtp.error && <ErrorBanner message={submitOtp.error} />}
              <Button
                variant={otpFor.action === 'delete' ? 'destructive' : undefined}
                onPress={async () => {
                  const res = await submitOtp.run();
                  if (!res) return;
                  setNotice(
                    res.message || (otpFor.action === 'verify' ? 'Beneficiary verified' : 'Beneficiary deleted')
                  );
                  setOtpFor(null);
                  setOtp('');
                  loadBeneficiaries(sender).catch(() => undefined);
                }}
                loading={submitOtp.pending}
                disabled={otp.length !== 6}
                fullWidth
              >
                {submitOtp.pending ? 'Processing...' : otpFor.action === 'verify' ? 'Verify' : 'Delete Beneficiary'}
              </Button>
              <View style={styles.otpActions}>
                <View style={styles.flex}>
                  <Button
                    variant="outline"
                    onPress={() => {
                      setOtpFor(null);
                      setOtp('');
                    }}
                    fullWidth
                  >
                    Cancel
                  </Button>
                </View>
                <View style={styles.flex}>
                  <Button
                    variant="outline"
                    onPress={() => startOtp(otpFor.bene, otpFor.action)}
                    loading={sendOtp.pending}
                    fullWidth
                  >
                    Resend OTP
                  </Button>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* BHIM's contact list: avatar, name, account, action. */}
        <View>
          {beneficiaries.length ? (
            beneficiaries.map((b) => (
              <View key={b.id} style={styles.beneRow}>
                <Pressable
                  onPress={() => (b.verified ? openBene(b) : startOtp(b, 'verify'))}
                  style={({ pressed }) => [styles.beneMain, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.name}, account ${b.account}, ${
                    b.verified ? 'verified, Transfer Now' : 'unverified, Verify with OTP'
                  }`}
                >
                  <Initials name={b.name} size={52} fontSize={17} />
                  <View style={styles.flex}>
                    <Text style={styles.beneName} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.beneMeta} numberOfLines={1}>
                      {b.bank || 'Bank'}
                      {b.branch ? ` · ${b.branch}` : ''}
                    </Text>
                    <Text style={styles.beneMeta} numberOfLines={1}>
                      {b.account} · {b.ifsc}
                    </Text>
                  </View>
                  {b.verified ? (
                    <Text style={styles.verified}>Transfer Now</Text>
                  ) : (
                    <Text style={styles.verify}>Verify with OTP</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => startOtp(b, 'delete')}
                  hitSlop={10}
                  style={({ pressed }) => [styles.trash, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete Beneficiary ${b.name}`}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))
          ) : sender ? (
            <>
              <EmptyState
                icon="account-off-outline"
                title="No beneficiaries yet"
                subtitle="Add a bank account to start transferring money instantly."
              />
              {!showAddBene && (
                <Button onPress={() => setShowAddBene(true)} fullWidth>
                  Add Beneficiary
                </Button>
              )}
            </>
          ) : (
            <EmptyState
              icon="send-outline"
              title="Ready to transfer"
              subtitle="Enter the sender's mobile number above to see their saved beneficiaries and send money."
            />
          )}
        </View>
      </Screen>

      {!!selected && (
        <PayFlow
          step={step}
          setStep={(s) => {
            transfer.setError(null);
            setStep(s);
          }}
          payeeName={selected.name}
          payeeMeta={`${selected.account} · ${selected.ifsc}`}
          amount={amount}
          setAmount={setAmount}
          mode={mode}
          setMode={setMode}
          modes={MODES}
          available={available}
          blocked={selected.verified ? undefined : 'Verify this beneficiary with the OTP before sending money.'}
          pin={pin}
          setPin={setPin}
          pending={transfer.pending}
          error={transfer.error}
          onSubmit={async () => {
            const res = await transfer.run();
            if (!res) return false;
            // A transfer is accepted before the beneficiary bank confirms it,
            // so the wording must not claim it has landed.
            const settled = !res.pending;
            setReceipt({
              settled,
              heading: settled ? 'Transfer Successful' : 'Transfer Pending',
              amount: rupees(amount),
              rows: [
                { label: 'To', value: selected.name },
                { label: 'Account', value: selected.account },
                {
                  label: 'Ref No',
                  value: res.data?.rrn || res.data?.txnid || res.data?.transactionId,
                  dashBefore: true,
                },
                {
                  label: 'Status',
                  value:
                    res.message || (settled ? 'Your money is on its way!' : 'The bank has not confirmed it yet.'),
                },
              ],
            });
            setPin('');
            balances.reload();
            setStep('done');
            return true;
          }}
          receipt={receipt}
          onDone={() => {
            setStep(null);
            setReceipt(null);
            setAmount('');
            setPin('');
          }}
        />
      )}
    </>
  );
};

const styles = themed((c) => ({
  flex: { flex: 1, minWidth: 0 },
  form: { gap: space.lg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontWeight: '500' },

  // Sender — a plain card, no band.
  senderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  senderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: { fontSize: t.bodyLg, fontWeight: '400', color: c.foreground, fontVariant: ['tabular-nums'] },
  senderMeta: { fontSize: t.small, color: c.mutedForeground, marginTop: 2 },
  senderInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 16,
    color: c.foreground,
    outlineStyle: 'none',
  } as any,
  pill: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: t.body, color: c.foreground },
  findPill: { backgroundColor: c.primary, paddingHorizontal: space.xl },
  findText: { color: c.primaryForeground, fontWeight: '500' },

  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  linkText: { fontSize: t.small, fontWeight: '500', color: c.foreground },

  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginBottom: space.lg },
  otpActions: { flexDirection: 'row', gap: space.md },

  beneRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md, minHeight: 64 },
  beneMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.lg },
  trash: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  verified: { fontSize: t.small, fontWeight: '500', color: c.success },
  match: { fontSize: t.small, fontWeight: '500', color: c.success, marginTop: -space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md },
  kv: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  kvValue: { fontSize: t.body, color: c.foreground, fontWeight: '500' },
  beneName: { fontSize: t.bodyLg, fontWeight: '400', color: c.foreground },
  beneMeta: { fontSize: t.body - 1, color: c.mutedForeground, marginTop: 3, fontVariant: ['tabular-nums'] },
  verify: { fontSize: t.small, fontWeight: '500', color: c.warning },

  rowMeta: { fontSize: t.caption, color: c.mutedForeground, marginTop: 3 },

  // Amount step — BHIM's: payee, huge light amount, words, note pills, keypad.
  flowRoot: { flex: 1, backgroundColor: c.background },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm },
  topIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -10 },
  amountBody: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
  paying: { marginTop: space.md, fontSize: t.bodyLg, color: c.foreground },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
  },
  idChipText: { flexShrink: 1, fontSize: t.small, color: c.foreground },
  bigamt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.xxl },
  cur: { fontSize: 44, fontWeight: '300', color: c.foreground },
  amt: { fontSize: 60, fontWeight: '300', letterSpacing: -1, color: c.foreground, fontVariant: ['tabular-nums'] },
  amtEmpty: { color: c.mutedForeground },
  words: { marginTop: space.xs, fontSize: t.body, color: c.mutedForeground, textAlign: 'center' },
  amountError: { marginTop: space.xs, fontSize: t.small, color: c.destructive, textAlign: 'center' },
  notes: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  note: {
    minHeight: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteOn: { borderColor: c.foreground },
  noteText: { fontSize: t.body, color: c.mutedForeground },
  noteTextOn: { color: c.foreground },
  debit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  debitLabel: { fontSize: t.small, color: c.mutedForeground },
  debitRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  debitValue: { fontSize: t.small, color: c.foreground, fontVariant: ['tabular-nums'] },
  sendWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  // Blinking-free caret: a thin bar beside the amount while typing.
  caret: { width: 2, height: 46, marginLeft: 4, backgroundColor: c.highlight, alignSelf: 'center' },
}));

export default DmtScreen;
