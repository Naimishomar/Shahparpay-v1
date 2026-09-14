import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
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
  Toast,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const TYPES = [
  { key: 'prepaid', label: 'Prepaid' },
  { key: 'postpaid', label: 'Postpaid' },
  { key: 'dth', label: 'DTH' },
];

interface Operator {
  id: string | number;
  name: string;
  displayname?: string;
}

interface Circle {
  id: string;
  name: string;
}

export const RechargeScreen: React.FC = () => {
  const [type, setType] = useState('prepaid');
  const [operator, setOperator] = useState<Operator | null>(null);
  const [showOperators, setShowOperators] = useState(false);
  const [operatorQuery, setOperatorQuery] = useState('');
  // A prepaid recharge is routed by circle as well as operator, and the circle is
  // a provider code rather than a name, so the list has to come from the provider.
  const [circle, setCircle] = useState<Circle | null>(null);
  const [planList, setPlanList] = useState<any[]>([]);
  const [planMeta, setPlanMeta] = useState<any>(null);
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');

  // Re-fetches whenever the tab changes; the previous operator no longer applies,
  // and neither do the plans that were fetched for it.
  const operators = useAsync<Operator[]>(async () => {
    setOperator(null);
    setPlanList([]);
    setPlanMeta(null);
    const res = await api.getRechargeOperators(type);
    // A refused list is not an empty list. Swallowing the failure left the
    // retailer staring at an empty dropdown with nothing to say whether the
    // provider was down, the service was off, or the app was broken.
    if (!res.success) throw new Error(res.message || 'Could not load operators.');
    return res.data ?? [];
  }, [type]);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);

  const checkStatus = useAction(async (transactionId: string) => {
    const res = await api.getRechargeStatus(transactionId);
    if (!res.success) throw new Error(res.message);
    return res;
  });
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  const plans = useAction(async () => {
    const res = await api.browseRechargePlans({ mobileNumber: number.trim() });
    if (!res.success) throw new Error(res.message);
    // Keep `meta` together with the grouped plans. The website uses this
    // metadata to populate the operator, circle and logo after lookup.
    return res;
  });

  const dthInfo = useAction(async () => {
    const res = await api.getDthInfo({
      dthNumber: number.trim(),
      operator: String(operator?.id),
    });
    if (!res.success) throw new Error(res.message);
    return Array.isArray(res.data) ? res.data[0] : res.data;
  });

  const recharge = useAction(async () => {
    const res = await api.doRecharge({
      [type === 'dth' ? 'dthNumber' : 'mobileNumber']: number.trim(),
      operator: operator?.id,
      circle: circle?.id,
      amount: Number(amount),
      pin,
      type,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const [dthDetails, setDthDetails] = useState<any>(null);

  /**
   * A rejected recharge is news, not a state the retailer is stuck in, so it
   * shows as a toast and clears itself. The error is drained out of the action
   * as it is shown, otherwise it would re-fire the toast on the next render.
   */
  const [toast, setToast] = useState('');
  const failures = [recharge, plans, dthInfo, checkStatus];
  useEffect(() => {
    const failed = failures.find((a) => a.error);
    if (!failed) return;
    setToast(failed.error as string);
    failed.setError(null);
  }, [recharge.error, plans.error, dthInfo.error, checkStatus.error]);

  const minLength = type === 'dth' ? 6 : 10;
  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  const valid =
    !!operator &&
    // Without a circle a prepaid recharge is routed to the wrong lane, so it is
    // as required as the operator itself.
    (type !== 'prepaid' || !!circle) &&
    number.trim().length >= minLength &&
    Number(amount) > 0 &&
    !overBalance &&
    pin.length === 4;

  const filteredOperators = useMemo(
    () =>
      (operators.data ?? []).filter((op) =>
        (op.displayname || op.name || '').toLowerCase().includes(operatorQuery.trim().toLowerCase())
      ),
    [operators.data, operatorQuery]
  );

  const onBrowsePlans = async () => {
    const payload: any = await plans.run();
    if (!payload) return;

    // The website displays the provider metadata returned alongside `data`.
    // Keep the same response shape here so the retailer can verify that the
    // number resolved to the expected operator and circle before paying.
    const meta = payload.meta || {};
    setPlanMeta(meta);
    if (meta.operator) {
      setOperator({
        id: String(meta.operator),
        name: meta.operatorName || String(meta.operator),
        displayname: meta.operatorName || String(meta.operator),
      });
    }
    if (meta.circle) {
      setCircle({ id: String(meta.circle), name: meta.circleName || String(meta.circle) });
    }

    const grouped = payload.data ?? payload;
    const flat = Array.isArray(grouped)
      ? grouped
      : Object.entries(grouped).flatMap(([group, items]: any) =>
          (Array.isArray(items) ? items : []).map((p: any) => ({ ...p, group }))
        );
    setPlanList(flat);
  };

  const onRecharge = async () => {
    setNotice('');
    const res = await recharge.run();
    if (res) {
      setNotice(res.message || 'Recharge successful.');
      setAmount('');
      setPin('');
      balances.reload();
      history.reload();
    }
  };

  return (
    <Screen
      overlay={<Toast message={toast} onHide={() => setToast('')} />}
      refreshing={history.refreshing}
      onRefresh={() => {
        history.refresh();
        balances.refresh();
        operators.refresh();
      }}
    >
      <Card>
        <CardContent>
          <Row label="Main wallet balance" value={money(available)} mono last />
        </CardContent>
      </Card>

      <Segmented options={TYPES} value={type} onChange={setType} />

      <Card>
        <CardHeader>
          <CardTitle icon="cellphone">Recharge details</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          {!!operators.error && <ErrorBanner message={operators.error} onRetry={operators.reload} />}
          {/* The provider can answer with an empty catalogue — its prepaid list
              is empty today — which is not a failure and not something the
              retailer can fix by tapping again. Say so instead of showing a
              dropdown with nothing in it. */}
          {!operators.loading && !operators.error && !(operators.data ?? []).length && (
            <Banner
              tone="warning"
              message={`No ${TYPES.find((t) => t.key === type)?.label.toLowerCase() ?? ''} operators are available from the provider right now. Please try again later.`}
            />
          )}

          {type !== 'prepaid' && <SelectField
            label="Operator"
            required
            value={operator ? operator.displayname || operator.name : ''}
            placeholder={operators.loading ? 'Loading operators…' : 'Select operator'}
            open={showOperators}
            onPress={() => setShowOperators(!showOperators)}
          />}
          {type !== 'prepaid' && showOperators && (
            <View style={styles.picker}>
              <Input
                placeholder="Search operator"
                value={operatorQuery}
                onChangeText={setOperatorQuery}
                leftIcon="magnify"
                autoCapitalize="none"
              />
              {operators.loading ? (
                <LoadingBlock />
              ) : (
                <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredOperators.map((op) => (
                    <Pressable
                      key={String(op.id)}
                      onPress={() => {
                        setOperator(op);
                        setShowOperators(false);
                        setOperatorQuery('');
                        // Plans on screen belong to the operator being replaced.
                        setPlanList([]);
                      }}
                      style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerText}>{op.displayname || op.name}</Text>
                    </Pressable>
                  ))}
                  {!filteredOperators.length && (
                    <Text style={styles.pickerEmpty}>No operators in this category</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          <Input
            label={type === 'dth' ? 'Subscriber ID' : 'Mobile number'}
            required
            value={number}
            onChangeText={(v) => {
              setNumber(v.replace(/\D/g, '').slice(0, 15));
              if (type === 'prepaid') {
                setPlanMeta(null);
                setOperator(null);
                setCircle(null);
                setPlanList([]);
              }
            }}
            keyboardType="number-pad"
            placeholder={type === 'dth' ? 'Customer ID' : '10-digit mobile number'}
            leftIcon={type === 'dth' ? 'television' : 'phone-outline'}
            autoComplete={type === 'dth' ? undefined : 'tel'}
          />

          {!!planMeta && type === 'prepaid' && (
            <View style={styles.detectedOperator}>
              {planMeta.logo ? (
                <Image source={{ uri: planMeta.logo }} style={styles.operatorLogo} resizeMode="contain" />
              ) : (
                <View style={styles.operatorLogoFallback}>
                  <Text style={styles.operatorLogoFallbackText}>SIM</Text>
                </View>
              )}
              <View style={styles.detectedText}>
                <Text style={styles.detectedLabel}>Number detected as</Text>
                <Text style={styles.detectedName}>{planMeta.operatorName || planMeta.operator || 'Unknown operator'}</Text>
                <Text style={styles.detectedCircle}>{planMeta.circleName || planMeta.circle || 'Circle unavailable'}</Text>
              </View>
              <Text style={styles.detectedCheck}>✓</Text>
            </View>
          )}

          <View style={styles.toolbar}>
            {type === 'prepaid' && (
              <Button
                variant="outline"
                size="sm"
                icon="format-list-bulleted"
                onPress={onBrowsePlans}
                loading={plans.pending}
                disabled={number.trim().length < 10}
                style={styles.flex}
              >
                Browse plans
              </Button>
            )}
            {type === 'dth' && (
              <Button
                variant="outline"
                size="sm"
                icon="information-outline"
                onPress={async () => setDthDetails(await dthInfo.run())}
                loading={dthInfo.pending}
                disabled={!operator || number.trim().length < 6}
                style={styles.flex}
              >
                Fetch DTH info
              </Button>
            )}
          </View>
          {/* A greyed-out button with no reason attached is unreportable: a
              retailer cannot tell it apart from a broken one, and neither can
              support. Name whichever requirement is still missing. */}
          {type === 'prepaid' && (!operator || !circle || number.trim().length < 10) && (
            <Text style={styles.hint}>
              {!operator || !circle
                ? 'Browse plans to detect the operator and circle.'
                : `Enter all 10 digits to browse plans (${number.trim().length}/10 entered).`}
            </Text>
          )}

          {!!dthDetails && (
            <View style={styles.infoBox}>
              <Row label="Customer" value={dthDetails.customerName || dthDetails.name} />
              <Row label="Balance" value={dthDetails.balance ? money(dthDetails.balance) : '—'} />
              <Row label="Monthly recharge" value={dthDetails.MonthlyRecharge || '—'} />
              <Row label="Next recharge" value={dthDetails.NextRechargeDate || '—'} last />
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

          {!!notice && <SuccessBanner message={notice} />}
          <Button
            onPress={onRecharge}
            disabled={!valid}
            loading={recharge.pending}
            icon="flash-outline"
            size="lg"
            fullWidth
          >
            Recharge
          </Button>
        </CardContent>
      </Card>

      {planList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle icon="format-list-bulleted">Available plans</CardTitle>
          </CardHeader>
          <CardContent>
            {planList.slice(0, 40).map((plan: any, i: number) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.plan, pressed && { opacity: 0.7 }]}
                onPress={() => setAmount(String(plan.rs ?? plan.amount ?? ''))}
                accessibilityRole="button"
                accessibilityLabel={`Select plan ${money(plan.rs ?? plan.amount)}`}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planAmount}>{money(plan.rs ?? plan.amount)}</Text>
                  <Text style={styles.planDesc} numberOfLines={3}>
                    {plan.desc || plan.description || plan.group}
                  </Text>
                </View>
                {!!plan.validity && <Text style={styles.planValidity}>{plan.validity}</Text>}
              </Pressable>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="history">Recharge history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Number" value={txn.metadata?.caNumber} />
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
                {/* Operators settle asynchronously: a PENDING row can still
                    flip to SUCCESS or FAILED minutes later. */}
                {String(txn.status).toUpperCase() === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon="refresh"
                    onPress={async () => {
                      const res = await checkStatus.run(txn.transactionId);
                      if (res) history.reload();
                    }}
                    loading={checkStatus.pending}
                    style={{ marginTop: space.sm }}
                    fullWidth
                  >
                    Check operator status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState icon="flash-outline" title="No recharges yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  toolbar: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
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
  hint: { fontSize: t.caption, color: c.mutedForeground },
  detectedOperator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.infoSubtle,
    borderWidth: 1,
    borderColor: c.info,
  },
  operatorLogo: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.card },
  operatorLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
  },
  operatorLogoFallbackText: { fontSize: t.micro, fontWeight: '800', color: c.mutedForeground },
  detectedText: { flex: 1, minWidth: 0, gap: 2 },
  detectedLabel: { fontSize: t.micro, color: c.info },
  detectedName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  detectedCircle: { fontSize: t.caption, color: c.mutedForeground },
  detectedCheck: { fontSize: t.bodyLg, fontWeight: '800', color: c.success },
  infoBox: { padding: space.md, borderRadius: radius.md, backgroundColor: c.secondary },
  plan: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  planInfo: { flex: 1, minWidth: 0, gap: 3 },
  planAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  planDesc: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
  planValidity: { fontSize: t.micro, color: c.mutedForeground },
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

export default RechargeScreen;
