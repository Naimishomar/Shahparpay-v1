import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Row,
  StatusPill,
  SuccessBanner,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

interface Biller {
  id: string | number;
  name: string;
  displayname?: string;
  // The biller's own name for the consumer identifier — "Consumer Number",
  // "CA Number", "Vehicle Number" — so the field is labelled the way the bill is.
  label?: string;
  // Whether this biller can produce a bill before it is paid. A top-up cannot.
  viewbill?: string;
}

/** The provider refuses anything smaller, on every BBPS service. */
export const MIN_AMOUNT = 10;

interface BbpsForm {
  biller: unknown;
  caNumber: string;
  amount: string;
  available: number;
  customerMobile: string;
  pin: string;
}

/**
 * What the provider requires of a bill payment, on every BBPS service: a
 * biller, the biller's own consumer identifier, at least ₹10, a ten-digit
 * mobile number if one is given at all, and the wallet PIN. Kept out of the
 * component so the rule that gates the money is testable on its own.
 */
export const bbpsFormValid = ({
  biller,
  caNumber,
  amount,
  available,
  customerMobile,
  pin,
}: BbpsForm) =>
  !!biller &&
  caNumber.trim().length >= 4 &&
  Number(amount) >= MIN_AMOUNT &&
  Number(amount) <= available &&
  (customerMobile.length === 0 || customerMobile.length === 10) &&
  pin.length === 4;

/**
 * One BBPS category: pick the biller, fetch the bill if there is one, pay it.
 *
 * The category arrives as a route param from the hub, so this screen never
 * switches categories under the retailer — which is what the old combined
 * screen did, quietly resetting the biller and the fetched bill while leaving
 * the form looking filled in.
 */
export const BbpsServiceScreen: React.FC = () => {
  const route = useRoute<any>();
  const category = String(route.params?.category ?? '');
  const categoryLabel = String(route.params?.title ?? 'Bill payment');

  const [biller, setBiller] = useState<Biller | null>(null);
  const [showBillers, setShowBillers] = useState(false);
  const [billerQuery, setBillerQuery] = useState('');
  const [caNumber, setCaNumber] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [notice, setNotice] = useState('');

  const billers = useAsync<Biller[]>(async () => {
    if (!category) return [];
    const res = await api.getRechargeOperators(category);
    if (!res.success) throw new Error(res.message || 'Could not load billers.');
    return res.data ?? [];
  }, [category]);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const fetchBill = useAction(async () => {
    const res = await api.fetchBill({
      caNumber: caNumber.trim(),
      operator: String(biller?.id),
      type: category,
      customerMobile: customerMobile || undefined,
      // Some billers quote against an amount rather than returning one.
      ...(Number(amount) > 0 ? { amount: Number(amount) } : {}),
    });
    if (!res.success) throw new Error(res.message);
    return res.data;
  });

  const payBill = useAction(async () => {
    const res = await api.doRecharge({
      number: caNumber.trim(),
      operator: biller?.id,
      amount: Number(amount),
      pin,
      type: category,
      customerMobile: customerMobile || undefined,
      // What the biller told us about this bill. Without it the payment is
      // stored with no customer name, bill number or due date, and every
      // receipt and report for it reads blank.
      ...(bill
        ? {
            customerName: bill.customerName ?? bill.name ?? undefined,
            billDetails: {
              customerName: bill.customerName ?? bill.name ?? null,
              billNumber: bill.billNumber ?? bill.billnumber ?? null,
              billDate: bill.billDate ?? bill.billdate ?? null,
              dueDate: bill.dueDate ?? bill.duedate ?? null,
              billPeriod: bill.billPeriod ?? bill.bilperiod ?? null,
              fetchRefId: bill.fetchRefId ?? bill.fetchBillId ?? bill.fetchBillID ?? null,
            },
          }
        : {}),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  // The provider refuses a payment under ₹10 and a mobile number that is not
  // exactly ten digits, so both are caught here rather than by a failed call.
  const belowMinimum = !!amount && Number(amount) > 0 && Number(amount) < MIN_AMOUNT;
  const mobileInvalid = customerMobile.length > 0 && customerMobile.length !== 10;
  const valid = bbpsFormValid({ biller, caNumber, amount, available, customerMobile, pin });

  const filteredBillers = useMemo(
    () =>
      (billers.data ?? []).filter((b) =>
        (b.displayname || b.name || '').toLowerCase().includes(billerQuery.trim().toLowerCase())
      ),
    [billers.data, billerQuery]
  );

  const onFetchBill = async () => {
    setNotice('');
    const data = await fetchBill.run();
    if (data) {
      setBill(data);
      // The biller quotes the payable amount under a few different keys.
      const due = data.dueAmount ?? data.amount ?? data.dueamount ?? data.billAmount;
      if (due) setAmount(String(due));
    }
  };

  const onPay = async () => {
    setNotice('');
    const res = await payBill.run();
    if (res) {
      setNotice(res.message || 'Bill paid successfully.');
      setPin('');
      setBill(null);
      balances.reload();
      history.reload();
    }
  };

  // Only this category's payments — the hub already lists everything.
  const categoryHistory = (history.data ?? []).filter(
    (txn: any) =>
      !category ||
      String(txn?.metadata?.mode ?? '').toLowerCase() === category.toLowerCase() ||
      String(txn?.metadata?.type ?? '').toLowerCase() === category.toLowerCase()
  );

  return (
    <Screen
      refreshing={history.refreshing || billers.refreshing}
      onRefresh={() => {
        history.refresh();
        balances.refresh();
        billers.refresh();
      }}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(available)} mono last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="receipt">{categoryLabel}</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!!billers.error && <ErrorBanner message={billers.error} onRetry={billers.reload} />}
          {!billers.loading && !billers.error && !(billers.data ?? []).length && (
            <Banner
              tone="warning"
              message="No billers are available for this category right now."
            />
          )}

          <SelectField
            label="Biller"
            required
            value={biller ? biller.displayname || biller.name : ''}
            placeholder={billers.loading ? 'Loading billers…' : 'Select biller'}
            open={showBillers}
            onPress={() => setShowBillers(!showBillers)}
          />
          {showBillers && (
            <View style={styles.picker}>
              <Input
                placeholder="Search biller"
                value={billerQuery}
                onChangeText={setBillerQuery}
                leftIcon="magnify"
                autoCapitalize="none"
              />
              {billers.loading ? (
                <LoadingBlock />
              ) : (
                <ScrollView
                  style={styles.pickerList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredBillers.map((b) => (
                    <Pressable
                      key={String(b.id)}
                      onPress={() => {
                        setBiller(b);
                        setShowBillers(false);
                        setBillerQuery('');
                        // A bill belongs to the biller it was fetched from.
                        setBill(null);
                        setAmount('');
                      }}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        pressed && styles.pickerItemPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerText}>{b.displayname || b.name}</Text>
                    </Pressable>
                  ))}
                  {!filteredBillers.length && (
                    <Text style={styles.pickerEmpty}>No billers in this category</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* The biller names its own identifier; a top-up like FASTag calls it a
              vehicle number rather than a consumer number. */}
          <Input
            label={biller?.label || 'Consumer number'}
            required
            value={caNumber}
            onChangeText={setCaNumber}
            autoCapitalize="characters"
            placeholder={biller?.label ? `Enter ${biller.label}` : 'As printed on your bill'}
            leftIcon="identifier"
          />

          <Input
            label="Customer mobile (optional)"
            value={customerMobile}
            onChangeText={(v) => setCustomerMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="10-digit mobile number"
            leftIcon="phone-outline"
            maxLength={10}
            error={mobileInvalid ? 'Enter a valid 10-digit mobile number' : undefined}
          />

          {/* A top-up has no bill to fetch, so the step is hidden rather than
              left to fail. */}
          {biller?.viewbill === 'true' && (
            <>
              <Button
                variant="outline"
                icon="file-search-outline"
                onPress={onFetchBill}
                loading={fetchBill.pending}
                disabled={!biller || caNumber.trim().length < 4}
                fullWidth
              >
                Fetch bill
              </Button>
              {!!fetchBill.error && <ErrorBanner message={fetchBill.error} />}
            </>
          )}

          {!!bill && (
            <View style={styles.infoBox}>
              <Row label="Customer" value={bill.customerName || bill.name} />
              <Row label="Account" value={bill.account || bill.accountNumber || caNumber} />
              <Row label="Bill number" value={bill.billnumber || bill.billNumber} />
              <Row label="Bill date" value={bill.billdate || bill.billDate} />
              <Row label="Due date" value={bill.duedate || bill.dueDate} />
              <Row label="Bill period" value={bill.bilperiod || bill.billPeriod} />
              <Row
                label="Amount due"
                value={money(bill.amount ?? bill.Amount ?? bill.dueamount ?? bill.billAmount)}
                mono
              />
              <Row label="Fetch reference" value={bill.fetchBillID || bill.fetchRefId || '—'} last />
            </View>
          )}

          <Input
            label="Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="currency-inr"
            error={
              overBalance
                ? 'Amount exceeds your main wallet balance'
                : belowMinimum
                  ? `Minimum payment amount is ₹${MIN_AMOUNT}`
                  : undefined
            }
            helperText="Auto-filled when the biller returns a due amount"
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

          {!!payBill.error && <ErrorBanner message={payBill.error} />}
          {!!notice && <SuccessBanner message={notice} />}
          <Button
            onPress={onPay}
            disabled={!valid}
            loading={payBill.pending}
            icon="check-circle-outline"
            size="lg"
            fullWidth
          >
            Pay bill
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : categoryHistory.length ? (
            categoryHistory.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Consumer" value={txn.metadata?.caNumber} />
                <Row label="Mode" value={txn.metadata?.mode} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState icon="receipt" title={`No ${categoryLabel.toLowerCase()} payments yet`} />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
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
  infoBox: { padding: space.md, borderRadius: radius.md, backgroundColor: c.secondary },
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

export default BbpsServiceScreen;
