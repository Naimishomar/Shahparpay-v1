import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { IconTile } from '@/components/ui/Gradient';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  SkeletonGrid,
  SkeletonField,
} from '@/components/ui/Screen';
import {
  ActionButton,
  bankInitials,
  CaptureStep,
  DevicePicker,
  useBiometricDevice,
} from '@/components/aeps/BiometricCapture';
import { DEVICE_LABELS, isCaptureSupported } from '@/services/rdService';
import { TransactionReceipt, type ReceiptData } from '@/components/aeps/TransactionReceipt';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { AEPS_OTP_THRESHOLD, AEPS_MAX_WITHDRAWAL } from '@/constants';
import api from '@/services/api';
import {
  IcchhamatiOnboardingSheet,
  providerDeviceName,
  type IcchStatus,
} from '@/components/aeps/IcchhamatiOnboardingSheet';

type ServiceKey = 'balance' | 'statement' | 'withdrawal' | 'deposit' | 'aadhaarpay';

interface ServiceSpec {
  key: ServiceKey;
  label: string;
  /** Chip label and capture-step verb, as the mockup words them. */
  short: string;
  icon: string;
  /** Amount field shown and required. */
  amount: boolean;
  /** Customer mobile required by the bank for this call. */
  mobile: boolean;
}

const SERVICES: ServiceSpec[] = [
  {
    key: 'balance',
    label: 'Balance Enquiry',
    short: 'Balance',
    icon: 'bank-outline',
    amount: false,
    mobile: false,
  },
  {
    key: 'withdrawal',
    label: 'Cash Withdrawal',
    short: 'Withdraw',
    icon: 'cash-multiple',
    amount: true,
    mobile: true,
  },
  {
    key: 'statement',
    label: 'Mini Statement',
    short: 'Mini statement',
    icon: 'text-box-outline',
    amount: false,
    mobile: true,
  },
  {
    key: 'aadhaarpay',
    label: 'Aadhaar Pay',
    short: 'Aadhaar pay',
    icon: 'store-outline',
    amount: true,
    mobile: true,
  },
  {
    key: 'deposit',
    label: 'Cash Deposit',
    short: 'Deposit',
    icon: 'wallet-plus-outline',
    amount: true,
    mobile: true,
  },
];

/** Labels and placeholders as Icchhamati's web page words them. */
const COPY = {
  aadhaar: ['Customer Aadhaar', '12-digit Aadhaar'],
  mobile: ['Customer mobile', '10-digit mobile'],
  bank: ['Bank', 'Select bank'],
  amount: 'Up to ₹10,000',
} as const;

/** "₹ 3,000" — whole rupees with Indian grouping, as on the titles. */
const rupees = (value: number) => `₹\u00A0${value.toLocaleString('en-IN')}`;

/** Groups characters with a space every `size`: "98100 22334", "XXXX XXXX 4410". */
const group = (value: string, size: number) =>
  value.replace(new RegExp(`(.{${size}})(?=.)`, 'g'), '$1 ');

/** Hidden Aadhaar shows only the last four, the way the bank prints it. */
const aadhaarDisplay = (digits: string, show: boolean) =>
  group(show ? digits : digits.replace(/\d(?=\d{4})/g, 'X'), 4);

/** Maps an edit of the masked text back to digits: each X keeps the digit it hid. */
const aadhaarFromDisplay = (text: string, digits: string) =>
  text
    .replace(/\s/g, '')
    .split('')
    .map((ch, i) => (/x/i.test(ch) ? digits[i] ?? '' : ch))
    .join('')
    .replace(/\D/g, '')
    .slice(0, 12);

/** "3000.5" → "3,000.5" for display; the state keeps the raw number. */
const amountDisplay = (raw: string) => {
  if (!raw) return '';
  const [whole, decimals] = raw.split('.');
  const grouped = whole ? Number(whole).toLocaleString('en-IN') : '0';
  return `₹\u00A0${grouped}${decimals !== undefined ? `.${decimals}` : ''}`;
};

interface Bank {
  iin?: string | number;
  iinno?: string | number;
  bank_iin?: string | number;
  name?: string;
  bankName?: string;
  bank_name?: string;
}

// The bank list is passed through raw and its field names vary. Normalise once here.
const bankName = (bank: Bank) => String(bank.bankName || bank.name || bank.bank_name || '').trim();
const bankIin = (bank: Bank) => String(bank.iinno ?? bank.bank_iin ?? bank.iin ?? '').trim();

const POPULAR = [
  'state bank',
  'bank of baroda',
  'punjab national',
  'hdfc',
  'icici',
  'union bank',
  'axis bank',
  'canara',
  'bank of india',
  'central bank',
];

/**
 * Fingpay's mini statement rows, in the receipt's shape. Field names are not
 * documented, so the usual spellings are tried.
 */
const icchStatement = (rows: any) =>
  Array.isArray(rows)
    ? rows.map((r: any) => ({
        date: r.date ?? r.txnDate,
        narration: r.narration ?? r.remarks,
        amount: r.amount,
        txnType: r.txnType ?? r.debitCredit,
      }))
    : undefined;

/** Icchhamati's references, labelled as the web receipt labels them. */
const icchRefs = (data: any) => ({
  rrn: data?.bankRRN,
  txnId: data?.fpTransactionId,
  reference: data?.referenceNo,
});

/** Balance sits under a different key per pipe and per service. */
const readBalance = (data: any) =>
  data?.balanceamount ??
  data?.balanceAmount ??
  data?.balance ??
  data?.data?.balanceamount ??
  data?.data?.balanceAmount ??
  data?.data?.balance;

export const AepsScreen: React.FC = () => {
  const { user } = useAuth();
  const { device, setDevice } = useBiometricDevice();

  const [service, setService] = useState<ServiceKey>('balance');

  const [mobileNumber, setMobileNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [bank, setBank] = useState<Bank | null>(null);
  const [showBanks, setShowBanks] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
  const [showDevices, setShowDevices] = useState(false);
  // Set when Scan is pressed on an incomplete form: the blocker shows by the button.
  const [attempted, setAttempted] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [amount, setAmount] = useState('');
  const [pidData, setPidData] = useState<string | null>(null);

  // AEPS transaction OTP — withdrawals and Aadhaar Pay above ₹5,000 only.
  const [otp, setOtp] = useState('');
  const [otpRefId, setOtpRefId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  // Icchhamati ties transactions to a registered scanner serial, as on the web.
  const [serial, setSerial] = useState('');

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const [onboarding, setOnboarding] = useState<null | 'AEPS' | 'AP'>(null);
  // Fingpay refused with "Device Changed Please do 2fa" (FP069) while
  // Icchhamati's status still reads ready; only a fresh 2FA clears it.
  const [redo2fa, setRedo2fa] = useState(false);

  const status = useAsync<any>(async () => {
    const response = await api.icchAepsStatus();
    if (!response?.success) throw new Error(response?.message || 'Could not load AEPS status.');
    return response.data;
  }, []);
  const banks = useAsync<Bank[]>(async () => (await api.icchAepsBanks()).data ?? [], []);

  const icchStatus: IcchStatus | null = status.data?.step ? status.data : null;

  // Prefill the scanner the provider has on record, as the web does.
  useEffect(() => {
    if (!icchStatus) return;
    if (icchStatus.deviceIMEI) setSerial((s) => s || String(icchStatus.deviceIMEI));
    const known = (['mantra', 'morpho', 'startek'] as const).find((b) =>
      String(icchStatus.deviceName || '').toLowerCase().includes(b)
    );
    if (known) setDevice(known);
  }, [icchStatus?.deviceIMEI, icchStatus?.deviceName]);

  const spec = SERVICES.find((s) => s.key === service)!;
  // Icchhamati rejects every call, balance enquiry included, without the customer's mobile.
  const mobileField = (
    <Input
      label={COPY.mobile[0]}
      value={group(mobileNumber, 5)}
      onChangeText={(v) => {
        setMobileNumber(v.replace(/\D/g, '').slice(0, 10));
        if (otpSent) invalidateOtp();
      }}
      keyboardType="number-pad"
      autoComplete="tel"
      placeholder={COPY.mobile[1]}
      containerStyle={styles.field}
    />
  );
  const amountValue = Number(amount) || 0;
  // Withdrawals and Aadhaar Pay above the threshold need the customer's OTP.
  const needsOtp: boolean = (service === 'withdrawal' || service === 'aadhaarpay') && amountValue > AEPS_OTP_THRESHOLD;

  /** Any change to what the OTP was issued against invalidates it. */
  const invalidateOtp = () => {
    setOtp('');
    setOtpRefId('');
    setOtpSent(false);
  };

  const changeService = (next: ServiceKey) => {
    setService(next);
    setPidData(null);
    invalidateOtp();
  };

  const changeAmount = (next: string) => {
    if (otpSent) invalidateOtp();
    setPidData(null);
    setAmount(next);
  };

  const resetForm = () => {
    setMobileNumber('');
    setAadhaarNumber('');
    setBank(null);
    setAmount('');
    setPidData(null);
    invalidateOtp();
  };

  /** The web's validate() for Icchhamati, in its order and words. */
  const icchInvalid = () =>
    !/^\d{12}$/.test(aadhaarNumber)
      ? 'Aadhaar number must be 12 digits.'
      : !/^[6-9]\d{9}$/.test(mobileNumber)
        ? 'Enter the customer’s 10-digit mobile number.'
        : !bank
          ? 'Select the customer’s bank.'
          : spec.amount && !(amountValue >= 1 && amountValue <= AEPS_MAX_WITHDRAWAL)
            ? 'Amount must be between ₹1 and ₹10,000.'
            : null;

  const sortedBanks = useMemo(() => {
    // The list can carry duplicates — the same IIN more than once, sometimes
    // with different spellings of the name. Two entries with the same IIN produce byte-identical transactions, so collapsing
    // them loses nothing and stops the retailer picking between two rows that
    // look the same. Falls back to the name when a row has no IIN.
    const unique = new Map<string, Bank>();
    for (const bank of banks.data ?? []) {
      const iin = bankIin(bank);
      const key = iin || bankName(bank).toLowerCase();
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, bank);
    }

    const rank = (b: Bank) => {
      const name = bankName(b).toLowerCase();
      const index = POPULAR.findIndex((p) => name.includes(p));
      return index === -1 ? POPULAR.length : index;
    };
    return [...unique.values()].sort(
      (a, b) => rank(a) - rank(b) || bankName(a).localeCompare(bankName(b))
    );
  }, [banks.data]);

  const filteredBanks = useMemo(() => {
    const query = bankQuery.trim().toLowerCase();
    if (!query) return sortedBanks;
    return sortedBanks.filter((b) => bankName(b).toLowerCase().includes(query));
  }, [sortedBanks, bankQuery]);

  // Ordered so the retailer is shown the first thing actually blocking them.
  // Icchhamati refuses every service, enquiries included, until onboarded and logged in today.
  const icchBlocker = !icchStatus
    ? 'AEPS status could not be loaded. Pull down to retry.'
    : redo2fa
      ? 'Scanner changed. Do the daily login again with this scanner to continue.'
      : icchStatus.step === 'twofa'
      ? 'Daily login is pending. Authenticate once to unlock transactions for today.'
      : icchStatus.step !== 'ready'
        ? 'Complete AEPS onboarding before serving customers.'
        : service === 'aadhaarpay' && icchStatus.aadhaarPayReady === false
          ? 'Aadhaar Pay needs its own daily login.'
          : null;
  const missingField =
    icchInvalid() ||
    (needsOtp && (!otpRefId || otp.length < 4) ? 'Enter the OTP the customer received.' : null) ||
    (!serial ? 'Enter the scanner serial number.' : null);

  const captureBlocker =
    icchBlocker ||
    missingField ||
    (isCaptureSupported ? null : 'Fingerprint capture needs the Android app or the web portal with a scanner.');

  const sendOtp = useAction(async () => {
    const problem = icchInvalid();
    if (problem) throw new Error(problem);
    const response = await api.icchAepsTxnOtp(icchPayload());
    if (!response?.success || !response.data?.txnOtpRequestId) throw new Error(response?.message || 'Could not send the OTP');
    setOtpRefId(response.data.txnOtpRequestId);
    setOtpSent(true);
    setOtp('');
    setPidData(null);
    return response;
  });

  /** Icchhamati's doAeps shape; the backend fills the outlet and scanner serial. */
  const icchPayload = () => ({
    aepsType: ({ withdrawal: 'CW', balance: 'BE', statement: 'MS', aadhaarpay: 'M', deposit: 'CD' } as const)[service as 'withdrawal'],
    aadhaarNumber,
    customerMobile: mobileNumber,
    bankID: bankIin(bank!),
    bankName: bankName(bank!),
    amount: spec.amount ? amountValue : undefined,
  });

  const submit = useAction(async () => {
    const base = {
      service: spec.label,
      customerMobile: mobileNumber,
      aadhaarNumber,
      bankName: bankName(bank!),
      agentName: user?.name,
      agentMobile: user?.contactNumber,
      // "13 Oct 2026, 10:15 AM", as on the receipt mockup.
      dateTime: new Date()
        .toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase()),
      amount: spec.amount ? amountValue : undefined,
    };

    // The provider ties the transaction to the registered scanner; register it when it changed.
    if (serial !== icchStatus?.deviceIMEI || providerDeviceName(device) !== icchStatus?.deviceName) {
      const registered = await api.icchAepsStep('device', { deviceIMEI: serial, deviceName: providerDeviceName(device) });
      if (!registered?.success) throw new Error(registered?.message || 'Request failed');
      status.setData({ ...icchStatus, deviceIMEI: serial, deviceName: providerDeviceName(device) });
    }

    let response: any;
    try {
      response = await api.icchAepsTransaction({
        ...icchPayload(),
        xml: pidData,
        deviceType: providerDeviceName(device),
        ...(needsOtp ? { otp, txnOtpRequestId: otpRefId } : {}),
      });
    } catch (err: any) {
      const body = err?.response?.data;
      setReceipt({
        ...base,
        status: 'FAILED',
        ...icchRefs(body?.data),
        message: body?.message || 'The bank declined this transaction. Please try again.',
      });
      // Swallowed on purpose: the receipt sheet is the error surface here, and
      // a duplicate inline banner would report the same failure twice.
      return null;
    } finally {
      // A used PID block is never valid twice, whatever the outcome.
      setPidData(null);
    }

    // Icchhamati could not confirm either way: the customer may have been
    // debited, so this is not a failure and must not be retried.
    if (response?.data?.verification === 'PENDING') {
      setReceipt({ ...base, ...icchRefs(response.data), status: 'PENDING', message: response.message });
      // The web keeps the customer's details after any outcome; only the OTP is spent.
      invalidateOtp();
      return null;
    }

    if (!response?.success && /\b2fa\b/i.test(String(response?.message ?? ''))) setRedo2fa(true);
    setReceipt({
      ...base,
      ...icchRefs(response?.data),
      status: response?.success ? 'SUCCESS' : 'FAILED',
      message: response?.message,
      balanceAmount: response?.success ? readBalance(response.data) : undefined,
      miniStatement: response?.success ? icchStatement(response.data?.miniStatementStructureModel) : undefined,
    });
    invalidateOtp();
    // After money has moved the customer's details are cleared, so the same
    // withdrawal cannot be sent twice by accident; enquiries keep them.
    if (response?.success && service !== 'balance' && service !== 'statement') resetForm();
    if (response?.success) status.refresh();
    return response?.success ? response : null;
  });

  // The receipt replaces the capture step whatever the outcome.
  useEffect(() => {
    if (receipt) setCapturing(false);
  }, [receipt]);

  const startScan = () => {
    if (captureBlocker) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    submit.setError(null);
    setCapturing(true);
  };

  const amountLabel = service === 'deposit' ? 'Amount (paid from your Trade Wallet)' : 'Amount';

  const gateNote = !icchBlocker
    ? null
    : !icchStatus
      ? { text: icchBlocker }
      : {
          text: icchBlocker,
          action: redo2fa || icchStatus.step === 'twofa' || icchBlocker.startsWith('Aadhaar Pay') ? 'Authenticate' : 'Continue',
          onPress: () =>
            setOnboarding(
              redo2fa ? (service === 'aadhaarpay' ? 'AP' : 'AEPS') : icchStatus.step === 'ready' ? 'AP' : 'AEPS'
            ),
        };

  return (
    <Screen
      loading={status.loading}
      skeleton={<View style={{ gap: 16 }}><SkeletonGrid count={4} /><SkeletonField /><SkeletonField /><SkeletonField /><SkeletonField /></View>}
      refreshing={status.refreshing || banks.refreshing}
      onRefresh={() => {
        status.refresh();
        banks.refresh();
      }}
      error={status.error}
      onRetry={status.reload}
      contentStyle={styles.content}
      // The scan action is pinned below the scroll, as in the mockup: it
      // stays in reach while the retailer works down the form.
      overlay={
        <View style={styles.footer}>
          {attempted && !!captureBlocker && <Banner tone="warning" message={captureBlocker} />}
          <ActionButton icon="fingerprint" label="Scan fingerprint" onPress={startScan} />
        </View>
      }
    >
      <View>
        {/* BHIM's grey line-icon circles; the selected one gains an orange ring. */}
        <View style={styles.acts} accessibilityRole="radiogroup">
          {SERVICES.map((s) => {
            const active = s.key === service;
            return (
              <Pressable
                key={s.key}
                onPress={() => changeService(s.key)}
                style={({ pressed }) => [styles.act, pressed && { opacity: 0.7 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={s.label}
              >
                <View style={[styles.actRing, active && styles.actRingOn]}>
                  <IconTile icon={s.icon} size={50} iconSize={22} />
                </View>
                <Text style={[styles.actLabel, active && styles.actLabelOn]} numberOfLines={2}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!gateNote && (
          <Note icon="shield-alert-outline" warn action={gateNote.action} onPress={gateNote.onPress} style={styles.gap}>
            {gateNote.text}
          </Note>
        )}

        <Input
          label={COPY.aadhaar[0]}
          value={aadhaarDisplay(aadhaarNumber, showAadhaar)}
          onChangeText={(v) => {
            setAadhaarNumber(aadhaarFromDisplay(v, aadhaarNumber));
            setPidData(null);
            if (otpSent) invalidateOtp();
          }}
          keyboardType="number-pad"
          placeholder={COPY.aadhaar[1]}
          rightIcon={showAadhaar ? 'eye-outline' : 'eye-off-outline'}
          onRightIconPress={() => setShowAadhaar(!showAadhaar)}
          rightIconLabel={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
          containerStyle={styles.field}
        />

        {mobileField}

        <Text style={styles.fieldLabel}>{COPY.bank[0]}</Text>
        <Pressable
          onPress={() => setShowBanks(!showBanks)}
          style={({ pressed }) => [styles.select, showBanks && styles.selectOpen, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={COPY.bank[0]}
          accessibilityValue={{ text: bank ? bankName(bank) : 'Not selected' }}
          accessibilityState={{ expanded: showBanks }}
        >
          {bank ? (
            <View style={styles.logo}>
              <Text style={styles.logoText}>{bankInitials(bankName(bank))}</Text>
            </View>
          ) : (
            <Ionicons name="business-outline" size={20} color={colors.mutedForeground} />
          )}
          <Text style={[styles.selectValue, !bank && styles.selectPlaceholder]} numberOfLines={1}>
            {bank ? bankName(bank) : banks.loading ? 'Loading banks…' : COPY.bank[1]}
          </Text>
          <Ionicons name={showBanks ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
        </Pressable>
        {showBanks && (
          <View style={styles.picker}>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                placeholder="Search bank name"
                placeholderTextColor={colors.mutedForeground}
                value={bankQuery}
                onChangeText={setBankQuery}
                autoCapitalize="none"
                style={styles.searchInput}
                accessibilityLabel="Search bank name"
              />
            </View>
            <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filteredBanks.slice(0, 80).map((b) => {
                const picked = !!bank && bankIin(bank) === bankIin(b) && bankName(bank) === bankName(b);
                return (
                <Pressable
                  key={bankIin(b) || bankName(b).toLowerCase()}
                  onPress={() => {
                    setBank(b);
                    if (otpSent) invalidateOtp();
                    setShowBanks(false);
                    setBankQuery('');
                    setPidData(null);
                  }}
                  style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked }}
                >
                  <View style={styles.logo}>
                    <Text style={styles.logoText}>{bankInitials(bankName(b))}</Text>
                  </View>
                  <View style={styles.pickerInfo}>
                    <Text style={styles.pickerText} numberOfLines={1}>
                      {bankName(b)}
                    </Text>
                    <Text style={styles.pickerIin}>IIN {bankIin(b)}</Text>
                  </View>
                  <Ionicons
                    name={picked ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={picked ? colors.highlight : colors.mutedForeground}
                  />
                </Pressable>
                );
              })}
              {!filteredBanks.length && <Text style={styles.pickerEmpty}>No matching bank</Text>}
            </ScrollView>
          </View>
        )}

        {spec.amount && (
          <Input
            label={amountLabel}
            value={amountDisplay(amount)}
            // Whole rupees, as the web field takes them.
            onChangeText={(v) => changeAmount(v.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
            placeholder={COPY.amount}
            containerStyle={styles.field}
          />
        )}

        {needsOtp && (
          <View style={styles.gap}>
            <Note icon="message-lock-outline" style={styles.gap}>
              {`Above ₹${AEPS_OTP_THRESHOLD.toLocaleString('en-IN')} the customer confirms with an OTP.`}
            </Note>
            {!!sendOtp.error && (
              <View style={styles.gap}>
                <Banner tone="error" message={sendOtp.error} />
              </View>
            )}
            {otpSent && (
              <View style={styles.gap}>
                <Banner tone="success" message="OTP sent to the customer" />
              </View>
            )}
            {!otpSent && (
              <ActionButton
                ghost
                icon="send-outline"
                label="Send OTP to customer"
                onPress={sendOtp.run}
                loading={sendOtp.pending}
              />
            )}
            {otpSent && (
              <Input
                label="Transaction OTP"
                value={otp}
                onChangeText={(v) => {
                  setOtp(v.replace(/\D/g, '').slice(0, 6));
                  setPidData(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="Customer OTP"
                containerStyle={styles.field}
              />
            )}
          </View>
        )}

        <Note
          icon="usb"
          action={showDevices ? 'Done' : 'Change'}
          onPress={() => setShowDevices(!showDevices)}
        >
          {`Device: ${DEVICE_LABELS[device]}`}
        </Note>
        <Input
          label="Scanner serial number"
          value={serial}
          onChangeText={(v) => {
            setSerial(v.trim());
            setPidData(null);
          }}
          autoCapitalize="characters"
          placeholder="Printed under the scanner"
          containerStyle={styles.devices}
        />
        {showDevices && (
          <View style={styles.devices}>
            <DevicePicker
              value={device}
              onChange={(next) => {
                setDevice(next);
                setPidData(null);
                setShowDevices(false);
              }}
            />
          </View>
        )}
      </View>

      <CaptureStep
        visible={capturing}
        title={spec.amount ? `${spec.short} ${rupees(amountValue)}` : spec.label}
        bankName={bank ? bankName(bank) : ''}
        aadhaarNumber={aadhaarNumber}
        device={device}
        options={{ otp: needsOtp && otp.length === 6 ? otp : undefined }}
        pidData={pidData}
        onCaptured={setPidData}
        onClose={() => {
          setCapturing(false);
          setPidData(null);
        }}
        submitLabel={spec.amount ? `${spec.short} ${rupees(amountValue)}` : 'Submit'}
        submitting={submit.pending}
        submitError={submit.error}
        onSubmit={submit.run}
      />
      <IcchhamatiOnboardingSheet
        visible={!!onboarding}
        status={icchStatus}
        serviceType={onboarding ?? 'AEPS'}
        force2fa={redo2fa}
        onClose={() => setOnboarding(null)}
        onChanged={() => {
          setRedo2fa(false);
          status.refresh();
        }}
      />
      <TransactionReceipt data={receipt} onClose={() => setReceipt(null)} />
    </Screen>
  );
};

/** A quiet info card, optionally with one action on the right. */
const Note: React.FC<{
  icon: string;
  children: string;
  action?: string;
  onPress?: () => void;
  /** Tints the icon: something is blocking the retailer. */
  warn?: boolean;
  style?: any;
}> = ({ icon, children, action, onPress, warn, style }) => (
  <View style={[styles.note, style]}>
    <MaterialCommunityIcons name={icon as any} size={18} color={warn ? colors.warning : colors.mutedForeground} />
    <Text style={styles.noteText}>{children}</Text>
    {!!action && (
      <Pressable onPress={onPress} hitSlop={14} accessibilityRole="button" accessibilityLabel={action}>
        <Text style={styles.noteAction}>{action}</Text>
      </Pressable>
    )}
  </View>
);

const styles = themed((c) => ({
  content: { paddingTop: space.md },
  gap: { marginBottom: space.md },
  field: { marginBottom: space.lg },
  acts: { flexDirection: 'row', gap: 4, marginBottom: space.xl },
  act: { flex: 1, alignItems: 'center', gap: space.sm },
  // Same footprint on and off, so selecting never nudges the row.
  actRing: { padding: 3, borderRadius: 30, borderWidth: 1.5, borderColor: 'transparent' },
  actRingOn: { borderColor: c.highlight },
  actLabel: { fontSize: t.caption, lineHeight: 16, color: c.mutedForeground, textAlign: 'center' },
  actLabelOn: { fontWeight: '500', color: c.foreground },
  fieldLabel: { fontSize: t.small, fontWeight: '500', color: c.foreground, marginBottom: 7 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.input,
    backgroundColor: c.surface,
    marginBottom: space.lg,
  },
  selectOpen: { borderColor: c.focus, marginBottom: space.sm },
  selectValue: { flex: 1, fontSize: t.body, color: c.foreground },
  selectPlaceholder: { color: c.mutedForeground },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tileGradient[0],
  },
  logoText: { fontSize: t.caption, fontWeight: '500', color: c.tileForeground },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  noteText: { flex: 1, fontSize: t.small, lineHeight: 19, color: c.mutedForeground },
  noteAction: { fontSize: t.small, fontWeight: '500', color: c.accent },
  devices: { marginTop: space.md },
  // Pinned scan action on the ground colour, BHIM's near-black footer.
  footer: {
    gap: space.sm,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  picker: {
    gap: space.sm,
    padding: space.sm,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: { flex: 1, fontSize: t.small, color: c.foreground, padding: 0, outlineStyle: 'none' } as any,
  pickerList: { maxHeight: 300 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerInfo: { flex: 1, minWidth: 0, gap: 2 },
  pickerText: { fontSize: t.body, color: c.foreground },
  pickerIin: { fontSize: t.caption, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  pickerEmpty: { fontSize: t.small, color: c.mutedForeground, padding: space.md },
}));

export default AepsScreen;
