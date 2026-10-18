import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, motion, radius, space, type as t, TOUCH } from '../../theme/colors';
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
  /**
   * Pinned above the scroll, not inside it — a Toast placed in the content
   * would be positioned against the scrolled page and slide away with it.
   */
  overlay?: React.ReactNode;
  /** Shown instead of the content while `loading` — shaped like the screen. */
  skeleton?: React.ReactNode;
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
  overlay,
  skeleton,
}) => {
  const { padding, gap } = useResponsive();

  const scroll = (
    <ScrollView
      style={styles.scrollView}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.content,
        // The app bar already leaves the gap the design wants above the content.
        header ? null : { padding, paddingTop: space.xs, paddingBottom: padding * 2, gap },
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
          // marginTop, not a reduced paddingTop: React Native clamps negative
          // padding to zero. And no paddingTop at all — with `padding` still
          // applied, a 16pt top padding ate most of a 28pt pull-up and the card
          // barely touched the band. The band's own bottom padding is the gap.
          header
            ? {
                paddingHorizontal: padding,
                paddingBottom: padding * 2,
                marginTop: -headerOverlap,
              }
            : null,
        ]}
      >
        {!!error && <Banner tone="error" message={error} action={onRetry && { label: 'Retry', onPress: onRetry }} />}
        {loading ? (skeleton ?? <LoadingBlock />) : children}
      </View>
    </ScrollView>
  );

  // Only pay for the extra wrapper when something actually needs to float.
  if (!overlay) return scroll;
  return (
    <View style={styles.scrollView}>
      {scroll}
      {overlay}
    </View>
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

/**
 * Skeleton kit. Each piece has the exact footprint of the real thing it stands
 * in for — a list row, a grid of service circles, a form field — so content
 * lands where the placeholder was instead of jumping.
 */

/** Rows of a transaction/list card: icon circle, two lines, amount + status. */
export const SkeletonRows: React.FC<{ count?: number; avatar?: number; amount?: boolean }> = ({
  count = 4,
  avatar = 44,
  amount = true,
}) => (
  <View accessibilityRole="progressbar" accessibilityLabel="Loading">
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={[styles.skRow, index === count - 1 && styles.skRowLast]}>
        <Skeleton width={avatar} height={avatar} radius={avatar / 2} />
        <View style={styles.skLines}>
          <Skeleton width="58%" height={14} />
          <Skeleton width="38%" height={11} />
        </View>
        {amount && (
          <View style={styles.skRight}>
            <Skeleton width={72} height={14} />
            <Skeleton width={48} height={11} />
          </View>
        )}
      </View>
    ))}
  </View>
);

/** Round service buttons with a label under each, four to a row. */
export const SkeletonGrid: React.FC<{ count?: number; size?: number }> = ({ count = 8, size = 56 }) => (
  <View style={styles.skGrid} accessibilityElementsHidden importantForAccessibility="no">
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={styles.skGridItem}>
        <Skeleton width={size} height={size} radius={size / 2} />
        <Skeleton width={56} height={11} />
      </View>
    ))}
  </View>
);

/** A labelled form field. */
export const SkeletonField: React.FC = () => (
  <View style={styles.skField} accessibilityElementsHidden importantForAccessibility="no">
    <Skeleton width={110} height={12} />
    <Skeleton height={52} radius={radius.md} />
  </View>
);

/** A card, optionally with a title line, around other skeleton pieces. */
export const SkeletonCard: React.FC<{ title?: boolean; children?: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  title,
  children,
  style,
}) => (
  <View style={[styles.skCard, style]}>
    {title && <Skeleton width="44%" height={16} style={styles.skCardTitle} />}
    {children}
  </View>
);

/** A section heading ("Title ✦ ——"). */
export const SkeletonTitle: React.FC = () => (
  <View style={styles.skTitle} accessibilityElementsHidden importantForAccessibility="no">
    <Skeleton width={140} height={16} />
    <View style={styles.sectionRule} />
  </View>
);

/** Fallback for a screen without its own skeleton: a card of list rows. */
export const LoadingBlock: React.FC<{ label?: string; rows?: number }> = ({ label, rows = 4 }) => (
  <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
    <SkeletonTitle />
    <SkeletonCard>
      <SkeletonRows count={rows} />
    </SkeletonCard>
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
        { backgroundColor: colors[spec.bg] as string },
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

/**
 * Transient feedback for something that just happened — a rejected recharge, a
 * lookup that failed. A banner is for a state the retailer is still in; an
 * action that already finished is news, and pinning it above the form leaves
 * stale red text to scroll past on the next attempt.
 *
 * Hand-rolled because React Native's only built-in toast is ToastAndroid, which
 * does nothing on iOS, and this is too small to justify a dependency. Mounted
 * from a screen rather than a provider: it needs no state beyond its message.
 */
export const Toast: React.FC<{
  message: string;
  tone?: Tone;
  duration?: number;
  onHide: () => void;
}> = ({ message, tone = 'error', duration = 4000, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  // Held in a ref so the timer is not restarted by a re-render, and so the
  // dismissal always calls the handler this toast was mounted with.
  const hide = useRef(onHide);
  hide.current = onHide;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => finished && hide.current()
      );
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, opacity]);

  if (!message) return null;

  const spec = TONES[tone];
  return (
    <Animated.View
      style={[styles.toast, { opacity, backgroundColor: colors[spec.bg] as string }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons name={spec.icon as any} size={18} color={colors[spec.fg] as string} />
      <Text style={[styles.toastText, { color: colors[spec.fg] as string }]}>{message}</Text>
      {/* A toast that vanishes on its own still has to be dismissable: a long
          message can outlast its own timer for someone reading slowly. */}
      <Pressable onPress={() => hide.current()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
        <MaterialCommunityIcons name="close" size={16} color={colors[spec.fg] as string} />
      </Pressable>
    </Animated.View>
  );
};

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
  // BHIM writes a status as coloured words, not a filled pill; the word itself
  // carries the meaning, so nothing rests on colour alone.
  return (
    <Text style={[styles.pillText, { color: fg }]} numberOfLines={1}>
      {label.charAt(0) + label.slice(1).toLowerCase()}
    </Text>
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

/**
 * BHIM's section heading: the title, a small four-point star, and a hairline
 * running to the edge ("Plan Details ✦ ————"). With an action, the action
 * takes the line's place.
 */
export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
  children,
  action,
}) => (
  <View style={styles.sectionTitle}>
    <Text style={styles.sectionTitleText} accessibilityRole="header">
      {children}
    </Text>
    {action ? (
      <>
        <View style={styles.sectionSpacer} />
        {action}
      </>
    ) : (
      <>
        <MaterialCommunityIcons
          name="star-four-points"
          size={11}
          color={colors.mutedForeground}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={styles.sectionRule} />
      </>
    )}
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
        style={({ pressed }) => [
          styles.chip,
          // Non-scrolling: the options share one track and split it evenly,
          // so the control reads as a switch rather than a row of filters.
          !scroll && styles.chipFlush,
          active && (scroll ? styles.chipActive : styles.chipFlushActive),
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={option.label}
      >
        <Text
          style={[styles.chipText, active && (scroll ? styles.chipTextActive : styles.chipTextFlushActive)]}
          numberOfLines={1}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (!scroll) return <View style={styles.chipGroup}>{body}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow: 0 — react-native-web's ScrollView base style grows, so on a
      // short page (a tab whose body is only a couple of tiles) the strip ate
      // the leftover height and every chip stretched with it.
      style={styles.chipScroll}
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
  if (!Number.isFinite(n)) return '₹\u00A00.00';
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
  // A no-break space after the symbol, as the design writes it ("₹ 24,580.00"),
  // so the symbol never wraps away from its number.
  return `₹\u00A0${n < 0 ? '-' : ''}${grouped}.${frac}`;
};

/**
 * Local YYYY-MM-DD for the API's date filters. Not `toISOString().slice(0,10)`:
 * that converts to UTC first, so local midnight in IST lands on the previous
 * day and a "this month" query starts in the month before.
 */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  // Transparent so the layout's TopGlow shows behind the first screenful.
  scrollView: { flex: 1 },
  content: { flexGrow: 1 },
  body: { flexGrow: 1 },
  loading: { gap: space.md },
  skRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  skRowLast: { borderBottomWidth: 0 },
  skLines: { flex: 1, gap: 7 },
  skRight: { alignItems: 'flex-end', gap: 7 },
  skGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  skGridItem: { width: '25%', alignItems: 'center', gap: space.sm },
  skField: { gap: space.sm },
  skCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  skCardTitle: { marginTop: space.sm, marginBottom: space.lg },
  skTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  loadingLabel: { fontSize: t.small, color: c.mutedForeground },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    // BHIM's notes: a quiet tinted card with the tone's icon, no edge bar.
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: t.small, lineHeight: 19 },
  bannerAction: { fontSize: t.small, fontWeight: '600', minWidth: 44, textAlign: 'right' },
  // Floats clear of the form and above the tab bar, so it never covers the
  // field the retailer is about to correct.
  toast: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { flex: 1, fontSize: t.small, lineHeight: 19 },
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
  emptyText: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, textAlign: 'center' },
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
  emptyActionText: { fontSize: t.small, fontWeight: '600', color: c.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 1,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: t.caption, fontWeight: '500' },
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
    fontWeight: '500',
    color: c.foreground,
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: { fontVariant: ['tabular-nums'] },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  sectionTitleText: { flexShrink: 1, fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  sectionSpacer: { flex: 1 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xs },
  // Filter chips: outlined pills; the selected one fills in.
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: 'transparent',
  },
  chipActive: { backgroundColor: c.surfaceAlt, borderColor: c.foreground },
  // A switch between views: BHIM's text tabs over a hairline, the current one
  // underlined in orange ("Pending | Completed").
  chipGroup: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderStrong,
  },
  chipFlush: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    backgroundColor: 'transparent',
    minHeight: 46,
  },
  chipFlushActive: { borderBottomColor: c.highlight },
  chipTextFlushActive: { color: c.foreground, fontWeight: '500' },
  chipText: { fontSize: t.body, fontWeight: '400', color: c.mutedForeground },
  chipTextActive: { color: c.foreground, fontWeight: '500' },
}));

export default Screen;
