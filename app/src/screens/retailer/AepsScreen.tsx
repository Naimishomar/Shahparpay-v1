import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Grid,
  Row,
  Segmented,
  StatusPill,
  money,
  dateTime,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

const SERVICES = [
  { key: 'balance', label: 'Balance enquiry', icon: 'scale-balance', needsAmount: false },
  { key: 'withdrawal', label: 'Cash withdrawal', icon: 'cash-minus', needsAmount: true },
  { key: 'statement', label: 'Mini statement', icon: 'file-document-outline', needsAmount: false },
  { key: 'aadhaarpay', label: 'Aadhaar Pay', icon: 'qrcode-scan', needsAmount: true },
];

/** Withdrawals at or above this need a customer OTP first (backend threshold). */
const OTP_THRESHOLD = 5000;

interface Bank {
  iin: string | number;
  name?: string;
  bankName?: string;
}

export const AepsScreen: React.FC = () => {
  const { user } = useAuth();
  const [service, setService] = useState('balance');
  const [pipe, setPipe] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [bank, setBank] = useState<Bank | null>(null);
  const [showBanks, setShowBanks] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
  const [amount, setAmount] = useState('');

  const merchantcode = user?.retailerId || user?.code;
  // Passed explicitly so the screen also works against backends that still
  // require the query param.
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

  // Default to the first pipe the merchant is actually onboarded on.
  useEffect(() => {
    if (!pipe && activePipes.length) setPipe(activePipes[0]);
  }, [activePipes.join(','), pipe]);

  const kycDone = !!status.data?.isMerchantKycComplete;
  const dailyAuthDone = !!status.data?.isDailyAuthDoneToday;
  const current = SERVICES.find((s) => s.key === service)!;
  const needsAmount = current.needsAmount;
  const needsOtp = service === 'withdrawal' && Number(amount) >= OTP_THRESHOLD;

  const filteredBanks = useMemo(
    () =>
      (banks.data ?? []).filter((b) =>
        String(b.name || b.bankName || '').toLowerCase().includes(bankQuery.trim().toLowerCase())
      ),
    [banks.data, bankQuery]
  );

  const detailsReady =
    !!pipe &&
    mobileNumber.length === 10 &&
    aadhaarNumber.length === 12 &&
    !!bank &&
    (!needsAmount || Number(amount) > 0);

  // Ordered so the first unmet requirement is the one shown.
  const blocker = !kycDone
    ? 'Complete merchant eKYC before using AEPS.'
    : !activePipes.length
      ? 'No AEPS pipe is active for your merchant code yet.'
      : !dailyAuthDone
        ? 'Daily two-factor authentication is pending for today.'
        : null;

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
          <Row label="Merchant code" value={user?.retailerId || user?.code} />
          <Row label="eKYC" value={<StatusPill status={kycDone ? 'COMPLETED' : 'PENDING'} />} />
          <Row
            label="Daily 2FA"
            value={<StatusPill status={dailyAuthDone ? 'SUCCESS' : 'PENDING'} />}
            last
          />
        </CardContent>
      </Card>

      {!!blocker && <Banner tone="warning" message={blocker} />}

      <Grid columns={2}>
        {SERVICES.map((s) => {
          const active = s.key === service;
          return (
            <Pressable
              key={s.key}
              onPress={() => setService(s.key)}
              style={({ pressed }) => [
                styles.serviceCard,
                active && styles.serviceCardActive,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.label}
            >
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
              options={activePipes.map((p) => ({ key: p, label: p }))}
              value={pipe ?? activePipes[0]}
              onChange={setPipe}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="account-outline">Customer details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
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
          <Input
            label="Aadhaar number"
            required
            value={aadhaarNumber}
            onChangeText={(v) => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))}
            keyboardType="number-pad"
            secureTextEntry={!showAadhaar}
            leftIcon="card-account-details-outline"
            rightIcon={showAadhaar ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowAadhaar(!showAadhaar)}
            rightIconLabel={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
            placeholder="12 digits"
            helperText="Never stored on this device"
          />
          {needsAmount && (
            <Input
              label="Amount"
              required
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="currency-inr"
              helperText={
                service === 'withdrawal'
                  ? `Withdrawals of ${money(OTP_THRESHOLD)} or more need a customer OTP`
                  : undefined
              }
            />
          )}

          <SelectField
            label="Customer bank"
            required
            value={bank ? `${bank.name || bank.bankName} (IIN ${bank.iin})` : ''}
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
                {filteredBanks.slice(0, 60).map((b) => (
                  <Pressable
                    key={String(b.iin)}
                    onPress={() => {
                      setBank(b);
                      setShowBanks(false);
                      setBankQuery('');
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>{b.name || b.bankName}</Text>
                  </Pressable>
                ))}
                {!filteredBanks.length && <Text style={styles.pickerEmpty}>No matching bank</Text>}
              </ScrollView>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="fingerprint">Fingerprint capture</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Banner
            tone="info"
            message="AEPS needs a signed PID block from a certified RD service. This build has no RD bridge, so capture cannot start here — every other part of the flow is live against the backend."
          />
          {needsOtp && (
            <Banner
              tone="warning"
              message={`This amount is at or above ${money(OTP_THRESHOLD)}, so the customer will also receive an OTP before the withdrawal completes.`}
            />
          )}
          <Button disabled icon="fingerprint" size="lg" fullWidth>
            Capture fingerprint
          </Button>
          <Text style={styles.helpSmall}>
            {detailsReady
              ? 'Customer details are complete and ready to submit once capture is available.'
              : 'Fill in mobile, Aadhaar and bank to prepare the transaction.'}
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent AEPS activity</CardTitle>
        </CardHeader>
        <CardContent>
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
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="fingerprint" title="No AEPS transactions yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  serviceCard: {
    minHeight: 62,
    justifyContent: 'center',
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
  pickerList: { maxHeight: 240 },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },
  helpSmall: { fontSize: t.micro, color: c.mutedForeground, textAlign: 'center', lineHeight: 16 },
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
}));

export default AepsScreen;
