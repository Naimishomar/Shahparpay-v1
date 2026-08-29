import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, lift, motion, radius, space, type as t, TOUCH } from '../../theme/colors';
import { useResponsive } from '@/hooks/useResponsive';

interface ScreenProps {
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Full-bleed block rendered above the padded content — the brand-coloured
   * band the Dashboard's balance card sits on. It ignores the screen gutters
   * on purpose; anything inside it supplies its own padding.
   */
  header?: React.ReactNode;
  /**
   * Pixels the first child pulls up into `header`, so a card can overlap the
   * band it sits on. Ignored when `header` is absent.
   */
  headerOverlap?: number;
}

/**
 * Scroll shell for every screen. The page title lives in the app header, so
 * this only owns gutters, pull-to-refresh, and the loading/error states.
 */
export const Screen: React.FC<ScreenProps> = ({
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  children,
  contentStyle,
  header,
  headerOverlap = 0,
}) => {
  const { padding, gap } = useResponsive();

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.content,
        header ? null : { padding, paddingBottom: padding * 2, gap },
        contentStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mutedForeground}
            colors={[colors.accent]}
          />
        ) : undefined
      }
    >
      {header}
      <View
        style={[
          styles.body,
          { gap },
          header
            ? { padding, paddingTop: padding - headerOverlap, paddingBottom: padding * 2 }
            : null,
        ]}
      >
        {!!error && <Banner tone="error" message={error} action={onRetry && { label: 'Retry', onPress: onRetry }} />}
        {loading ? <LoadingBlock /> : children}
      </View>
    </ScrollView>
  );
};

/**
 * Shimmering placeholder. A skeleton that mirrors the shape of the content
 * about to arrive reads as "nearly there"; a centred spinner reads as "stuck",
 * which matters on the 4G these shops run on.
 */
export const Skeleton: React.FC<{
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ width = '100%', height = 14, radius: r = 6, style }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: r, backgroundColor: colors.skeleton },
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
};

/** Card-shaped skeleton used while a screen's first payload is in flight. */
export const LoadingBlock: React.FC<{ label?: string; rows?: number }> = ({ label, rows = 3 }) => (
  <View
    style={styles.loading}
    accessibilityRole="progressbar"
    accessibilityLabel={label || 'Loading'}
  >
    {Array.from({ length: rows }).map((_, index) => (
      <View key={index} style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <Skeleton width={38} height={38} radius={radius.md} />
          <View style={styles.skeletonLines}>
            <Skeleton width="62%" height={13} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      </View>
    ))}
  </View>
);

type Tone = 'error' | 'success' | 'warning' | 'info';

const TONES: Record<Tone, { icon: string; fg: keyof typeof colors; bg: keyof typeof colors }> = {
  error: { icon: 'alert-circle', fg: 'destructive', bg: 'destructiveSubtle' },
  success: { icon: 'check-circle', fg: 'success', bg: 'successSubtle' },
  warning: { icon: 'alert', fg: 'warning', bg: 'warningSubtle' },
  info: { icon: 'information', fg: 'info', bg: 'infoSubtle' },
};

/**
 * Feedback banner. Every tone pairs its colour with a distinct icon so the
 * meaning survives for colour-blind users and in monochrome.
 */
export const Banner: React.FC<{
  tone: Tone;
  message: string;
  action?: { label: string; onPress: () => void };
}> = ({ tone, message, action }) => {
  const spec = TONES[tone];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors[spec.bg] as string, borderLeftColor: colors[spec.fg] as string },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons name={spec.icon as any} size={18} color={colors[spec.fg] as string} />
      <Text style={[styles.bannerText, { color: colors[spec.fg] as string }]}>{message}</Text>
      {!!action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.bannerAction, { color: colors[spec.fg] as string }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
};

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => <Banner tone="error" message={message} action={onRetry && { label: 'Retry', onPress: onRetry }} />;

export const SuccessBanner: React.FC<{ message: string }> = ({ message }) => (
  <Banner tone="success" message={message} />
);

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}> = ({ icon = 'inbox-outline', title, subtitle, action }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <MaterialCommunityIcons name={icon as any} size={26} color={colors.mutedForeground} />
    </View>
    <Text style={styles.emptyText}>{title}</Text>
    {!!subtitle && <Text style={styles.emptySubtext}>{subtitle}</Text>}
    {!!action && (
      <Pressable
        onPress={action.onPress}
        style={({ pressed }) => [styles.emptyAction, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={styles.emptyActionText}>{action.label}</Text>
      </Pressable>
    )}
  </View>
);

const STATUS: Record<string, { tone: Tone; icon: string }> = {
  SUCCESS: { tone: 'success', icon: 'check-circle' },
  APPROVED: { tone: 'success', icon: 'check-circle' },
  ACTIVE: { tone: 'success', icon: 'check-circle' },
  COMPLETED: { tone: 'success', icon: 'check-circle' },
  PENDING: { tone: 'warning', icon: 'clock-outline' },
  PROCESSING: { tone: 'warning', icon: 'clock-outline' },
  FAILED: { tone: 'error', icon: 'close-circle' },
  REJECTED: { tone: 'error', icon: 'close-circle' },
  INACTIVE: { tone: 'error', icon: 'close-circle' },
  REFUNDED: { tone: 'info', icon: 'undo' },
  // Ledger rows carry a direction rather than a status. Money in is green,
  // money out stays neutral-info so a debit never reads as a failure.
  CREDIT: { tone: 'success', icon: 'arrow-down-left' },
  DEBIT: { tone: 'info', icon: 'arrow-up-right' },
};

/** Status is never colour-only: each state carries its own glyph and label. */
export const StatusPill: React.FC<{ status?: string | null }> = ({ status }) => {
  const label = (status || 'UNKNOWN').toUpperCase();
  const spec = STATUS[label];
  const fg = spec ? (colors[TONES[spec.tone].fg] as string) : colors.mutedForeground;
  const bg = spec ? (colors[TONES[spec.tone].bg] as string) : colors.secondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={(spec?.icon ?? 'help-circle-outline') as any} size={11} color={fg} />
      <Text style={[styles.pillText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/**
 * Equal-share responsive grid: 1 column on an SE, 4 on a tablet.
 *
 * Children are measured against the grid's OWN width, not the screen's. Sizing
 * off the screen meant a grid nested in a card overflowed it by exactly the
 * card's horizontal padding — invisible at two columns on a wide phone, and
 * clipped everywhere else.
 *
 * `contentWidth` seeds the first paint so nothing renders at zero width; the
 * measured value takes over on layout.
 */
export const Grid: React.FC<{
  children: React.ReactNode;
  columns?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, columns, style }) => {
  const { columns: autoColumns, gap, contentWidth } = useResponsive();
  const [available, setAvailable] = useState(contentWidth);

  const count = Math.max(1, columns ?? autoColumns);
  const width = Math.floor((available - gap * (count - 1)) / count);

  return (
    <View
      style={[styles.grid, { gap }, style]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        // Guarded: the children are fixed-width, so they cannot feed their own
        // size back into the container — but re-setting an identical value
        // would still re-render the whole grid on every layout pass.
        setAvailable((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
      }}
    >
      {React.Children.map(children, (child) =>
        child ? <View style={{ width: Math.max(0, width) }}>{child}</View> : null
      )}
    </View>
  );
};

/** Label/value row used by every detail and summary card. */
export const Row: React.FC<{
  label: string;
  value?: React.ReactNode;
  last?: boolean;
  mono?: boolean;
}> = ({ label, value, last, mono }) => (
  <View style={[styles.row, last && styles.rowLast]}>
    <Text style={styles.rowLabel} numberOfLines={2}>
      {label}
    </Text>
    {typeof value === 'string' || typeof value === 'number' ? (
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={2} selectable>
        {value}
      </Text>
    ) : (
      value ?? <Text style={styles.rowValue}>—</Text>
    )}
  </View>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
  children,
  action,
}) => (
  <View style={styles.sectionTitle}>
    <Text style={styles.sectionTitleText} accessibilityRole="header">
      {children}
    </Text>
    {action}
  </View>
);

/** Tabs/segmented control. Horizontal scroll so labels never shrink. */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  scroll = true,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  scroll?: boolean;
}) => {
  const body = options.map((option) => {
    const active = option.key === value;
    return (
      <Pressable
        key={option.key}
        onPress={() => onChange(option.key)}
        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={option.label}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (!scroll) return <View style={styles.chipRow}>{body}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {body}
    </ScrollView>
  );
};

/**
 * ₹ with Indian grouping (last three digits, then pairs) so columns of amounts
 * stay aligned.
 *
 * Hand-rolled rather than `toLocaleString('en-IN')`: this runs once per row
 * per report, and Intl is ~40x slower on Node and worse under Hermes — it was
 * the bulk of the frame time on a filtered thousand-row ledger. Output is
 * byte-identical to the previous implementation (see Screen.test.mjs).
 */
export const money = (value: any) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '₹0.00';
  // toPrecision(15) collapses binary noise (1.005 is really 1.00499…) before
  // rounding, so ties round half-up the way Intl does. toFixed alone rounds
  // those down and the amount is a paisa short of the web portal's. 15 rather
  // than 12: at crore magnitudes 12 significant digits is too coarse and
  // rounds the paisa the other way (see the sweep in Screen.test.mjs).
  const cents = Math.round(Number((Math.abs(n) * 100).toPrecision(15)));
  const whole = String(Math.floor(cents / 100));
  const frac = String(cents % 100).padStart(2, '0');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  // \B avoids a leading comma; pairs are matched from the right.
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `₹${n < 0 ? '-' : ''}${grouped}.${frac}`;
};

export const shortDate = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    : '—';

export const dateTime = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const styles = themed((c, isDark) => ({
  scrollView: { flex: 1, backgroundColor: c.background },
  content: { flexGrow: 1 },
  body: { flexGrow: 1 },
  loading: { gap: space.md },
  loadingLabel: { fontSize: t.small, color: c.mutedForeground },
  skeletonCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skeletonLines: { flex: 1, gap: space.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    // A 3px leading rule in the tone colour gives the banner an edge to scan
    // to, so it reads as a distinct object rather than a tinted paragraph.
    borderLeftWidth: 3,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: t.small, lineHeight: 19 },
  bannerAction: { fontSize: t.small, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: space.xxxl, gap: space.sm },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: c.secondary,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptyText: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground, textAlign: 'center' },
  emptySubtext: {
    fontSize: t.caption,
    color: c.mutedForeground,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: space.lg,
  },
  emptyAction: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  emptyActionText: { fontSize: t.small, fontWeight: '700', color: c.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 1,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: t.micro, fontWeight: '700', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: t.small, color: c.mutedForeground, flexShrink: 1 },
  rowValue: {
    fontSize: t.small,
    fontWeight: '600',
    color: c.foreground,
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: { fontVariant: ['tabular-nums'] },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.xs,
  },
  sectionTitleText: { fontSize: t.title, fontWeight: '700', color: c.foreground, letterSpacing: -0.3 },
  chipRow: { flexDirection: 'row', gap: space.sm, paddingRight: space.xs },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary, ...lift('sm', isDark) },
  chipText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  chipTextActive: { color: c.primaryForeground },
}));

export default Screen;
