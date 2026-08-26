import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
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

// Keys match the `type` the backend maps to a Paysprint biller category.
const CATEGORIES = [
  { key: 'electricity', label: 'Electricity' },
  { key: 'gas', label: 'Gas' },
  { key: 'water', label: 'Water' },
  { key: 'broadband', label: 'Broadband' },
  { key: 'landline', label: 'Landline' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'loan', label: 'Loan' },
  { key: 'fastag', label: 'FASTag' },
  { key: 'cable', label: 'Cable TV' },
];

interface Biller {
  id: string | number;
  name: string;
  displayname?: string;
  ad1_name?: string;
  ad2_name?: string;
  ad3_name?: string;
}

export const BbpsScreen: React.FC = () => {
  const [category, setCategory] = useState('electricity');
  const [biller, setBiller] = useState<Biller | null>(null);
  const [showBillers, setShowBillers] = useState(false);
  const [billerQuery, setBillerQuery] = useState('');
  const [caNumber, setCaNumber] = useState('');
  const [ad1, setAd1] = useState('');
  const [ad2, setAd2] = useState('');
  const [ad3, setAd3] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [notice, setNotice] = useState('');

  const billers = useAsync<Biller[]>(async () => {
    setBiller(null);
    setBill(null);
    setAmount('');
    return (await api.getRechargeOperators(category)).data ?? [];
  }, [category]);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const fetchBill = useAction(async () => {
    const res = await api.fetchBill({
      caNumber: caNumber.trim(),
      operator: String(biller?.id),
      ad1: ad1.trim() || undefined,
      ad2: ad2.trim() || undefined,
      ad3: ad3.trim() || undefined,
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
      circle: 1,
      ad1: ad1.trim() || undefined,
      ad2: ad2.trim() || undefined,
      ad3: ad3.trim() || undefined,
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

      <Segmented options={CATEGORIES} value={category} onChange={setCategory} />

      <Card>
        <CardHeader>
          <CardTitle icon="receipt">Bill details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!!billers.error && <ErrorBanner message={billers.error} onRetry={billers.reload} />}

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

          <Input
            label="Consumer number"
            required
            value={caNumber}
            onChangeText={setCaNumber}
            autoCapitalize="characters"
            placeholder="As printed on your bill"
            leftIcon="identifier"
          />
          {!!biller?.ad1_name && <Input label={biller.ad1_name} value={ad1} onChangeText={setAd1} />}
          {!!biller?.ad2_name && <Input label={biller.ad2_name} value={ad2} onChangeText={setAd2} />}
          {!!biller?.ad3_name && <Input label={biller.ad3_name} value={ad3} onChangeText={setAd3} />}

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
