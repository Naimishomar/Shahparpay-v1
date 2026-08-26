import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { useResponsive } from '@/hooks/useResponsive';

interface ScreenProps {
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
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
        { padding, paddingBottom: padding * 2, gap },
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
      {!!error && <Banner tone="error" message={error} action={onRetry && { label: 'Retry', onPress: onRetry }} />}
      {loading ? <LoadingBlock /> : children}
    </ScrollView>
  );
};

export const LoadingBlock: React.FC<{ label?: string }> = ({ label }) => (
  <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
    <ActivityIndicator size="large" color={colors.accent} />
    {!!label && <Text style={styles.loadingLabel}>{label}</Text>}
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
      style={[styles.banner, { backgroundColor: colors[spec.bg] as string }]}
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

/** Equal-share responsive grid: 1 column on an SE, 4 on a tablet. */
export const Grid: React.FC<{ children: React.ReactNode; columns?: number; style?: StyleProp<ViewStyle> }> = ({
  children,
  columns,
  style,
}) => {
  const { columnWidth, gap, contentWidth } = useResponsive();
  const width = columns ? Math.floor((contentWidth - gap * (columns - 1)) / columns) : columnWidth;
  return (
    <View style={[styles.grid, { gap }, style]}>
      {React.Children.map(children, (child) =>
        child ? <View style={{ width }}>{child}</View> : null
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

/** ₹ with tabular grouping so columns of amounts stay aligned. */
export const money = (value: any) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const styles = themed((c) => ({
  scrollView: { flex: 1, backgroundColor: c.background },
  content: { flexGrow: 1 },
  loading: { paddingVertical: 56, alignItems: 'center', gap: space.md },
  loadingLabel: { fontSize: t.small, color: c.mutedForeground },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: t.small, lineHeight: 19 },
  bannerAction: { fontSize: t.small, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: space.xxl, gap: space.sm },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: c.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptyText: { fontSize: t.body, fontWeight: '600', color: c.foreground, textAlign: 'center' },
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
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: t.micro, fontWeight: '700', letterSpacing: 0.2 },
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
  sectionTitleText: { fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
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
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  chipTextActive: { color: c.primaryForeground },
}));

export default Screen;
