import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  TextInputProps,
  ActivityIndicator,
  Modal,
  Share,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useModalInsets } from '@/hooks';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { IconTile, GradientFill } from '@/components/ui/Gradient';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Input';
import { TopGlow } from '@/components/ui/TopGlow';
import {
  Screen,
  Banner,
  ErrorBanner,
  SkeletonRows,
  Row,
  SectionTitle,
  Segmented,
  Toast,
  money,
  shortDate,
  Skeleton,
  SkeletonCard,
  SkeletonTitle,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';
import { PAYSPRINT_ENABLED } from '@/constants/services';
import { BrandMark } from '@/components/ui/BrandMark';
import { useTheme } from '@/context/ThemeContext';

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

/* ---------- primitives shared with the BBPS and DMT screens ---------- */

/**
 * BHIM's field: label above, a filled box with a hairline edge. With
 * `onPress` it is a tap-to-open select instead of an input.
 */
export const Field: React.FC<
  TextInputProps & {
    label: string;
    onPress?: () => void;
    open?: boolean;
    prefix?: string;
    right?: React.ReactNode;
    error?: string;
    helper?: string;
  }
> = ({ label, onPress, open, prefix, right, error, helper, value, placeholder, ...input }) => {
  const [focused, setFocused] = useState(false);
  if (onPress) {
    return (
      <View style={styles.fieldWrap}>
        <SelectField label={label} value={value} placeholder={placeholder} open={open} onPress={onPress} error={error} />
        {!!helper && !error && <Text style={styles.fieldHelper}>{helper}</Text>}
      </View>
    );
  }
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocus, !!error && styles.fieldError]}>
        {!!prefix && <Text style={styles.fieldPrefix}>{prefix}</Text>}
        <TextInput
          {...input}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={styles.fieldInput}
        />
        {right}
      </View>
      {!!error && (
        <Text style={styles.fieldErrorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {!!helper && !error && <Text style={styles.fieldHelper}>{helper}</Text>}
    </View>
  );
};

/** The app's pill buttons: orange for the one action, outlined for the rest. */
export const Btn: React.FC<{
  label: string;
  onPress: () => void;
  ghost?: boolean;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}> = ({ label, onPress, ghost, small, disabled, loading, icon }) => (
  <Button
    variant={ghost ? 'outline' : 'default'}
    size={small ? 'sm' : 'default'}
    onPress={onPress}
    disabled={disabled}
    loading={loading}
    icon={icon}
    fullWidth={!small}
    accessibilityLabel={label}
  >
    {label}
  </Button>
);

/** Success / Pending / Failed as a small coloured caption, never a filled pill. */
export const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status ?? '').toUpperCase();
  const [label, color] =
    s === 'SUCCESS' || s === 'COMPLETED'
      ? ['Success', colors.success]
      : s === 'FAILED' || s === 'REFUNDED' || s === 'REJECTED'
        ? [s === 'REFUNDED' ? 'Refunded' : 'Failed', colors.destructive]
        : ['Pending', colors.warning];
  return <Text style={[styles.status, { color }]}>{label}</Text>;
};

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** The app's own keypad: plain, large keys. `last` is the bottom row. */
export const Keypad: React.FC<{
  last: string[];
  onKey: (key: string) => void;
  okDisabled?: boolean;
  busy?: boolean;
}> = ({ last, onKey, okDisabled, busy }) => (
  <View style={styles.keys}>
    {[...KEY_ROWS, last].map((row, r) => (
      <View key={r} style={styles.keyRow}>
        {row.map((key) =>
          !key ? (
            <View key="blank" style={styles.key} />
          ) : (
            <Pressable
              key={key}
              onPress={() => onKey(key)}
              disabled={busy || (key === 'ok' && okDisabled)}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Delete' : key === 'ok' ? 'Confirm' : key === '.' ? 'Point' : key}
              accessibilityState={{ disabled: !!busy || (key === 'ok' && !!okDisabled) }}
            >
              {key === 'back' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.foreground} />
              ) : key === 'ok' ? (
                <View style={[styles.ok, okDisabled && !busy && styles.disabled]}>
                  {busy ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="checkmark" size={28} color={colors.primaryForeground} />
                  )}
                </View>
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          )
        )}
      </View>
    ))}
  </View>
);

/**
 * Shahparpay's own wallet PIN — the logo, what is being paid, four dots and
 * the app's keypad. Never styled like an NPCI UPI PIN pad. No Modal of its
 * own, so a flow that already owns one (DMT) can show it as a step.
 */
export const PinBody: React.FC<{
  payee: string;
  amount: number;
  detail: string;
  pin: string;
  onPin: (pin: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** Where "Forgot PIN?" leaves from; defaults to onClose. */
  onForgot?: () => void;
  pending?: boolean;
  error?: string | null;
}> = ({ payee, amount, detail, pin, onPin, onSubmit, onClose, onForgot, pending, error }) => {
  const navigation = useNavigation<any>();
  const insets = useModalInsets();
  const dark = useTheme().resolvedTheme === 'dark';
  return (
    <View style={[styles.flowRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TopGlow />
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.flowTop}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.flowIcon} accessibilityRole="button" accessibilityLabel="Cancel">
          <Ionicons name="close" size={26} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.pinBody} bounces={false}>
        <View style={styles.logo}>
          <BrandMark size={28} color={colors.primaryForeground} />
        </View>
        <Text style={styles.pinPayee} numberOfLines={1}>
          {payee}
        </Text>
        <Text style={styles.pinAmount}>{money(amount).replace(/\.00$/, '')}</Text>
        <Text style={styles.pinDetail}>{detail}</Text>
        <Text style={styles.pinTitle} accessibilityRole="header">
          Enter Shahparpay wallet PIN
        </Text>
        <View style={styles.pinDots} accessible accessibilityLabel={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotOn]} />
          ))}
        </View>
        {!!error && (
          <Text style={styles.pinError} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {pending ? (
          <Text style={styles.forgot}>Sending…</Text>
        ) : (
          <Pressable
            onPress={() => {
              (onForgot ?? onClose)();
              navigation.navigate('Profile');
            }}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Forgot PIN? Change it in Profile"
          >
            <Text style={styles.forgot}>Forgot PIN?</Text>
          </Pressable>
        )}
      </ScrollView>
      <Keypad
        last={['back', '0', 'ok']}
        busy={pending}
        okDisabled={pin.length !== 4}
        onKey={(k) =>
          k === 'ok' ? onSubmit() : k === 'back' ? onPin(pin.slice(0, -1)) : pin.length < 4 && onPin(pin + k)
        }
      />
    </View>
  );
};

/** PinBody as its own full-screen layer, for the screens that are not a flow. */
export const PinStep: React.FC<React.ComponentProps<typeof PinBody> & { overlay?: React.ReactNode }> = ({
  overlay,
  ...props
}) => (
  <Modal visible animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
    <PinBody {...props} />
    {overlay}
  </Modal>
);

export interface PayReceipt {
  /** false: accepted but not yet confirmed by the bank or operator. */
  settled: boolean;
  heading: string;
  amount: string;
  rows: { label: string; value?: string | null; dashBefore?: boolean }[];
}

/**
 * BHIM's success: full-bleed green, a white tick badge, the amount, then the
 * receipt card over the fold. A payment still awaiting confirmation gets a
 * neutral band and a clock instead — it has not succeeded yet.
 */
export const DoneBody: React.FC<{ receipt: PayReceipt; onDone: () => void; shareTitle: string }> = ({
  receipt,
  onDone,
  shareTitle,
}) => {
  const insets = useModalInsets();
  const dark = useTheme().resolvedTheme === 'dark';
  const ink = receipt.settled ? colors.primaryForeground : colors.foreground;
  const shareText = [shareTitle, '', receipt.heading, `Amount : ${receipt.amount}`]
    .concat(receipt.rows.filter((r) => r.value).map((r) => `${r.label} : ${r.value}`))
    .join('\n');
  return (
    <View style={styles.flowRoot}>
      <StatusBar barStyle={receipt.settled || dark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.flowScroll} bounces={false}>
        <View style={[styles.succ, !receipt.settled && styles.succPending, { paddingTop: 40 + insets.top }]}>
          {receipt.settled && <GradientFill stops={[colors.success, colors.glowGreen]} />}
          <MaterialCommunityIcons
            name={receipt.settled ? 'check-decagram' : 'clock-outline'}
            size={76}
            color={receipt.settled ? colors.primaryForeground : colors.warning}
          />
          <Text style={[styles.succTitle, { color: ink }]} accessibilityRole="header">
            {receipt.heading}
          </Text>
          <Text style={[styles.succAmount, { color: ink }]}>{receipt.amount}</Text>
          <Text style={[styles.succDate, { color: ink }]}>
            {new Date()
              .toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })
              .replace(/am|pm/i, (m) => m.toUpperCase())}
          </Text>
        </View>
        <View style={styles.receipt}>
          {receipt.rows
            .filter((r) => r.value)
            .map((r) => (
              <React.Fragment key={r.label}>
                {r.dashBefore && <View style={styles.dash} />}
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>{r.label}</Text>
                  <Text style={styles.kvValue} selectable>
                    {r.value}
                  </Text>
                </View>
              </React.Fragment>
            ))}
        </View>
      </ScrollView>
      <View style={[styles.doneBar, { paddingBottom: space.lg + insets.bottom }]}>
        <View style={styles.flex}>
          <Button
            variant="outline"
            icon="share-variant-outline"
            fullWidth
            onPress={() => Share.share({ message: shareText }).catch(() => {})}
          >
            Share
          </Button>
        </View>
        <View style={styles.flex}>
          <Button fullWidth onPress={onDone}>
            Done
          </Button>
        </View>
      </View>
    </View>
  );
};

/** First "2 GB/day" / "500 MB" in a plan's text — the Data column of the card. */
const dataOf = (plan: any) =>
  String(plan?.desc || plan?.description || '').match(/\d+(\.\d+)?\s?(GB|MB)(\s?\/\s?day)?/i)?.[0] ?? '—';

const priceOf = (plan: any) => String(plan?.rs ?? plan?.amount ?? '');
const rupee = (value: any) => money(value).replace(/\.00$/, '');

const spaced = (n: string) => (n.length > 5 ? `${n.slice(0, 5)} ${n.slice(5)}` : n);

export const RechargeScreen: React.FC = () => {
  // Home's DTH shortcut opens straight onto the DTH tab.
  const route = useRoute<any>();
  const [type, setType] = useState<string>(route.params?.type ?? 'prepaid');
  const [operator, setOperator] = useState<Operator | null>(null);
  const [showOperators, setShowOperators] = useState(false);
  const [operatorQuery, setOperatorQuery] = useState('');
  // A prepaid recharge is routed by circle as well as operator, and the circle is
  // a provider code rather than a name, so the list has to come from the provider.
  const [circle, setCircle] = useState<Circle | null>(null);
  const [planList, setPlanList] = useState<any[]>([]);
  const [planMeta, setPlanMeta] = useState<any>(null);
  // Which plan category tab is showing, and the plan search. Display only.
  const [planGroup, setPlanGroup] = useState('');
  const [planQuery, setPlanQuery] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);

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
  // Everything but the PIN, which the PIN step collects.
  const ready =
    !!operator &&
    // Without a circle a prepaid recharge is routed to the wrong lane, so it is
    // as required as the operator itself.
    (type !== 'prepaid' || !!circle) &&
    number.trim().length >= minLength &&
    Number(amount) > 0 &&
    !overBalance;
  const valid = ready && pin.length === 4;

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
    setPlanGroup(String(flat[0]?.group ?? ''));
    // The first plan starts selected; it is only an amount until the retailer
    // confirms with the PIN.
    setAmount(flat[0] ? priceOf(flat[0]) : '');
  };

  // The provider derives operator and circle from the number, so the lookup
  // runs as soon as all ten digits are in.
  useEffect(() => {
    if (type === 'prepaid' && number.length === 10 && !planMeta && !plans.pending) onBrowsePlans();
  }, [number, type]);

  const planGroups = Array.from(new Set(planList.map((p: any) => String(p.group ?? '')).filter(Boolean)));
  const pq = planQuery.trim().toLowerCase().replace(/[₹\s]/g, '');
  // A search looks across every tab, as BHIM's does.
  const shownPlans = pq
    ? planList.filter((p: any) =>
        [priceOf(p), p.desc, p.description, p.validity].some((v) =>
          String(v ?? '').toLowerCase().replace(/\s/g, '').includes(pq)
        )
      )
    : planGroup
      ? planList.filter((p: any) => String(p.group ?? '') === planGroup)
      : planList;
  const selectedPlan = planList.find((p: any) => !!amount && priceOf(p) === amount);
  // A retailer's own pick ("Change") wins over what the number was detected as.
  const operatorName = String(
    operator?.displayname || operator?.name || planMeta?.operatorName || planMeta?.operator || 'Unknown operator'
  );

  const onRecharge = async () => {
    const res = await recharge.run();
    if (res) {
      // An operator can accept a recharge before confirming it, so the wording
      // must not claim it has landed.
      const settled = !res.pending;
      setReceipt({
        settled,
        heading: settled ? `Recharged ${spaced(number)}` : 'Recharge submitted, awaiting operator',
        amount: rupee(amount),
        rows: [
          { label: type === 'dth' ? 'Subscriber ID' : 'Mobile number', value: type === 'dth' ? number : spaced(number) },
          { label: 'Operator', value: operator?.displayname || operator?.name },
          { label: 'Circle', value: type === 'prepaid' ? circle?.name : null },
          { label: 'Operator ref', value: res.data?.txnId || res.data?.operatorRef, dashBefore: true },
          { label: 'Transaction ID', value: res.data?.transactionId, dashBefore: !(res.data?.txnId || res.data?.operatorRef) },
          { label: 'Status', value: settled ? null : res.message },
        ],
      });
      setAmount('');
      setPin('');
      setStep('form');
      balances.reload();
      history.reload();
    }
  };

  const toastNode = <Toast message={toast} onHide={() => setToast('')} />;

  if (step === 'pin') {
    return (
      <PinStep
        payee={`Recharging ${type === 'dth' ? number : spaced(number)}`}
        amount={Number(amount)}
        detail={`${operator?.displayname || operator?.name || ''} · from Main wallet`}
        pin={pin}
        onPin={setPin}
        onSubmit={() => valid && onRecharge()}
        onClose={() => {
          setPin('');
          setStep('form');
        }}
        pending={recharge.pending}
        overlay={toastNode}
      />
    );
  }

  const operatorPicker = showOperators && (
    <View style={styles.picker}>
      <Field label="Search operator" value={operatorQuery} onChangeText={setOperatorQuery} autoCapitalize="none" />
      {operators.loading ? (
        <SkeletonRows count={5} amount={false} avatar={36} />
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
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
          {!filteredOperators.length && <Text style={styles.pickerEmpty}>No operators in this category</Text>}
        </ScrollView>
      )}
    </View>
  );

  const hasPlans = type === 'prepaid' && planList.length > 0;

  // BHIM keeps "Proceed to Pay" pinned under the plans.
  const payBar = hasPlans && (
    <View style={styles.payBar}>
      {overBalance && <Text style={styles.payBarError}>Amount exceeds your main wallet balance</Text>}
      <Btn
        label={Number(amount) > 0 ? `Proceed to Pay ${rupee(amount)}` : 'Proceed to Pay'}
        onPress={() => setStep('pin')}
        disabled={!ready}
      />
    </View>
  );

  return (
    <>
      <Screen
        overlay={
          <>
            {toastNode}
            {payBar}
          </>
        }
        refreshing={history.refreshing}
        onRefresh={() => {
          history.refresh();
          balances.refresh();
          operators.refresh();
        }}
      >
        <Segmented options={TYPES} value={type} onChange={setType} scroll={false} />

        {!!operators.error && <ErrorBanner message={operators.error} onRetry={operators.reload} />}
        {/* The provider can answer with an empty catalogue — its prepaid list
            is empty today — which is not a failure and not something the
            retailer can fix by tapping again. Postpaid and DTH need a pick
            from it, so say so there. */}
        {type !== 'prepaid' && !operators.loading && !operators.error && !(operators.data ?? []).length && (
          <Banner
            tone="warning"
            message={`No ${TYPES.find((x) => x.key === type)?.label.toLowerCase() ?? ''} operators are available from the provider right now. Please try again later.`}
          />
        )}

        {type !== 'prepaid' && (
          <Field
            label="Operator"
            value={operator ? operator.displayname || operator.name : ''}
            placeholder={operators.loading ? 'Loading operators…' : 'Select operator'}
            open={showOperators}
            onPress={() => setShowOperators(!showOperators)}
          />
        )}
        {type !== 'prepaid' && operatorPicker}

        <Field
            label={type === 'dth' ? 'Subscriber ID' : 'Mobile number'}
            value={type === 'dth' ? number : spaced(number)}
            onChangeText={(v) => {
              setNumber(v.replace(/\D/g, '').slice(0, type === 'dth' ? 15 : 10));
              if (type === 'prepaid') {
                setPlanMeta(null);
                setOperator(null);
                setCircle(null);
                setPlanList([]);
              }
            }}
            keyboardType="number-pad"
            placeholder={type === 'dth' ? 'Customer ID' : '10-digit mobile number'}
            autoComplete={type === 'dth' ? undefined : 'tel'}
            right={
              type === 'prepaid' && plans.pending ? (
                <ActivityIndicator style={styles.fieldSpinner} size="small" color={colors.mutedForeground} />
              ) : null
            }
            helper={
              type === 'prepaid' && number.length < 10
                ? `Enter all 10 digits to detect the operator and circle (${number.length}/10)`
                : undefined
            }
          />

        {/* While the number is being looked up: the operator card and the plan
            list, as shapes, where they are about to appear. */}
        {type === 'prepaid' && plans.pending && !planMeta && (
          <View style={styles.skel}>
            <SkeletonCard>
              <SkeletonRows count={1} amount={false} />
            </SkeletonCard>
            <SkeletonTitle />
            <Skeleton height={48} radius={24} />
            <SkeletonCard>
              <SkeletonRows count={4} />
            </SkeletonCard>
          </View>
        )}
        {!!planMeta && type === 'prepaid' && (
          <View style={styles.opCard}>
            {planMeta.logo ? (
              <Image source={{ uri: planMeta.logo }} style={styles.opAvatar} resizeMode="contain" />
            ) : (
              <View style={styles.opAvatar}>
                <Text style={styles.opAvatarText}>{operatorName.slice(0, 3)}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.opNumber} numberOfLines={1}>
                {operatorName}
              </Text>
              <Text style={styles.opMeta} numberOfLines={1}>
                {spaced(number)} • {planMeta.circleName || planMeta.circle || 'Circle unavailable'}
              </Text>
            </View>
            {/* Only offered when there is something to change to. */}
            {!!(operators.data ?? []).length && (
              <Pressable
                onPress={() => setShowOperators(!showOperators)}
                style={({ pressed }) => [styles.changePill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Change operator"
              >
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            )}
          </View>
        )}
        {type === 'prepaid' && operatorPicker}
        {type === 'prepaid' && !!planMeta && !(planMeta.circle || circle) && (
          <Text style={styles.hint}>The provider did not return a circle for this number.</Text>
        )}

        {/* DTH customer details are PaySprint's (HLR lookup); Icchhamati has no equivalent. */}
        {PAYSPRINT_ENABLED && type === 'dth' && (
          <Btn
            ghost
            icon="information-outline"
            label="Fetch DTH info"
            onPress={async () => setDthDetails(await dthInfo.run())}
            loading={dthInfo.pending}
            disabled={!operator || number.trim().length < 6}
          />
        )}
        {!!dthDetails && (
          <View style={styles.card}>
            <Row label="Customer" value={dthDetails.customerName || dthDetails.name} />
            <Row label="Balance" value={dthDetails.balance ? money(dthDetails.balance) : '—'} />
            <Row label="Monthly recharge" value={dthDetails.MonthlyRecharge || '—'} />
            <Row label="Next recharge" value={dthDetails.NextRechargeDate || '—'} last />
          </View>
        )}

        {hasPlans ? (
          <View style={styles.plans}>
            <SectionTitle>Search by amount or plan validity</SectionTitle>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={22} color={colors.mutedForeground} />
              <TextInput
                value={planQuery}
                onChangeText={setPlanQuery}
                placeholder="Search for a plan, eg ₹35 or 2 GB, etc"
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
                accessibilityLabel="Search plans"
              />
              {!!planQuery && (
                <Pressable onPress={() => setPlanQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {planGroups.length > 1 && !pq && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabs}
              >
                {planGroups.map((g) => {
                  const on = g === planGroup;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setPlanGroup(g)}
                      style={[styles.tab, on && styles.tabOn]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]}>{g}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {!!selectedPlan && (
              <View>
                <Text style={styles.detailTitle}>{rupee(priceOf(selectedPlan))} Plan detail</Text>
                <View style={styles.detailCard}>
                  {[
                    ['Data', dataOf(selectedPlan)],
                    [
                      'Validity',
                      selectedPlan.validity && selectedPlan.validity !== 'NA' ? String(selectedPlan.validity) : '—',
                    ],
                    ['Amount', rupee(priceOf(selectedPlan))],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.detailCol}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue} numberOfLines={1} adjustsFontSizeToFit>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
                {!!(selectedPlan.desc || selectedPlan.description) && (
                  <>
                    <View style={styles.detailGap}>
                      <SectionTitle>Plan Details</SectionTitle>
                    </View>
                    <Text style={styles.detailText}>{selectedPlan.desc || selectedPlan.description}</Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.detailGap}>
              <SectionTitle>{pq ? `Plans matching “${planQuery.trim()}”` : 'All plans'}</SectionTitle>
            </View>
            <View style={styles.card}>
              {shownPlans.length ? (
                shownPlans.slice(0, 40).map((plan: any, i: number, all: any[]) => {
                  const price = priceOf(plan);
                  const picked = !!price && price === amount;
                  const validity = plan.validity && plan.validity !== 'NA' ? String(plan.validity) : '';
                  return (
                    <Pressable
                      key={`${price}-${i}`}
                      onPress={() => setAmount(price)}
                      style={({ pressed }) => [styles.planRow, i === all.length - 1 && styles.rowLast, pressed && styles.pressed]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: picked }}
                      accessibilityLabel={`${rupee(price)} plan${validity ? `, ${validity}` : ''}`}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.planAmount}>{rupee(price)}</Text>
                        {!!(plan.desc || plan.description) && (
                          <Text style={styles.planDesc} numberOfLines={2}>
                            {plan.desc || plan.description}
                          </Text>
                        )}
                      </View>
                      {!!validity && <Text style={styles.planValidity}>{validity}</Text>}
                      <View style={[styles.radio, picked && styles.radioOn]}>{picked && <View style={styles.radioDot} />}</View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.empty}>No plan matches that search</Text>
              )}
            </View>
          </View>
        ) : (
          (type !== 'prepaid' || !!planMeta) && (
            <>
              <Field
                label="Amount"
                prefix="₹"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                error={overBalance ? 'Amount exceeds your main wallet balance' : undefined}
                helper={`Main wallet balance ${money(available)}`}
              />
              <Btn
                label={Number(amount) > 0 ? `Recharge ${rupee(amount)}` : 'Recharge'}
                onPress={() => setStep('pin')}
                disabled={!ready}
              />
            </>
          )
        )}

        <View style={styles.detailGap}>
          <SectionTitle>Recent recharges</SectionTitle>
        </View>
        <View style={styles.card}>
          {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any, i: number, all: any[]) => (
              <View key={txn._id || txn.transactionId} style={[styles.rowI, i === all.length - 1 && styles.rowLast]}>
                <IconTile icon="cellphone" size={44} iconSize={20} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {txn.metadata?.caNumber || txn.transactionId}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[txn.metadata?.operatorName, shortDate(txn.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                  {/* Operators settle asynchronously: a PENDING row can still
                      flip to SUCCESS or FAILED minutes later. */}
                  {String(txn.status).toUpperCase() === 'PENDING' && (
                    <Pressable
                      onPress={async () => {
                        const res = await checkStatus.run(txn.transactionId);
                        if (res) history.reload();
                      }}
                      disabled={checkStatus.pending}
                      hitSlop={12}
                      accessibilityRole="button"
                    >
                      <Text style={styles.rowLink}>{checkStatus.pending ? 'Checking…' : 'Check operator status'}</Text>
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
            <Text style={styles.empty}>No recharges yet</Text>
          )}
        </View>
      </Screen>

      <Modal visible={!!receipt} animationType="slide" onRequestClose={() => setReceipt(null)} statusBarTranslucent>
        {!!receipt && (
          <DoneBody receipt={receipt} shareTitle="SHAHPARPAY — RECHARGE" onDone={() => setReceipt(null)} />
        )}
      </Modal>
    </>
  );
};

const styles = themed((c) => ({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  hint: { fontSize: t.caption, color: c.mutedForeground },

  // Field — matches the shared Input.
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.input,
    backgroundColor: c.surface,
  },
  fieldFocus: { borderColor: c.focus },
  fieldError: { borderColor: c.destructive },
  fieldPrefix: { fontSize: 16, color: c.mutedForeground },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 16,
    color: c.foreground,
    ...({ outlineStyle: 'none' } as any),
  },
  fieldSpinner: { marginRight: 4 },
  fieldErrorText: { fontSize: t.caption, color: c.destructive },
  fieldHelper: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 16 },

  status: { fontSize: t.caption, fontWeight: '500' },

  // Operator card — "919838612359 / Jio • UP(East)" with a Change pill.
  opCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  opAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  opAvatarText: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  opNumber: { fontSize: t.bodyLg, fontWeight: '400', color: c.foreground, fontVariant: ['tabular-nums'] },
  opMeta: { fontSize: t.small, color: c.mutedForeground, marginTop: 2 },
  changePill: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: { fontSize: t.body, color: c.foreground },

  picker: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  pickerList: { maxHeight: 260 },
  pickerItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  pickerItemPressed: { opacity: 0.6 },
  pickerText: { fontSize: t.body, color: c.foreground },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },

  // Plans
  plans: { gap: space.lg },
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
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: t.body,
    color: c.foreground,
    paddingVertical: space.sm,
    ...({ outlineStyle: 'none' } as any),
  },
  tabsScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -space.lg },
  tabs: {
    gap: space.xxl,
    paddingHorizontal: space.lg,
  },
  tab: { paddingVertical: space.md, borderBottomWidth: 2, borderBottomColor: 'transparent', minHeight: 44 },
  tabOn: { borderBottomColor: c.highlight },
  tabText: { fontSize: t.bodyLg - 1, color: c.mutedForeground },
  tabTextOn: { color: c.foreground },

  detailTitle: { fontSize: t.title + 2, fontWeight: '400', color: c.foreground, marginBottom: space.md },
  detailCard: {
    flexDirection: 'row',
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
  },
  detailCol: { flex: 1, minWidth: 0, gap: 4 },
  detailLabel: { fontSize: t.body, color: c.foreground },
  detailValue: { fontSize: t.bodyLg + 1, fontWeight: '400', color: c.foreground, fontVariant: ['tabular-nums'] },
  detailGap: { marginTop: space.sm },
  detailText: { fontSize: t.body, lineHeight: 24, color: c.foreground, marginTop: space.md },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  planAmount: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, fontVariant: ['tabular-nums'] },
  planDesc: { fontSize: t.small, color: c.mutedForeground, marginTop: 2, lineHeight: 18 },
  planValidity: { fontSize: t.small, color: c.foreground },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: c.foreground },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.foreground },

  payBar: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: c.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  payBarError: { fontSize: t.caption, color: c.destructive, textAlign: 'center' },

  // List card + rows (Home's idiom)
  card: { paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  rowI: {
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
  empty: { fontSize: t.small, color: c.mutedForeground, paddingVertical: space.lg, textAlign: 'center' },

  // Full-screen steps: PIN and success.
  flowRoot: { flex: 1, backgroundColor: c.background },
  flowScroll: { flexGrow: 1 },
  flowTop: { paddingHorizontal: space.lg, paddingTop: space.sm },
  flowIcon: { width: 44, height: 44, justifyContent: 'center' },
  pinBody: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  pinPayee: { fontSize: t.body, color: c.foreground, marginTop: space.lg },
  pinAmount: { fontSize: 40, fontWeight: '300', color: c.foreground, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  pinDetail: { fontSize: t.small, color: c.mutedForeground, textAlign: 'center', marginTop: 2 },
  pinTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginTop: space.xxxl },
  pinDots: { flexDirection: 'row', gap: 18, marginTop: space.xl, marginBottom: space.sm },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: c.mutedForeground },
  pinDotOn: { backgroundColor: c.foreground, borderColor: c.foreground },
  pinError: { fontSize: t.small, color: c.destructive, textAlign: 'center', marginTop: space.sm },
  forgot: { fontSize: t.small, fontWeight: '500', color: c.foreground, textDecorationLine: 'underline', marginTop: space.md },

  keys: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  keyRow: { flexDirection: 'row' },
  key: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  keyPressed: { backgroundColor: c.surface },
  keyText: { fontSize: 28, fontWeight: '400', color: c.foreground },
  ok: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },

  succ: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: 72,
    backgroundColor: c.success,
    overflow: 'hidden',
  },
  succPending: { backgroundColor: c.surfaceAlt },
  succTitle: { fontSize: t.body, marginTop: space.lg, textAlign: 'center' },
  succAmount: { fontSize: 48, fontWeight: '300', marginTop: space.xs, fontVariant: ['tabular-nums'] },
  succDate: { fontSize: t.small, marginTop: space.xs, opacity: 0.85 },
  receipt: {
    marginTop: -44,
    marginHorizontal: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm },
  kvLabel: { fontSize: t.small, color: c.mutedForeground },
  kvValue: { flexShrink: 1, fontSize: t.small, fontWeight: '500', color: c.foreground, textAlign: 'right' },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, marginVertical: space.sm },
  doneBar: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: c.background },
  skel: { gap: space.lg },
}));

export default RechargeScreen;
