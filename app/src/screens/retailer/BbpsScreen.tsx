import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
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
  Segmented,
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

export const BbpsScreen: React.FC = () => {
  // The categories are whatever the provider currently bills for: a category we
  // invent here has no biller registry behind it, and one they add would be
  // invisible until someone edited this file.
  const categories = useAsync<any[]>(async () => {
    const res = await api.getBillCategories();
    // A refused list is not an empty list: swallowing it left the screen with no
    // categories, no billers and nothing to explain why.
    if (!res.success) throw new Error(res.message || 'Could not load bill categories.');
    return (res.data ?? []).map((c: any) => ({
      key: c.category || c.name || c.code,
      label: c.name || c.category || c.code,
    }));
  }, []);
  const [category, setCategory] = useState('');
  const [biller, setBiller] = useState<Biller | null>(null);
  const [showBillers, setShowBillers] = useState(false);
  const [billerQuery, setBillerQuery] = useState('');
  const [caNumber, setCaNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [notice, setNotice] = useState('');

  const billers = useAsync<Biller[]>(async () => {
    setBiller(null);
    setBill(null);
    setAmount('');
    if (!category) return [];
    const res = await api.getRechargeOperators(category);
    if (!res.success) throw new Error(res.message || 'Could not load billers.');
    return res.data ?? [];
  }, [category]);

  // The first category the provider lists, once they have loaded.
  React.useEffect(() => {
    if (!category && categories.data?.length) setCategory(categories.data[0].key);
  }, [categories.data]);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const fetchBill = useAction(async () => {
    const res = await api.fetchBill({
      caNumber: caNumber.trim(),
      operator: String(biller?.id),
      type: category,
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
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  const valid =
    !!biller && caNumber.trim().length >= 4 && Number(amount) > 0 && !overBalance && pin.length === 4;

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
      // Paysprint returns the payable amount under a few different keys.
      const due = data.amount ?? data.Amount ?? data.dueamount ?? data.billAmount;
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

  return (
    <Screen
      refreshing={history.refreshing}
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

      {!!categories.error && (
        <ErrorBanner message={categories.error} onRetry={categories.reload} />
      )}
      {!categories.loading && !categories.error && !(categories.data ?? []).length && (
        <Banner
          tone="warning"
          message="No bill categories are available from the provider right now. Please try again later."
        />
      )}
      <Segmented options={categories.data ?? []} value={category} onChange={setCategory} />

      <Card>
        <CardHeader>
          <CardTitle icon="receipt">Bill details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!!billers.error && <ErrorBanner message={billers.error} onRetry={billers.reload} />}
          {!billers.loading && !billers.error && !!category && !(billers.data ?? []).length && (
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
                <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredBillers.map((b) => (
                    <Pressable
                      key={String(b.id)}
                      onPress={() => {
                        setBiller(b);
                        setShowBillers(false);
                        setBillerQuery('');
                      }}
                      style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
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
              <Row label="Bill number" value={bill.billnumber || bill.billNumber} />
              <Row label="Bill date" value={bill.billdate || bill.billDate} />
              <Row label="Due date" value={bill.duedate || bill.dueDate} />
              <Row
                label="Amount due"
                value={money(bill.amount ?? bill.Amount ?? bill.dueamount ?? bill.billAmount)}
                mono
                last
              />
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
            error={overBalance ? 'Amount exceeds your main wallet balance' : undefined}
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
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
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
            <EmptyState icon="receipt" title="No bill payments yet" />
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

export default BbpsScreen;
