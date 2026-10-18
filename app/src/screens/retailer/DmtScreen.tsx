import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, TextInput, Modal, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { useModalInsets } from '@/hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t, Tone } from '../../theme/colors';
import { toneFor, IconTile } from '@/components/ui/Gradient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TopGlow } from '@/components/ui/TopGlow';
import { Screen, Banner, EmptyState, ErrorBanner, SectionTitle, SuccessBanner, money, shortDate , SkeletonRows } from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { DoneBody, Keypad, PayReceipt, PinBody, StatusText } from './RechargeScreen';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The wallet PIN is exactly four digits (backend wallet.controller setPin). */
export const PIN_LENGTH = 4;

export const MODES = [
  { key: 'IMPS', label: 'IMPS · instant' },
  { key: 'NEFT', label: 'NEFT' },
];

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
  const canSend = Number(p.amount) > 0 && !overBalance && !p.blocked;

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
          detail={`${p.mode} · from Main wallet`}
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
            {overBalance || p.blocked ? (
              <Text style={styles.amountError} accessibilityLiveRegion="polite">
                {overBalance ? 'Amount exceeds your main wallet balance' : p.blocked}
              </Text>
            ) : (
              <Text style={styles.words}>{words || (keypadOpen ? 'Enter amount' : 'Tap the amount to enter it')}</Text>
            )}
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
              <Text style={styles.debitValue}>Main wallet · {money(p.available)}</Text>
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

const lastDigits = (account: string) => String(account).slice(-4);

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
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [step, setStep] = useState<PayStep>(null);
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('IMPS');
  const [pin, setPin] = useState('');
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
  const ifscValid = IFSC_RE.test(beneIfsc.trim().toUpperCase());
  const beneValid =
    beneName.trim().length > 2 &&
    beneAccount.trim().length >= 6 &&
    beneAccount === confirmAccount &&
    ifscValid;

  const q = search.trim().toLowerCase();
  const shown = q
    ? beneficiaries.filter((b) =>
        [b.name, b.account, b.bank, b.ifsc].some((v) => String(v ?? '').toLowerCase().includes(q))
      )
    : beneficiaries;

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
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setStep(null);
            startOtp(b, 'delete');
          },
        },
      ]
    );

  const openBene = (b: Beneficiary) => {
    // An unverified beneficiary cannot be paid, so tapping it asks for the OTP.
    if (!b.verified) {
      startOtp(b, 'verify');
      return;
    }
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
    setSearch('');
    setShowAddBene(false);
    setOtpFor(null);
  };

  return (
    <>
      <Screen
        refreshing={history.refreshing}
        onRefresh={() => {
          history.refresh();
          balances.refresh();
        }}
        error={history.error}
        onRetry={history.reload}
      >
        {/* The sender: who the beneficiaries below belong to. */}
        <View style={styles.senderCard}>
          <View style={styles.senderAvatar}>
            <Ionicons name="person-outline" size={22} color={colors.foreground} />
          </View>
          {sender ? (
            <>
              <View style={styles.flex}>
                <Text style={styles.senderName} numberOfLines={1}>
                  +91 {sender.slice(0, 5)} {sender.slice(5)}
                </Text>
                <Text style={styles.senderMeta} numberOfLines={1}>
                  Sender · {beneficiaries.length} beneficiar{beneficiaries.length === 1 ? 'y' : 'ies'}
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
              <TextInput
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                autoComplete="tel"
                placeholder="Sender mobile number"
                placeholderTextColor={colors.mutedForeground}
                style={styles.senderInput}
                accessibilityLabel="Customer mobile number"
                onSubmitEditing={() => mobile.length === 10 && lookup.run()}
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
                accessibilityLabel="Find beneficiaries"
              >
                <Text style={[styles.pillText, styles.findText]}>{lookup.pending ? '…' : 'Find'}</Text>
              </Pressable>
            </>
          )}
        </View>
        {!!lookup.error && <ErrorBanner message={lookup.error} />}

        {!!sender && (
          <View style={styles.search}>
            <Ionicons name="search-outline" size={22} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or account"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
              accessibilityLabel="Search name or account"
            />
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
                accessibilityLabel={showAddBene ? 'Cancel adding beneficiary' : 'Add new beneficiary'}
              >
                <Ionicons name={showAddBene ? 'close' : 'add'} size={18} color={colors.foreground} />
                <Text style={styles.linkText}>{showAddBene ? 'Cancel' : 'Add new'}</Text>
              </Pressable>
            ) : undefined
          }
        >
          Beneficiaries
        </SectionTitle>
        {!!sendOtp.error && <ErrorBanner message={sendOtp.error} />}
        {!!notice && <SuccessBanner message={notice} />}

        {showAddBene && (
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              New beneficiary
            </Text>
            <View style={styles.form}>
              <Input label="Beneficiary name" required value={beneName} onChangeText={setBeneName} />
              <Input
                label="Account number"
                required
                value={beneAccount}
                onChangeText={(v) => setBeneAccount(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
              <Input
                label="Confirm account number"
                required
                value={confirmAccount}
                onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                error={
                  confirmAccount && confirmAccount !== beneAccount ? 'Account numbers do not match' : undefined
                }
              />
              <Input
                label="IFSC code"
                required
                value={beneIfsc}
                onChangeText={setBeneIfsc}
                autoCapitalize="characters"
                maxLength={11}
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
                  const added = res.data?.id ? list.find((b) => b.id === String(res.data.id)) : undefined;
                  if (added) startOtp(added, 'verify');
                }}
                loading={addBene.pending}
                disabled={!beneValid}
                fullWidth
              >
                Save beneficiary
              </Button>
            </View>
          </View>
        )}

        {/* OTP — activation or deletion */}
        {!!otpFor && (
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {otpFor.action === 'verify' ? 'Verify beneficiary' : 'Confirm removal'}
            </Text>
            <View style={styles.form}>
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
              />
              {!!submitOtp.error && <ErrorBanner message={submitOtp.error} />}
              <Button
                onPress={async () => {
                  const res = await submitOtp.run();
                  if (!res) return;
                  setNotice(
                    res.message || (otpFor.action === 'verify' ? 'Beneficiary verified.' : 'Beneficiary removed.')
                  );
                  setOtpFor(null);
                  setOtp('');
                  loadBeneficiaries(sender);
                }}
                loading={submitOtp.pending}
                disabled={otp.length !== 6}
                fullWidth
              >
                {otpFor.action === 'verify' ? 'Verify' : 'Remove beneficiary'}
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

        {/* BHIM's contact list: avatar, name, number, arrow. */}
        <View>
          {shown.length ? (
            shown.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => openBene(b)}
                style={({ pressed }) => [styles.beneRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${b.name}, account ending ${lastDigits(b.account)}${
                  b.verified ? '' : ', not verified, tap to verify'
                }`}
              >
                <Initials name={b.name} size={52} fontSize={17} />
                <View style={styles.flex}>
                  <Text style={styles.beneName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.beneMeta} numberOfLines={1}>
                    {b.bank ? `${b.bank} · ` : ''}••• {lastDigits(b.account)}
                  </Text>
                </View>
                {b.verified ? (
                  <Ionicons name="arrow-forward" size={20} color={colors.foreground} />
                ) : (
                  <Text style={styles.verify}>Verify</Text>
                )}
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon={sender ? 'account-off-outline' : 'cellphone'}
              title={sender ? (q ? 'No match' : 'No beneficiaries yet') : 'Enter the sender’s mobile'}
              subtitle={
                sender
                  ? q
                    ? 'Try another name or account number'
                    : 'Add the account this customer wants to send money to'
                  : 'Their saved beneficiaries will show here'
              }
            />
          )}
        </View>

        <SectionTitle>Transfer history</SectionTitle>
        {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
        <View style={styles.list}>
          {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any, i: number, all: any[]) => (
              <View key={txn._id || txn.transactionId} style={[styles.row, i === all.length - 1 && styles.rowLast]}>
                <IconTile icon="bank-transfer" size={44} iconSize={20} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {txn.metadata?.beneficiaryName || `A/c ••• ${lastDigits(txn.beneficiaryAccount ?? '')}`}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[shortDate(txn.createdAt), txn.apiReference || txn.transactionId].filter(Boolean).join(' · ')}
                  </Text>
                  {(txn.status === 'PENDING' || txn.status === 'PROCESSING') && (
                    <Pressable
                      disabled={checkStatus.pending}
                      hitSlop={12}
                      accessibilityRole="button"
                      onPress={async () => {
                        const data = await checkStatus.run(txn.transactionId);
                        if (!data) return;
                        setNotice(`Transfer ${String(data.status).toLowerCase()}.`);
                        history.reload();
                        balances.reload();
                      }}
                    >
                      <Text style={styles.rowLink}>{checkStatus.pending ? 'Checking…' : 'Check status'}</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>{money(txn.amount)}</Text>
                  <StatusText status={txn.status} />
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="send-outline" title="No transfers yet" />
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
          payeeMeta={[selected.bank, `••• ${lastDigits(selected.account)}`, selected.ifsc]
            .filter(Boolean)
            .join(' · ')}
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
          onMore={() => confirmRemoveBene(selected)}
          onSubmit={async () => {
            const res = await transfer.run();
            if (!res) return false;
            // A transfer is accepted before the beneficiary bank confirms it,
            // so the wording must not claim it has landed.
            const settled = !res.pending;
            setReceipt({
              settled,
              heading: settled ? 'Money sent successfully' : 'Transfer accepted, being processed',
              amount: rupees(amount),
              rows: [
                { label: 'To', value: selected.name },
                {
                  label: 'Account',
                  value: `${selected.bank ? `${selected.bank} ` : ''}·· ${lastDigits(selected.account)}`,
                },
                { label: 'Mode', value: mode },
                { label: 'Bank ref (UTR)', value: res.data?.rrn, dashBefore: true },
                { label: 'Transaction ID', value: res.data?.transactionId, dashBefore: !res.data?.rrn },
                { label: 'Status', value: settled ? null : res.message },
              ],
            });
            setPin('');
            balances.reload();
            history.reload();
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

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: t.body, color: c.foreground, paddingVertical: space.sm, outlineStyle: 'none' } as any,
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  linkText: { fontSize: t.small, fontWeight: '500', color: c.foreground },

  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginBottom: space.lg },
  otpActions: { flexDirection: 'row', gap: space.md },

  beneRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md, minHeight: 64 },
  beneName: { fontSize: t.bodyLg, fontWeight: '400', color: c.foreground },
  beneMeta: { fontSize: t.body - 1, color: c.mutedForeground, marginTop: 3, fontVariant: ['tabular-nums'] },
  verify: { fontSize: t.small, fontWeight: '500', color: c.warning },

  list: { paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  rowMeta: { fontSize: t.caption, color: c.mutedForeground, marginTop: 3 },
  rowLink: { fontSize: t.caption, fontWeight: '500', color: c.foreground, textDecorationLine: 'underline', marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowAmount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },

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
