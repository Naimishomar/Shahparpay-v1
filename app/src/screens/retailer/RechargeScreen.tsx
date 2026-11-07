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
  ErrorBanner,
  SkeletonRows,
  SectionTitle,
  Segmented,
  Toast,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';
import { BrandMark } from '@/components/ui/BrandMark';
import { useTheme } from '@/context/ThemeContext';

const TYPES = [
  { key: 'prepaid', label: 'Prepaid' },
  { key: 'dth', label: 'DTH' },
  { key: 'history', label: 'History' },
];

interface Operator {
  id: string | number;
  name: string;
  displayname?: string;
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
  /** When it happened; defaults to now (a fresh payment). */
  date?: string;
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
            {new Date(receipt.date ?? Date.now())
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
  String(plan?.description || '').match(/\d+(\.\d+)?\s?(GB|MB)(\s?\/\s?day)?/i)?.[0] ?? '—';

const rupee = (value: any) => money(value).replace(/\.00$/, '');

const spaced = (n: string) => (n.length > 5 ? `${n.slice(0, 5)} ${n.slice(5)}` : n);

const MOBILE = /^[6-9]\d{9}$/;

/** The website's receipt status: accepted is not the same as recharged. */
const receiptStatus = (res: any) => {
  const d = res?.data || {};
  if (res?.pending || String(d.status).toUpperCase() === 'PENDING') return 'PENDING';
  return d.status === false || d.response_code === 0 ? 'FAILED' : 'SUCCESS';
};

/** Same rows as the website's Transaction Receipt. */
const rechargeReceipt = (r: {
  status: string;
  amount: any;
  number?: string;
  operator?: string;
  transactionId?: string;
  operatorRef?: string;
  date?: string;
}): PayReceipt => {
  const s = String(r.status || '').toUpperCase();
  return {
    settled: s === 'SUCCESS',
    heading: s === 'PENDING' ? 'Recharge Pending' : s === 'FAILED' ? 'Recharge Failed' : 'Recharge Successful',
    amount: rupee(r.amount),
    date: r.date,
    rows: [
      { label: 'Status', value: s || 'N/A' },
      { label: 'Number', value: r.number },
      { label: 'Operator', value: r.operator },
      { label: 'Transaction ID', value: r.transactionId, dashBefore: true },
      { label: 'Operator Ref', value: r.operatorRef || 'N/A' },
    ],
  };
};

export const RechargeScreen: React.FC = () => {
  // Home's DTH shortcut opens straight onto the DTH tab.
  const route = useRoute<any>();
  const [type, setType] = useState<string>(route.params?.type ?? 'prepaid');

  // Prepaid. The provider resolves operator and circle from the number during
  // the plan lookup; they are kept for the recharge request, not typed in.
  const [mobile, setMobile] = useState('');
  const [resolvedOperator, setResolvedOperator] = useState('');
  const [resolvedCircle, setResolvedCircle] = useState('');
  const [planMeta, setPlanMeta] = useState<any>(null);
  const [planList, setPlanList] = useState<any[]>([]);
  // Which plan category tab is showing, and the plan search. Display only.
  const [planGroup, setPlanGroup] = useState('');
  const [planQuery, setPlanQuery] = useState('');
  const [prepaidAmount, setPrepaidAmount] = useState('');

  // DTH.
  const [dthNumber, setDthNumber] = useState('');
  const [dthOperator, setDthOperator] = useState<Operator | null>(null);
  const [showOperators, setShowOperators] = useState(false);
  const [operatorQuery, setOperatorQuery] = useState('');
  const [dthAmount, setDthAmount] = useState('');

  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);

  const isDth = type === 'dth';
  const amount = isDth ? dthAmount : prepaidAmount;
  const setAmount = isDth ? setDthAmount : setPrepaidAmount;
  const number = isDth ? dthNumber.trim() : mobile;

  // The website loads only the DTH list: prepaid has no operator to pick.
  const operators = useAsync<Operator[]>(async () => {
    const res = await api.getRechargeOperators('dth');
    // A refused list is not an empty list — say why.
    if (!res.success) throw new Error(res.message || 'Could not load dth operators');
    return res.data ?? [];
  }, []);

  const history = useAsync<any[]>(async () => (await api.getRechargeHistory()).data ?? [], []);

  const plans = useAction(async () => {
    const res = await api.browseRechargePlans({ mobileNumber: mobile });
    return res?.success ? res : null;
  });

  const recharge = useAction(async () => {
    const res = await api.doRecharge(
      isDth
        ? { type, dthNumber: dthNumber.trim(), operator: dthOperator?.id, amount: dthAmount, pin }
        : { type, mobileNumber: mobile, operator: resolvedOperator, circle: resolvedCircle, amount: prepaidAmount, pin }
    );
    if (!res.success) throw new Error(res.message);
    return res;
  });

  /**
   * A rejected call is news, not a state the retailer is stuck in, so it shows
   * as a toast and clears itself. The error is drained out of the action as it
   * is shown, otherwise it would re-fire the toast on the next render.
   */
  const [toast, setToast] = useState<{ message: string; tone?: 'error' | 'info' }>({ message: '' });
  const say = (message: string, tone: 'error' | 'info' = 'error') => setToast({ message, tone });
  const failures = [recharge, plans];
  useEffect(() => {
    const failed = failures.find((a) => a.error);
    if (!failed) return;
    say(failed.error || 'Failed to connect to server');
    failed.setError(null);
  }, [recharge.error, plans.error]);

  const filteredOperators = useMemo(
    () =>
      (operators.data ?? []).filter((op) =>
        (op.displayname || op.name || '').toLowerCase().includes(operatorQuery.trim().toLowerCase())
      ),
    [operators.data, operatorQuery]
  );

  const onBrowsePlans = async () => {
    if (!MOBILE.test(mobile)) return say('Please enter a valid 10-digit mobile number.');
    const payload: any = await plans.run();
    if (!payload) return;
    const meta = payload.meta || {};
    setPlanMeta({
      ...meta,
      logo: meta.logo || payload.logo || payload.data?.logo || null,
      operatorName: meta.operatorName || payload.operatorname || payload.data?.operatorname || null,
      circleName: meta.circleName || payload.circalname || payload.data?.circalname || null,
    });
    setResolvedOperator(meta.operator ? String(meta.operator) : '');
    setResolvedCircle(meta.circle ? String(meta.circle) : '');

    // `data` holds the plans by category (TOPUP, 3G/4G, ...).
    const grouped = payload.data || {};
    const flat: any[] = [];
    Object.keys(grouped).forEach((category) => {
      if (!Array.isArray(grouped[category])) return;
      grouped[category].forEach((p: any) =>
        flat.push({
          category,
          amount: p.rs || p.amount,
          description: p.desc || p.description,
          validity: p.validity,
        })
      );
    });
    setPlanList(flat);
    setPlanGroup(String(flat[0]?.category ?? ''));
    setPlanQuery('');
    if (!flat.length) say('No active plans were returned. You can enter the recharge amount manually.', 'info');
  };

  // The website's checks, in its words. The PIN is collected by the PIN step.
  const onRechargePress = () => {
    if (isDth) {
      if (!dthNumber.trim() || !dthOperator || !dthAmount || Number(dthAmount) < 10) return say('Please fill all fields.');
    } else {
      if (!MOBILE.test(mobile) || !prepaidAmount) return say('Enter mobile number, amount and transaction PIN.');
      if (!resolvedOperator || !resolvedCircle)
        return say('Please browse plans first so the operator and circle can be detected.');
    }
    setStep('pin');
  };

  const operatorName = isDth
    ? dthOperator?.displayname || dthOperator?.name || ''
    : planMeta?.operatorName || resolvedOperator;

  const onRecharge = async () => {
    const res = await recharge.run();
    if (!res) return;
    const d = res.data || {};
    setReceipt(
      rechargeReceipt({
        status: receiptStatus(res),
        amount,
        number,
        operator: isDth ? dthOperator?.name || 'Unknown' : d.operatorname || d.operator || resolvedOperator,
        transactionId: d.transactionId || d.ackno || d.refid || 'TXN' + Date.now(),
        operatorRef: d.opr_txn_id || d.operatorid || d.operator_ref,
      })
    );
    setPin('');
    setStep('form');
    if (isDth) {
      setDthNumber('');
      setDthAmount('');
    } else {
      setMobile('');
      setPrepaidAmount('');
    }
    history.reload();
  };

  const toastNode = <Toast message={toast.message} tone={toast.tone} onHide={() => setToast({ message: '' })} />;

  if (step === 'pin') {
    return (
      <PinStep
        payee={`Recharging ${isDth ? number : spaced(number)}`}
        amount={Number(amount)}
        detail={`${operatorName} · from Utility Wallet`}
        pin={pin}
        onPin={setPin}
        onSubmit={() => pin.length === 4 && onRecharge()}
        onClose={() => {
          setPin('');
          setStep('form');
        }}
        pending={recharge.pending}
        overlay={toastNode}
      />
    );
  }

  const hasPlans = type === 'prepaid' && planList.length > 0;
  const pq = planQuery.trim().toLowerCase();
  const planGroups = Array.from(new Set(planList.map((p: any) => String(p.category ?? '')).filter(Boolean)));
  // The website's search: amount or validity, across every category.
  const shownPlans = pq
    ? planList.filter((p: any) =>
        [p.amount, p.validity].some((v) => v && String(v).toLowerCase().includes(pq))
      )
    : planGroup
      ? planList.filter((p: any) => String(p.category ?? '') === planGroup)
      : planList;
  const selectedPlan = planList.find((p: any) => !!amount && String(p.amount) === amount);
  const rechargeLabel = Number(amount) > 0 ? `Recharge ${rupee(amount)}` : 'Recharge';

  const amountField = (
    <Field
      label="Amount"
      prefix="₹"
      value={amount}
      onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
      keyboardType="number-pad"
      placeholder="0"
    />
  );

  return (
    <>
      <Screen
        overlay={
          <>
            {toastNode}
            {hasPlans && (
              <View style={styles.payBar}>
                <Btn label={rechargeLabel} onPress={onRechargePress} />
              </View>
            )}
          </>
        }
        refreshing={history.refreshing}
        onRefresh={() => {
          history.refresh();
          operators.refresh();
        }}
      >
        <Segmented options={TYPES} value={type} onChange={setType} scroll={false} />

        {type === 'prepaid' && (
          <>
            <Field
              label="Mobile Number"
              prefix="+91"
              value={spaced(mobile)}
              onChangeText={(v) => {
                setMobile(v.replace(/\D/g, '').slice(0, 10));
                setResolvedOperator('');
                setResolvedCircle('');
                setPlanMeta(null);
                setPlanList([]);
              }}
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
              autoComplete="tel"
            />
            <Btn
              ghost
              icon="format-list-bulleted"
              label="Browse Plans"
              onPress={onBrowsePlans}
              loading={plans.pending}
              disabled={!MOBILE.test(mobile)}
            />

            {!!resolvedOperator && !!resolvedCircle && (
              <View style={styles.opCard}>
                {planMeta?.logo ? (
                  <Image source={{ uri: planMeta.logo }} style={styles.opAvatar} resizeMode="contain" />
                ) : (
                  <View style={styles.opAvatar}>
                    <Text style={styles.opAvatarText}>{String(operatorName).slice(0, 3)}</Text>
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={styles.opNumber} numberOfLines={1}>
                    {operatorName}
                  </Text>
                  <Text style={styles.opMeta} numberOfLines={1}>
                    {spaced(mobile)} • {planMeta?.circleName || resolvedCircle}
                  </Text>
                </View>
              </View>
            )}

            {amountField}
            {!hasPlans && <Btn label={rechargeLabel} onPress={onRechargePress} loading={recharge.pending} />}

            {hasPlans && (
              <View style={styles.plans}>
                <SectionTitle>{`Available Plans for ${mobile}`}</SectionTitle>
                <View style={styles.search}>
                  <Ionicons name="search-outline" size={22} color={colors.mutedForeground} />
                  <TextInput
                    value={planQuery}
                    onChangeText={setPlanQuery}
                    placeholder="Search by amount or validity (e.g., 299 or 28 Days)"
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
                    <Text style={styles.detailTitle}>{rupee(selectedPlan.amount)} Plan detail</Text>
                    <View style={styles.detailCard}>
                      {[
                        ['Data', dataOf(selectedPlan)],
                        ['Validity', selectedPlan.validity ? String(selectedPlan.validity) : '—'],
                        ['Amount', rupee(selectedPlan.amount)],
                      ].map(([label, value]) => (
                        <View key={label} style={styles.detailCol}>
                          <Text style={styles.detailLabel}>{label}</Text>
                          <Text style={styles.detailValue} numberOfLines={1} adjustsFontSizeToFit>
                            {value}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {!!selectedPlan.description && (
                      <Text style={styles.detailText}>{selectedPlan.description}</Text>
                    )}
                  </View>
                )}

                <View style={styles.card}>
                  {shownPlans.length ? (
                    shownPlans.map((plan: any, i: number, all: any[]) => {
                      const price = String(plan.amount ?? '');
                      const picked = !!price && price === amount;
                      return (
                        <Pressable
                          key={`${plan.category}-${price}-${i}`}
                          onPress={() => setPrepaidAmount(price)}
                          style={({ pressed }) => [styles.planRow, i === all.length - 1 && styles.rowLast, pressed && styles.pressed]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: picked }}
                          accessibilityLabel={`${rupee(price)} plan, Validity: ${plan.validity ?? ''}`}
                        >
                          <View style={styles.flex}>
                            <Text style={styles.planAmount}>{rupee(price)}</Text>
                            {!!plan.description && (
                              <Text style={styles.planDesc} numberOfLines={2}>
                                {plan.description}
                              </Text>
                            )}
                          </View>
                          {!!plan.validity && <Text style={styles.planValidity}>{`Validity: ${plan.validity}`}</Text>}
                          <View style={[styles.radio, picked && styles.radioOn]}>{picked && <View style={styles.radioDot} />}</View>
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.empty}>No plan matches that search</Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {isDth && (
          <>
            {!!operators.error && <ErrorBanner message={operators.error} onRetry={operators.reload} />}
            <Field
              label="DTH Number"
              value={dthNumber}
              onChangeText={setDthNumber}
              maxLength={20}
              autoCapitalize="characters"
              placeholder="Enter DTH Number"
            />
            <Field
              label="DTH Operator"
              value={dthOperator ? dthOperator.displayname || dthOperator.name : ''}
              placeholder="Select DTH Operator"
              open={showOperators}
              onPress={() => setShowOperators(!showOperators)}
            />
            {showOperators && (
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
                          setDthOperator(op);
                          setShowOperators(false);
                          setOperatorQuery('');
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
            )}

            {amountField}
            <Btn label={rechargeLabel} onPress={onRechargePress} loading={recharge.pending} />
          </>
        )}

        {type === 'history' && (
          <>
            <SectionTitle>Recharge History</SectionTitle>
            <View style={styles.card}>
              {history.loading ? (
                <SkeletonRows count={3} />
              ) : history.data?.length ? (
                history.data.map((txn: any, i: number, all: any[]) => (
                  <Pressable
                    key={txn._id || txn.transactionId}
                    onPress={() =>
                      setReceipt(
                        rechargeReceipt({
                          status: txn.status,
                          amount: txn.amount,
                          number: txn.metadata?.caNumber,
                          operator: txn.metadata?.operatorName || txn.metadata?.operator,
                          transactionId: txn.transactionId,
                          operatorRef: txn.metadata?.operatorTxnId,
                          date: txn.createdAt,
                        })
                      )
                    }
                    style={({ pressed }) => [styles.rowI, i === all.length - 1 && styles.rowLast, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityHint="Opens the receipt"
                  >
                    <IconTile icon="cellphone" size={44} iconSize={20} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {txn.metadata?.caNumber || '—'}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[txn.metadata?.operatorName || txn.metadata?.operator, shortDate(txn.createdAt)].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1} selectable>
                        {txn.transactionId}
                      </Text>
                      <Text style={styles.rowLink}>Receipt</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{money(txn.amount)}</Text>
                      <StatusText status={txn.status} />
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.empty}>No recharge transaction found</Text>
              )}
            </View>
          </>
        )}
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
}));

export default RechargeScreen;
