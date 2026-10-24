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
  EmptyState,
  SectionTitle,
  Segmented,
  money,
  dateTime,
  SkeletonRows,
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
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { DailyAuthSheet } from '@/components/aeps/DailyAuthSheet';
import { TransactionReceipt, StatusText, type ReceiptData } from '@/components/aeps/TransactionReceipt';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { AEPS_OTP_THRESHOLD, AEPS_MAX_WITHDRAWAL } from '@/constants';
import { coordsPayload } from '@/services/location';
import { LocationGate } from '@/components/aeps/LocationGate';
import { useLocationReady } from '@/hooks/useLocationReady';
import api from '@/services/api';
import { aepsProviderOf, usesAepsProvider } from '@/constants/services';
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
  /** Blocked until merchant eKYC + daily 2FA are done. */
  guarded: boolean;
  call: (payload: Record<string, any>) => Promise<any>;
}

const SERVICES: ServiceSpec[] = [
  {
    key: 'withdrawal',
    label: 'Cash withdrawal',
    short: 'Withdraw',
    icon: 'cash-multiple',
    amount: true,
    mobile: true,
    guarded: true,
    call: (payload) => api.aepsCashWithdrawal(payload),
  },
  {
    key: 'balance',
    label: 'Balance enquiry',
    short: 'Balance',
    icon: 'bank-outline',
    amount: false,
    mobile: false,
    guarded: false,
    call: (payload) => api.aepsBalanceEnquiry(payload),
  },
  {
    key: 'statement',
    label: 'Mini statement',
    short: 'Mini statement',
    icon: 'text-box-outline',
    amount: false,
    mobile: true,
    guarded: false,
    call: (payload) => api.aepsMiniStatement(payload),
  },
  {
    key: 'aadhaarpay',
    label: 'Aadhaar Pay',
    short: 'Aadhaar pay',
    icon: 'store-outline',
    amount: true,
    mobile: true,
    guarded: true,
    call: (payload) => api.aepsAadhaarPay(payload),
  },
  {
    key: 'deposit',
    label: 'Cash deposit',
    short: 'Deposit',
    icon: 'wallet-plus-outline',
    amount: true,
    mobile: true,
    guarded: false,
    call: (payload) => api.aepsCashDeposit(payload),
  },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 3000];

/** "₹ 3,000" — whole rupees with Indian grouping, as on the chips and titles. */
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

// PaySprint's bank list is passed through raw, and the field names differ
// between their cached and live responses. Normalise once here.
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

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

/** Amount in words, Indian grouping — a second read on the number the customer hands over. */
const amountInWords = (value: string) => {
  const n = Math.floor(Number(value));
  if (!n || n < 0 || n > 999999999) return '';
  const parts: string[] = [];
  const push = (count: number, unit: string) => {
    if (count) parts.push(`${twoDigits(count)} ${unit}`);
  };
  push(Math.floor(n / 10000000), 'Crore');
  push(Math.floor((n / 100000) % 100), 'Lakh');
  push(Math.floor((n / 1000) % 100), 'Thousand');
  push(Math.floor((n / 100) % 10), 'Hundred');
  const rest = n % 100;
  if (rest) parts.push(twoDigits(rest));
  return `${parts.join(' ')} Rupees only`;
};

/** The most descriptive line PaySprint returned, wherever it nested it. */
const paysprintError = (payload: any) => {
  const raw = payload?.data || payload?.error || {};
  return (
    [
      raw?.statusDescription,
      raw?.statusdescription,
      raw?.message,
      raw?.response_description,
      raw?.errmsg,
      raw?.reason,
      payload?.message,
      typeof payload?.error === 'string' ? payload.error : null,
    ].find((candidate) => typeof candidate === 'string' && candidate.trim()) ||
    'The bank declined this transaction. Please try again.'
  );
};

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

  const [service, setService] = useState<ServiceKey>('withdrawal');
  const [pipe, setPipe] = useState<string | null>(null);

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
  const [consent, setConsent] = useState(false);
  const [pidData, setPidData] = useState<string | null>(null);

  // AEPS transaction OTP — withdrawals above ₹5,000 only.
  const [otp, setOtp] = useState('');
  const [otpRefId, setOtpRefId] = useState('');
  const [otpReference, setOtpReference] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [showKyc, setShowKyc] = useState(false);
  const [kycPipe, setKycPipe] = useState<string | undefined>();
  const [showDailyAuth, setShowDailyAuth] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const merchantcode = user?.retailerId || user?.code;
  // Same screen, two providers. A retailer on both switches between them;
  // each keeps its own onboarding and daily login.
  const onBoth = aepsProviderOf(user) === 'both';
  const [active, setActive] = useState<'paysprint' | 'icchhamati'>('paysprint');
  const icch = onBoth ? active === 'icchhamati' : usesAepsProvider(user, 'icchhamati');
  const [onboarding, setOnboarding] = useState<null | 'AEPS' | 'AP'>(null);

  const status = useAsync<any>(async () => {
    if (!icch) return (await api.getAepsMerchantStatus({ merchantcode })).data;
    const response = await api.icchAepsStatus();
    if (!response?.success) throw new Error(response?.message || 'Could not load AEPS status.');
    return response.data;
  }, [merchantcode, icch]);
  const banks = useAsync<Bank[]>(
    async () => (await (icch ? api.icchAepsBanks() : api.getAepsBanks())).data ?? [],
    [icch]
  );
  const recent = useAsync<any[]>(
    async () => (await api.getRecentTransactions({ type: 'AEPS', limit: 6 })).data ?? [],
    []
  );

  // Only an Icchhamati answer counts: right after a switch, or when the new
  // provider's status failed to load, `status.data` can still be PaySprint's.
  const icchStatus: IcchStatus | null = icch && status.data?.step ? status.data : null;
  const activePipes: string[] = icch ? [] : status.data?.activePipes ?? [];
  const kycDone = !!status.data?.isMerchantKycComplete;
  const dailyAuthDone = !!status.data?.isDailyAuthDoneToday;
  // Icchhamati has no cash deposit.
  const services = icch ? SERVICES.filter((s) => s.key !== 'deposit') : SERVICES;

  useEffect(() => {
    if (!pipe && activePipes.length) setPipe(activePipes[0]);
  }, [activePipes.join(','), pipe]);

  const spec = SERVICES.find((s) => s.key === service)!;
  const amountValue = Number(amount) || 0;
  // Icchhamati asks the customer's OTP for Aadhaar Pay above the threshold too.
  const needsOtp =
    (service === 'withdrawal' || (icch && service === 'aadhaarpay')) && amountValue > AEPS_OTP_THRESHOLD;

  /** Any change to what the OTP was issued against invalidates it. */
  const invalidateOtp = () => {
    setOtp('');
    setOtpRefId('');
    setOtpReference('');
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
    setConsent(false);
    setPidData(null);
    invalidateOtp();
  };

  const sortedBanks = useMemo(() => {
    // PaySprint's list ships genuine duplicates — the same IIN appears more
    // than once, sometimes with different spellings of the name. Two entries
    // with the same IIN produce byte-identical transactions, so collapsing
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
    : icchStatus.step === 'twofa'
      ? 'Daily login is pending. Authenticate once to unlock transactions for today.'
      : icchStatus.step !== 'ready'
        ? 'Complete AEPS onboarding before serving customers.'
        : service === 'aadhaarpay' && icchStatus.aadhaarPayReady === false
          ? 'Aadhaar Pay needs its own daily login.'
          : null;
  const guardBlocker = icch
    ? icchBlocker
    : !spec.guarded
    ? null
    : !kycDone
      ? 'Complete merchant eKYC before using this service.'
      : !activePipes.length
        ? 'No AEPS pipe is active for your merchant code yet.'
        : !dailyAuthDone
          ? 'Daily 2FA is pending. Authenticate once to unlock transactions for today.'
          : null;

  const missingField =
    aadhaarNumber.length !== 12
      ? 'Enter the customer\'s 12-digit Aadhaar number.'
      : !bank
        ? 'Select the customer\'s bank.'
        : spec.mobile && mobileNumber.length !== 10
          ? 'Enter the customer\'s 10-digit mobile number.'
          : spec.amount && amountValue <= 0
            ? 'Enter the transaction amount.'
            : (service === 'withdrawal' || (icch && service === 'aadhaarpay')) && amountValue > AEPS_MAX_WITHDRAWAL
              ? `A single AEPS withdrawal cannot exceed ${money(AEPS_MAX_WITHDRAWAL)}.`
              : needsOtp && (!otpSent || otp.length !== 6)
                ? `Withdrawals above ${money(AEPS_OTP_THRESHOLD)} need the customer's OTP.`
                : !consent
                  ? 'Take the customer\'s consent before capturing their fingerprint.'
                  : null;

  // Location is checked BEFORE the fingerprint, not after. AEPS is geo-fenced,
  // so a capture taken without a fix can only be thrown away — and asking a
  // customer for their finger a second time is the part that costs the
  // retailer their credibility.
  const { problem: locationProblem } = useLocationReady();

  const captureBlocker =
    guardBlocker ||
    missingField ||
    (locationProblem ? 'Turn on location to continue' : null) ||
    (isCaptureSupported ? null : 'Fingerprint capture needs the Android app or the web portal with a scanner.');

  // AEPS withdrawals can settle after the response comes back, so a PENDING
  // row is re-queried against PaySprint rather than left stale.
  const checkTxnStatus = useAction(async (reference: string) => {
    const response = await api.aepsTxnStatus(reference);
    if (!response.success) throw new Error(paysprintError(response));
    return response;
  });

  const sendOtp = useAction(async () => {
    if (icch) {
      const response = await api.icchAepsTxnOtp(icchPayload());
      if (!response?.success || !response.data?.txnOtpRequestId) throw new Error(paysprintError(response));
      setOtpRefId(response.data.txnOtpRequestId);
      setOtpSent(true);
      setOtp('');
      setPidData(null);
      return response;
    }
    const response = await api.aepsInitiateOtp({
      aadhaarNumber,
      bankIIN: bankIin(bank!),
      mobileNumber,
      amount: amountValue,
      pipe,
      // Reusing the reference on resend avoids orphaning a PENDING transaction.
      ...(otpReference ? { referenceNo: otpReference } : {}),
      ...(await coordsPayload()),
    });
    if (!response.success || !response.data?.otpRefId) {
      throw new Error(paysprintError(response));
    }
    setOtpRefId(response.data.otpRefId);
    setOtpReference(response.data.referenceNo);
    setOtpSent(true);
    setOtp('');
    // The OTP is bound into the PID block, so an earlier capture is now stale.
    setPidData(null);
    return response;
  });

  /** Icchhamati's doAeps shape; the backend fills the outlet and scanner serial. */
  const icchPayload = () => ({
    aepsType: ({ withdrawal: 'CW', balance: 'BE', statement: 'MS', aadhaarpay: 'M' } as const)[service as 'withdrawal'],
    aadhaarNumber,
    customerMobile: mobileNumber,
    bankID: bankIin(bank!),
    bankName: bankName(bank!),
    amount: spec.amount ? amountValue : undefined,
  });

  const submit = useAction(async () => {
    const payload: Record<string, any> = {
      aadhaarNumber,
      bankIIN: bankIin(bank!),
      bankName: bankName(bank!),
      // The form no longer asks for a name (mockup 06); the field stays in
      // the payload so the request shape is unchanged.
      customerName: '',
      pidData,
      pipe,
      ...(await coordsPayload()),
    };
    if (spec.mobile) payload.mobileNumber = mobileNumber;
    if (spec.amount) payload.amount = amountValue;
    if (needsOtp) {
      payload.referenceNo = otpReference;
      payload.otpRefId = otpRefId;
    }

    const base = {
      service: spec.label,
      customerMobile: spec.mobile ? mobileNumber : undefined,
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

    let response: any;
    try {
      response = icch
        ? await api.icchAepsTransaction({
            ...icchPayload(),
            xml: pidData,
            deviceType: providerDeviceName(device),
            ...(needsOtp ? { otp, txnOtpRequestId: otpRefId } : {}),
          })
        : await spec.call(payload);
    } catch (err: any) {
      const body = err?.response?.data;
      setReceipt({
        ...base,
        status: 'FAILED',
        message: paysprintError(body),
        rrn: body?.data?.rrn || body?.data?.bankrrn,
        stan: body?.data?.stan || body?.data?.ackno,
      });
      // Swallowed on purpose: the receipt sheet is the error surface here, and
      // a duplicate inline banner would report the same failure twice.
      return null;
    } finally {
      recent.refresh();
      // A used PID block is never valid twice, whatever the outcome.
      setPidData(null);
    }

    // Icchhamati could not confirm either way: the customer may have been
    // debited, so this is not a failure and must not be retried.
    if (icch && response?.data?.verification === 'PENDING') {
      setReceipt({ ...base, status: 'PENDING', message: response.message, stan: response.data?.referenceNo });
      resetForm();
      return null;
    }

    if (!response?.success) {
      setReceipt({
        ...base,
        status: 'FAILED',
        message: paysprintError(response),
        rrn: response?.data?.rrn || response?.data?.bankrrn,
        stan: response?.data?.stan || response?.data?.ackno,
      });
      invalidateOtp();
      return null;
    }

    setReceipt({
      ...base,
      status: 'SUCCESS',
      message: response.message,
      balanceAmount: readBalance(response.data),
      rrn: response.data?.rrn || response.data?.bankrrn || response.data?.bankRRN || response.data?.data?.rrn,
      stan: response.data?.stan || response.data?.ackno || response.data?.fpTransactionId || response.data?.data?.stan,
      miniStatement:
        response.data?.ministatement ||
        response.data?.data?.ministatement ||
        icchStatement(response.data?.miniStatementStructureModel),
    });
    if (service === 'balance' || service === 'statement') invalidateOtp();
    else resetForm();
    status.refresh();
    return response;
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

  const gateNote = icch
    ? icchBlocker && !icchStatus
      ? { text: icchBlocker }
      : icchBlocker && {
        text: icchBlocker,
        action: icchStatus?.step === 'twofa' || icchBlocker.startsWith('Aadhaar Pay') ? 'Authenticate' : 'Continue',
        onPress: () => setOnboarding(icchStatus?.step === 'ready' ? 'AP' : 'AEPS'),
      }
    : !kycDone
    ? { text: 'Merchant eKYC is pending. Withdrawals and Aadhaar pay unlock once it is done.', action: 'Complete eKYC', onPress: () => { setKycPipe(undefined); setShowKyc(true); } }
    : !activePipes.length
      ? { text: 'No AEPS pipe is active for your merchant code yet.' }
      : !dailyAuthDone
        ? { text: 'Daily 2FA is pending. Authenticate once to unlock transactions for today.', action: 'Authenticate', onPress: () => setShowDailyAuth(true) }
        : null;

  return (
    <Screen
      loading={status.loading}
      skeleton={<View style={{ gap: 16 }}><SkeletonGrid count={4} /><SkeletonField /><SkeletonField /><SkeletonField /><SkeletonField /></View>}
      refreshing={status.refreshing || banks.refreshing}
      onRefresh={() => {
        status.refresh();
        banks.refresh();
        recent.refresh();
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
      {/* Ahead of the form: a geo-fence refusal arrives as an opaque provider
          error, so the cause is surfaced while it can still be fixed. */}
      <LocationGate />

      {onBoth && (
        <View style={styles.gap}>
          <Segmented
            scroll={false}
            options={[
              { key: 'paysprint', label: 'PaySprint' },
              { key: 'icchhamati', label: 'Icchhamati' },
            ]}
            value={active}
            onChange={(next) => {
              setActive(next);
              // Nothing from one provider carries over to the other: not the
              // form, and not its status or bank list while the new ones load.
              status.setData(null);
              banks.setData(null);
              resetForm();
              setService('withdrawal');
              setPipe(null);
            }}
          />
        </View>
      )}

      <View>
        {/* BHIM's grey line-icon circles; the selected one gains an orange ring. */}
        <View style={styles.acts} accessibilityRole="radiogroup">
          {services.map((s) => {
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
                  {s.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activePipes.length > 1 && (
          <View style={styles.gap}>
            <Segmented
              options={activePipes.map((p) => ({ key: p, label: p.replace(/^bank/i, 'Bank ') }))}
              value={pipe ?? activePipes[0]}
              onChange={(next) => {
                setPipe(next);
                setPidData(null);
                invalidateOtp();
              }}
            />
          </View>
        )}

        {!!gateNote && (
          <Note icon="shield-alert-outline" warn action={gateNote.action} onPress={gateNote.onPress} style={styles.gap}>
            {gateNote.text}
          </Note>
        )}

        {spec.mobile && (
          <Input
            label="Customer mobile"
            value={group(mobileNumber, 5)}
            onChangeText={(v) => setMobileNumber(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            containerStyle={styles.field}
          />
        )}

        <Input
          label="Aadhaar number"
          value={aadhaarDisplay(aadhaarNumber, showAadhaar)}
          onChangeText={(v) => {
            setAadhaarNumber(aadhaarFromDisplay(v, aadhaarNumber));
            setPidData(null);
          }}
          keyboardType="number-pad"
          placeholder="12-digit Aadhaar number"
          rightIcon={showAadhaar ? 'eye-outline' : 'eye-off-outline'}
          onRightIconPress={() => setShowAadhaar(!showAadhaar)}
          rightIconLabel={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
          containerStyle={styles.field}
        />

        <Text style={styles.fieldLabel}>Bank</Text>
        <Pressable
          onPress={() => setShowBanks(!showBanks)}
          style={({ pressed }) => [styles.select, showBanks && styles.selectOpen, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Bank"
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
            {bank ? bankName(bank) : banks.loading ? 'Loading banks…' : 'Select bank'}
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
          <>
            <Input
              label="Amount"
              value={amountDisplay(amount)}
              onChangeText={(v) => changeAmount(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="decimal-pad"
              placeholder="₹ 0"
              // BHIM prints the amount in words under the figure.
              helperText={amountInWords(amount) || undefined}
              containerStyle={styles.field}
              error={
                service === 'withdrawal' && amountValue > AEPS_MAX_WITHDRAWAL
                  ? `Maximum ${money(AEPS_MAX_WITHDRAWAL)} per withdrawal`
                  : undefined
              }
            />
            <View style={styles.chips}>
              {QUICK_AMOUNTS.map((value) => {
                const picked = amountValue === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => changeAmount(String(value))}
                    style={({ pressed }) => [styles.chip, picked && styles.chipOn, pressed && { opacity: 0.7 }]}
                    // 32 tall + slop clears the 44 target without chunky pills.
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked }}
                    accessibilityLabel={`Set amount to ${value} rupees`}
                  >
                    <Text style={[styles.chipText, picked && styles.chipTextOn]}>{rupees(value)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {needsOtp && (
          <View style={styles.gap}>
            <Note icon="message-lock-outline" style={styles.gap}>
              {`Withdrawals above ${money(AEPS_OTP_THRESHOLD)} need the customer's OTP. It is signed into the fingerprint capture, so send it before scanning.`}
            </Note>
            {!!sendOtp.error && (
              <View style={styles.gap}>
                <Banner tone="error" message={sendOtp.error} />
              </View>
            )}
            <ActionButton
              ghost
              icon="send-outline"
              label={otpSent ? 'Resend OTP' : 'Send OTP'}
              onPress={sendOtp.run}
              loading={sendOtp.pending}
              disabled={aadhaarNumber.length !== 12 || !bank || mobileNumber.length !== 10 || amountValue <= 0}
              style={otpSent ? styles.gap : undefined}
            />
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
                placeholder="6 digits the customer received"
                containerStyle={styles.field}
              />
            )}
          </View>
        )}

        <Pressable
          onPress={() => {
            setConsent(!consent);
            setPidData(null);
          }}
          style={({ pressed }) => [styles.consent, pressed && { opacity: 0.8 }]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Customer consent for Aadhaar authentication"
        >
          <Ionicons
            name={consent ? 'checkbox' : 'square-outline'}
            size={22}
            color={consent ? colors.highlight : colors.mutedForeground}
          />
          <Text style={styles.consentText}>
            Customer agrees to use their Aadhaar and fingerprint for this transaction.
          </Text>
        </Pressable>

        <Note
          icon="usb"
          action={showDevices ? 'Done' : 'Change'}
          onPress={() => setShowDevices(!showDevices)}
        >
          {`Device: ${DEVICE_LABELS[device]}`}
        </Note>
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

      <View>
        <SectionTitle>Recent AEPS activity</SectionTitle>
        {!!checkTxnStatus.error && (
          <View style={styles.gap}>
            <Banner tone="error" message={checkTxnStatus.error} />
          </View>
        )}
        <View style={styles.card}>
          {recent.loading ? <SkeletonRows count={3} /> : recent.data?.length ? (
            recent.data.map((txn: any, index: number) => (
              <View
                key={txn._id || txn.transactionId}
                style={[styles.item, index === recent.data!.length - 1 && styles.itemLast]}
              >
                <IconTile icon="fingerprint" size={44} iconSize={20} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {String(txn.type || 'AEPS').replace(/_/g, ' ').toLowerCase()}
                  </Text>
                  <Text style={styles.itemDate}>{dateTime(txn.createdAt)}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusText status={txn.status} />
                  {txn.metadata?.provider !== 'icchhamati' && String(txn.status).toUpperCase() === 'PENDING' && (
                    <Pressable
                      onPress={async () => {
                        const res = await checkTxnStatus.run(txn.transactionId);
                        if (res) recent.refresh();
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Re-check status of ${txn.transactionId}`}
                    >
                      <Text style={styles.recheck}>Re-check</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="fingerprint" title="No AEPS transactions yet" />
          )}
        </View>
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
      <MerchantKycSheet
        visible={showKyc}
        initialPipe={kycPipe}
        onClose={() => setShowKyc(false)}
        onCompleted={status.refresh}
      />
      <DailyAuthSheet
        visible={showDailyAuth}
        onClose={() => setShowDailyAuth(false)}
        onCompleted={status.refresh}
        onNeedsKyc={(nextPipe) => {
          setKycPipe(nextPipe);
          setShowKyc(true);
        }}
      />
      <IcchhamatiOnboardingSheet
        visible={!!onboarding}
        status={icchStatus}
        serviceType={onboarding ?? 'AEPS'}
        onClose={() => setOnboarding(null)}
        onChanged={status.refresh}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.xs, marginBottom: space.lg },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  chipOn: { borderColor: c.highlight },
  chipText: { fontSize: t.small, color: c.foreground, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: c.accent, fontWeight: '500' },
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
  consent: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, marginBottom: space.sm },
  consentText: { flex: 1, fontSize: t.small, lineHeight: 19, color: c.mutedForeground },
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
  card: {
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemInfo: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground, textTransform: 'capitalize' },
  itemDate: { fontSize: t.caption, color: c.mutedForeground },
  itemRight: { alignItems: 'flex-end', gap: 3 },
  itemAmount: { fontSize: t.body, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  recheck: { fontSize: t.caption, fontWeight: '500', color: c.accent, minHeight: 22 },
}));

export default AepsScreen;
