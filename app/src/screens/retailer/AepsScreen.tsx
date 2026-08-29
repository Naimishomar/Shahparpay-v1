import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  Grid,
  Row,
  Segmented,
  StatusPill,
  money,
  dateTime,
} from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from '@/components/aeps/BiometricCapture';
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { DailyAuthSheet } from '@/components/aeps/DailyAuthSheet';
import { TransactionReceipt, type ReceiptData } from '@/components/aeps/TransactionReceipt';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { AEPS_OTP_THRESHOLD, AEPS_MAX_WITHDRAWAL } from '@/constants';
import { coordsPayload } from '@/services/location';
import api from '@/services/api';

type ServiceKey = 'balance' | 'statement' | 'withdrawal' | 'deposit' | 'aadhaarpay';

interface ServiceSpec {
  key: ServiceKey;
  label: string;
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
    key: 'balance',
    label: 'Balance enquiry',
    icon: 'scale-balance',
    amount: false,
    mobile: false,
    guarded: false,
    call: (payload) => api.aepsBalanceEnquiry(payload),
  },
  {
    key: 'statement',
    label: 'Mini statement',
    icon: 'format-list-bulleted',
    amount: false,
    mobile: true,
    guarded: false,
    call: (payload) => api.aepsMiniStatement(payload),
  },
  {
    key: 'withdrawal',
    label: 'Cash withdrawal',
    icon: 'cash-minus',
    amount: true,
    mobile: true,
    guarded: true,
    call: (payload) => api.aepsCashWithdrawal(payload),
  },
  {
    key: 'deposit',
    label: 'Cash deposit',
    icon: 'cash-plus',
    amount: true,
    mobile: true,
    guarded: false,
    call: (payload) => api.aepsCashDeposit(payload),
  },
  {
    key: 'aadhaarpay',
    label: 'Aadhaar Pay',
    icon: 'qrcode-scan',
    amount: true,
    mobile: true,
    guarded: true,
    call: (payload) => api.aepsAadhaarPay(payload),
  },
];

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];

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
  const [pipe, setPipe] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [bank, setBank] = useState<Bank | null>(null);
  const [showBanks, setShowBanks] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
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

  const status = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode })).data,
    [merchantcode]
  );
  const banks = useAsync<Bank[]>(async () => (await api.getAepsBanks()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const recent = useAsync<any[]>(
    async () => (await api.getRecentTransactions({ type: 'AEPS', limit: 6 })).data ?? [],
    []
  );

  const activePipes: string[] = status.data?.activePipes ?? [];
  const kycDone = !!status.data?.isMerchantKycComplete;
  const dailyAuthDone = !!status.data?.isDailyAuthDoneToday;

  useEffect(() => {
    if (!pipe && activePipes.length) setPipe(activePipes[0]);
  }, [activePipes.join(','), pipe]);

  const spec = SERVICES.find((s) => s.key === service)!;
  const amountValue = Number(amount) || 0;
  const needsOtp = service === 'withdrawal' && amountValue > AEPS_OTP_THRESHOLD;

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
    setCustomerName('');
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
  const guardBlocker = !spec.guarded
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
            : service === 'withdrawal' && amountValue > AEPS_MAX_WITHDRAWAL
              ? `A single AEPS withdrawal cannot exceed ${money(AEPS_MAX_WITHDRAWAL)}.`
              : needsOtp && (!otpSent || otp.length !== 6)
                ? `Withdrawals above ${money(AEPS_OTP_THRESHOLD)} need the customer's OTP.`
                : !consent
                  ? 'Take the customer\'s consent before capturing their fingerprint.'
                  : null;

  const captureBlocker = guardBlocker || missingField;

  // AEPS withdrawals can settle after the response comes back, so a PENDING
  // row is re-queried against PaySprint rather than left stale.
  const checkTxnStatus = useAction(async (reference: string) => {
    const response = await api.aepsTxnStatus(reference);
    if (!response.success) throw new Error(paysprintError(response));
    return response;
  });

  const sendOtp = useAction(async () => {
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

  const submit = useAction(async () => {
    const payload: Record<string, any> = {
      aadhaarNumber,
      bankIIN: bankIin(bank!),
      bankName: bankName(bank!),
      customerName,
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
      customerName,
      customerMobile: spec.mobile ? mobileNumber : undefined,
      aadhaarNumber,
      bankName: bankName(bank!),
      agentName: user?.name,
      agentMobile: user?.contactNumber,
      dateTime: new Date().toLocaleString('en-IN'),
      amount: spec.amount ? amountValue : undefined,
    };

    let response: any;
    try {
      response = await spec.call(payload);
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
      balances.refresh();
      recent.refresh();
      // A used PID block is never valid twice, whatever the outcome.
      setPidData(null);
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
      rrn: response.data?.rrn || response.data?.bankrrn || response.data?.data?.rrn,
      stan: response.data?.stan || response.data?.ackno || response.data?.data?.stan,
      miniStatement: response.data?.ministatement || response.data?.data?.ministatement,
    });
    if (service === 'balance' || service === 'statement') invalidateOtp();
    else resetForm();
    status.refresh();
    return response;
  });

  return (
    <Screen
      loading={status.loading}
      refreshing={status.refreshing || banks.refreshing}
      onRefresh={() => {
        status.refresh();
        banks.refresh();
        balances.refresh();
        recent.refresh();
      }}
      error={status.error}
      onRetry={status.reload}
    >
      <Card>
        <CardContent>
          <Row label="AEPS wallet" value={money(balances.data?.aepsBalance)} mono />
          <Row label="Merchant code" value={merchantcode} mono />
          <Row label="Merchant eKYC" value={<StatusPill status={kycDone ? 'COMPLETED' : 'PENDING'} />} />
          <Row
            label="Daily 2FA"
            value={<StatusPill status={dailyAuthDone ? 'SUCCESS' : 'PENDING'} />}
            last
          />
        </CardContent>
      </Card>

      {(!kycDone || !dailyAuthDone) && (
        <View style={styles.gateRow}>
          {!kycDone && (
            <Button
              icon="shield-account-outline"
              variant="outline"
              onPress={() => {
                setKycPipe(undefined);
                setShowKyc(true);
              }}
              style={styles.flex}
            >
              Complete eKYC
            </Button>
          )}
          {kycDone && !dailyAuthDone && (
            <Button icon="shield-key-outline" onPress={() => setShowDailyAuth(true)} style={styles.flex}>
              Daily 2FA login
            </Button>
          )}
        </View>
      )}

      <Grid columns={2}>
        {SERVICES.map((s) => {
          const active = s.key === service;
          return (
            <Pressable
              key={s.key}
              onPress={() => changeService(s.key)}
              style={({ pressed }) => [
                styles.serviceCard,
                active && styles.serviceCardActive,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.label}
            >
              <MaterialCommunityIcons
                name={s.icon as any}
                size={20}
                color={active ? colors.accent : colors.mutedForeground}
              />
              <Text style={[styles.serviceLabel, active && styles.serviceLabelActive]} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </Grid>

      {activePipes.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle icon="pipe">Bank pipe</CardTitle>
          </CardHeader>
          <CardContent>
            <Segmented
              options={activePipes.map((p) => ({ key: p, label: p.replace(/^bank/i, 'Bank ') }))}
              value={pipe ?? activePipes[0]}
              onChange={(next) => {
                setPipe(next);
                setPidData(null);
                invalidateOtp();
              }}
            />
          </CardContent>
        </Card>
      )}

      {!!guardBlocker && <Banner tone="warning" message={guardBlocker} />}

      <Card>
        <CardHeader>
          <CardTitle icon="account-outline">Customer details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Input
            label="Customer name"
            value={customerName}
            onChangeText={setCustomerName}
            leftIcon="account-outline"
            placeholder="Printed on the receipt"
            autoCapitalize="words"
          />

          <Input
            label="Aadhaar number"
            required
            value={aadhaarNumber}
            onChangeText={(v) => {
              setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12));
              setPidData(null);
            }}
            keyboardType="number-pad"
            secureTextEntry={!showAadhaar}
            leftIcon="card-account-details-outline"
            rightIcon={showAadhaar ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowAadhaar(!showAadhaar)}
            rightIconLabel={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
            placeholder="12 digits"
            helperText="Never stored on this device"
          />

          <SelectField
            label="Customer bank"
            required
            value={bank ? `${bankName(bank)} · IIN ${bankIin(bank)}` : ''}
            placeholder={banks.loading ? 'Loading banks…' : 'Search and select bank'}
            open={showBanks}
            onPress={() => setShowBanks(!showBanks)}
          />
          {showBanks && (
            <View style={styles.picker}>
              <Input
                placeholder="Search bank name"
                value={bankQuery}
                onChangeText={setBankQuery}
                leftIcon="magnify"
                autoCapitalize="none"
              />
              <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredBanks.slice(0, 80).map((b) => (
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
                  >
                    <Text style={styles.pickerText} numberOfLines={1}>
                      {bankName(b)}
                    </Text>
                    <Text style={styles.pickerIin}>{bankIin(b)}</Text>
                  </Pressable>
                ))}
                {!filteredBanks.length && <Text style={styles.pickerEmpty}>No matching bank</Text>}
              </ScrollView>
            </View>
          )}

          {spec.mobile && (
            <Input
              label="Customer mobile"
              required
              value={mobileNumber}
              onChangeText={(v) => setMobileNumber(v.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              leftIcon="phone-outline"
              autoComplete="tel"
              placeholder="10-digit mobile number"
            />
          )}

          {spec.amount && (
            <>
              <Input
                label="Amount"
                required
                value={amount}
                onChangeText={(v) => changeAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                leftIcon="currency-inr"
                error={
                  service === 'withdrawal' && amountValue > AEPS_MAX_WITHDRAWAL
                    ? `Maximum ${money(AEPS_MAX_WITHDRAWAL)} per withdrawal`
                    : undefined
                }
                helperText={
                  service === 'withdrawal'
                    ? `Above ${money(AEPS_OTP_THRESHOLD)} the customer also receives an OTP`
                    : undefined
                }
              />
              {!!amountInWords(amount) && (
                <Text style={styles.words}>{amountInWords(amount)}</Text>
              )}
              <View style={styles.quickRow}>
                {QUICK_AMOUNTS.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => changeAmount(String(value))}
                    style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set amount to ${value} rupees`}
                  >
                    <Text style={styles.quickText}>₹{value.toLocaleString('en-IN')}</Text>
                  </Pressable>
                ))}
                {!!amount && (
                  <Pressable
                    onPress={() => changeAmount('')}
                    style={({ pressed }) => [styles.quickChip, styles.quickClear, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Clear amount"
                  >
                    <Text style={[styles.quickText, styles.quickClearText]}>Clear</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </CardContent>
      </Card>

      {needsOtp && (
        <Card>
          <CardHeader>
            <CardTitle icon="message-lock-outline">Customer OTP</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Banner
              tone="info"
              message={`The bank sends a 6-digit code to the customer's registered mobile for withdrawals above ${money(AEPS_OTP_THRESHOLD)}. It is signed into the fingerprint capture, so send it before scanning.`}
            />
            {!!sendOtp.error && <Banner tone="error" message={sendOtp.error} />}
            <Button
              variant="outline"
              icon="send-outline"
              onPress={sendOtp.run}
              loading={sendOtp.pending}
              disabled={aadhaarNumber.length !== 12 || !bank || mobileNumber.length !== 10 || amountValue <= 0}
              fullWidth
            >
              {otpSent ? 'Resend OTP' : 'Send OTP'}
            </Button>
            {otpSent && (
              <Input
                label="Transaction OTP"
                required
                value={otp}
                onChangeText={(v) => {
                  setOtp(v.replace(/\D/g, '').slice(0, 6));
                  setPidData(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="lock-outline"
                autoComplete="one-time-code"
                placeholder="6 digits"
                helperText="Ask the customer to read out the code they received"
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="fingerprint">Customer consent & fingerprint</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
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
            <MaterialCommunityIcons
              name={consent ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={consent ? colors.accent : colors.mutedForeground}
            />
            <Text style={styles.consentText}>
              The customer has agreed to use their Aadhaar and fingerprint for this transaction.
            </Text>
          </Pressable>

          <BiometricCapture
            device={device}
            onDeviceChange={setDevice}
            pidData={pidData}
            onCaptured={setPidData}
            options={{ otp: needsOtp && otp.length === 6 ? otp : undefined }}
            blockedReason={captureBlocker}
            confirmMessage="Ask the CUSTOMER to place their finger on the scanner. This starts a live bank transaction."
            label="Capture customer fingerprint"
          />

          <Button
            icon="check-decagram"
            haptic="medium"
            size="lg"
            fullWidth
            loading={submit.pending}
            disabled={!pidData || !!captureBlocker}
            onPress={submit.run}
          >
            {spec.amount ? `${spec.label} · ${money(amountValue)}` : spec.label}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent AEPS activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!!checkTxnStatus.error && <Banner tone="error" message={checkTxnStatus.error} />}
          {recent.loading ? null : recent.data?.length ? (
            recent.data.map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {String(txn.type || 'AEPS').replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.itemDate}>{dateTime(txn.createdAt)}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                  {String(txn.status).toUpperCase() === 'PENDING' && (
                    <Pressable
                      onPress={async () => {
                        const res = await checkTxnStatus.run(txn.transactionId);
                        if (res) {
                          recent.refresh();
                          balances.refresh();
                        }
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
        </CardContent>
      </Card>

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
      <TransactionReceipt data={receipt} onClose={() => setReceipt(null)} />
    </Screen>
  );
};

const styles = themed((c) => ({
  gateRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  serviceCard: {
    minHeight: 76,
    justifyContent: 'center',
    gap: 6,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  serviceCardActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  serviceLabel: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  serviceLabelActive: { fontWeight: '700' },
  form: { gap: space.lg },
  picker: { gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.secondary },
  pickerList: { maxHeight: 260 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { flex: 1, fontSize: t.small, color: c.foreground },
  pickerIin: { fontSize: t.micro, color: c.mutedForeground, fontVariant: ['tabular-nums'] },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },
  words: { fontSize: t.caption, fontWeight: '600', color: c.success, marginTop: -space.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  quickClear: { borderColor: c.destructive },
  quickText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  quickClearText: { color: c.destructive },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44 },
  consentText: { flex: 1, fontSize: t.small, color: c.foreground, lineHeight: 19 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  itemInfo: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  itemDate: { fontSize: t.micro, color: c.mutedForeground },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemAmount: {
    fontSize: t.small,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  recheck: { fontSize: t.micro, fontWeight: '700', color: c.accent, minHeight: 22 },
}));

export default AepsScreen;
