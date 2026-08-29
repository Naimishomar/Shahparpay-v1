import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { Input } from './Input';
import { Button } from './Button';
import { Sheet } from './Sheet';
import {
  Banner,
  EmptyState,
  Grid,
  LoadingBlock,
  Row,
  Segmented,
  StatusPill,
  dateTime,
  money,
} from './Screen';
import { useResponsive } from '@/hooks/useResponsive';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks';

export interface ReportColumn {
  label: string;
  value: (item: any) => React.ReactNode;
}

interface Props {
  /** Fetcher receives the active date range; returns the raw row list. */
  fetcher: (range: { startDate?: string; endDate?: string }) => Promise<any[]>;
  /** Fields concatenated for the search box. */
  searchFields: (item: any) => string;
  amountOf?: (item: any) => number;
  statusOf?: (item: any) => string | undefined;
  titleOf: (item: any) => string;
  subtitleOf?: (item: any) => string;
  dateOf?: (item: any) => string | undefined;
  /** Extra rows shown when a row is expanded into the detail sheet. */
  details: ReportColumn[];
  /**
   * Summary tiles above the list. Defaults to count/volume/success/failed,
   * which suits transaction reports; a ledger overrides it with the money
   * columns that actually matter there (commission, TDS, GST, net).
   */
  summary?: (rows: any[]) => SummaryTile[];
  /** Status values offered in the filter sheet. Ledgers use CREDIT/DEBIT. */
  statuses?: readonly string[];
  emptyTitle?: string;
  emptyIcon?: string;
}

export interface SummaryTile {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'error';
}

const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function rangeToDates(key: RangeKey): { startDate?: string; endDate?: string } {
  if (key === 'all') return {};
  const end = new Date();
  const start = new Date();
  if (key === 'today') start.setHours(0, 0, 0, 0);
  if (key === '7d') start.setDate(start.getDate() - 7);
  if (key === '30d') start.setDate(start.getDate() - 30);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

const STATUSES = ['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const;

/**
 * One engine behind every report screen: date range, search, status filter,
 * running totals, a virtualised list, and a tap-through detail sheet.
 *
 * FlatList rather than mapping inside a ScrollView — these lists routinely run
 * to a thousand rows.
 */
export const TransactionReport: React.FC<Props> = ({
  fetcher,
  searchFields,
  amountOf = (i) => Number(i?.amount ?? 0),
  statusOf = (i) => i?.status,
  titleOf,
  subtitleOf,
  dateOf = (i) => i?.createdAt,
  details,
  summary,
  statuses = STATUSES,
  emptyTitle = 'Nothing to report yet',
  emptyIcon = 'chart-box-outline',
}) => {
  const { padding, gap } = useResponsive();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>('30d');
  const [status, setStatus] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Filtering a thousand rows on every keystroke re-rendered the whole list
  // and made typing visibly lag.
  const debouncedQuery = useDebounce(query, 200);

  const report = useAsync<any[]>(() => fetcher(rangeToDates(range)), [range]);

  const rows = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    return (report.data ?? []).filter((item) => {
      if (status !== 'ALL' && String(statusOf(item) ?? '').toUpperCase() !== status) return false;
      if (!term) return true;
      return searchFields(item).toLowerCase().includes(term);
    });
  }, [report.data, debouncedQuery, status, statusOf, searchFields]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, item) => {
          const amount = amountOf(item);
          const s = String(statusOf(item) ?? '').toUpperCase();
          acc.count += 1;
          acc.volume += amount;
          if (s === 'SUCCESS') acc.success += amount;
          if (s === 'FAILED') acc.failed += 1;
          return acc;
        },
        { count: 0, volume: 0, success: 0, failed: 0 }
      ),
    [rows, amountOf, statusOf]
  );

  /**
   * The accessors are called once per row here rather than five times inside
   * renderItem on every re-render, and the result is what the row component
   * memoises against.
   */
  const items = useMemo(
    () =>
      rows.map((item, index) => ({
        item,
        key: String(item?._id ?? item?.transactionId ?? item?.UTR ?? item?.SNO ?? index),
        title: titleOf(item),
        subtitle: subtitleOf?.(item) ?? '',
        date: dateTime(dateOf(item)),
        amount: money(amountOf(item)),
        status: statusOf(item),
      })),
    [rows, titleOf, subtitleOf, dateOf, amountOf, statusOf]
  );

  const tiles: SummaryTile[] = useMemo(
    () =>
      summary
        ? summary(rows)
        : [
            { label: 'Transactions', value: String(totals.count) },
            { label: 'Total volume', value: money(totals.volume) },
            { label: 'Successful', value: money(totals.success), tone: 'success' },
            { label: 'Failed', value: String(totals.failed), tone: 'error' },
          ],
    [summary, rows, totals]
  );

  // Anything narrowing the list, so the filter button can show a count and the
  // empty state can offer to clear them.
  const activeFilters = (range !== 'all' ? 1 : 0) + (status !== 'ALL' ? 1 : 0);
  const clearFilters = useCallback(() => {
    setQuery('');
    setStatus('ALL');
    setRange('all');
  }, []);

  // Memoised alongside renderItem: a fresh element here re-renders the header
  // (and its four summary tiles) on every keystroke.
  const listHeader = useMemo(
    () => (
      <View style={{ gap }}>
        {!!report.error && (
          <Banner
            tone="error"
            message={report.error}
            action={{ label: 'Retry', onPress: report.reload }}
          />
        )}
        {/* Four across rather than 2x2: the four numbers are one summary and
            read as a row, and stacking them pushed the first result off the
            fold on a small phone. */}
        <Grid columns={4}>
          {tiles.map((tile) => (
            <Tile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
          ))}
        </Grid>
        {/* Range is the filter people actually change, so it sits in the open;
            status stays in the sheet with the rest. */}
        <View style={styles.rangeRow}>
          {RANGES.map((option) => {
            const active = option.key === range;
            return (
              <Pressable
                key={option.key}
                onPress={() => setRange(option.key)}
                style={[styles.rangeChip, active && styles.rangeChipOn]}
                hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
              >
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [gap, report.error, report.reload, tiles, range]
  );

  const hasFilters = !!query || activeFilters > 0;
  const listEmpty = useMemo(
    () => (
      <EmptyState
        icon={emptyIcon}
        title={hasFilters ? 'No matching entries' : emptyTitle}
        subtitle={
          hasFilters
            ? 'Try a wider date range or clear the filters.'
            : 'Completed transactions show up here.'
        }
        action={hasFilters ? { label: 'Clear filters', onPress: clearFilters } : undefined}
      />
    ),
    [emptyIcon, emptyTitle, hasFilters, clearFilters]
  );

  const keyExtractor = useCallback((row: ReportItem) => row.key, []);
  const renderItem = useCallback(
    ({ item }: { item: ReportItem }) => <ReportRow row={item} onPress={setSelected} />,
    []
  );

  return (
    <View style={styles.container}>
      {/* Search stays on the surface; the range and status pickers moved behind
          the filter button so the list starts near the top of the screen. */}
      <View style={[styles.filters, { paddingHorizontal: padding }]}>
        <Input
          containerStyle={styles.searchField}
          placeholder="Search reference, name, number"
          value={query}
          onChangeText={setQuery}
          leftIcon="magnify"
          rightIcon={query ? 'close-circle' : undefined}
          onRightIconPress={() => setQuery('')}
          rightIconLabel="Clear search"
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={({ pressed }) => [
            styles.filterButton,
            activeFilters > 0 && styles.filterButtonActive,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'
          }
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={activeFilters > 0 ? colors.accent : colors.foreground}
          />
          {activeFilters > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilters}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {report.loading ? (
        <LoadingBlock label="Loading report" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding, paddingBottom: padding * 2 + insets.bottom, gap }}
          refreshing={report.refreshing}
          onRefresh={report.refresh}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          renderItem={renderItem}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={60}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismiss}
            onPress={() => setSelected(null)}
            accessibilityLabel="Close details"
          />
          <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
            <View style={styles.sheetGrip} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selected ? titleOf(selected) : ''}
              </Text>
              <Pressable
                onPress={() => setSelected(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.sheetClose}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {!!selected && (
              <View>
                <Row label="Amount" value={money(amountOf(selected))} mono />
                <Row label="Status" value={<StatusPill status={statusOf(selected)} />} />
                <Row label="Date" value={dateTime(dateOf(selected))} />
                {details.map((col, i) => (
                  <Row
                    key={col.label}
                    label={col.label}
                    value={col.value(selected)}
                    last={i === details.length - 1}
                  />
                ))}
              </View>
            )}
            <Button variant="secondary" onPress={() => setSelected(null)} fullWidth>
              Close
            </Button>
          </View>
        </View>
      </Modal>

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        subtitle={`${rows.length} of ${report.data?.length ?? 0} entries`}
        icon="tune-variant"
        footer={
          <View style={styles.sheetActions}>
            <Button
              variant="secondary"
              onPress={() => {
                clearFilters();
                setFiltersOpen(false);
              }}
              style={styles.flex}
            >
              Clear all
            </Button>
            <Button icon="check" onPress={() => setFiltersOpen(false)} style={styles.flex}>
              Show results
            </Button>
          </View>
        }
      >
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Date range</Text>
          <Segmented
            options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            value={range}
            onChange={setRange}
          />
        </View>

        {statuses.length > 1 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <Segmented
              options={statuses.map((value) => ({
                key: value,
                label: value === 'ALL' ? 'All status' : value,
              }))}
              value={status}
              onChange={setStatus}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
};

interface ReportItem {
  item: any;
  key: string;
  title: string;
  subtitle: string;
  date: string;
  amount: string;
  status?: string;
}

/**
 * Memoised: FlatList re-renders every visible row whenever renderItem changes
 * identity, so with an inline renderItem a single keystroke re-rendered the
 * whole viewport. All the display work is already done in `items`, leaving
 * this a pure function of primitives.
 */
const ReportRow = React.memo<{ row: ReportItem; onPress: (item: any) => void }>(
  ({ row, onPress }) => (
    <Pressable
      onPress={() => onPress(row.item)}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${row.amount}, ${row.status ?? 'unknown status'}`}
    >
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {row.title}
        </Text>
        {!!row.subtitle && (
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {row.subtitle}
          </Text>
        )}
        <Text style={styles.itemDate}>{row.date}</Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemAmount} numberOfLines={1}>
          {row.amount}
        </Text>
        <StatusPill status={row.status} />
      </View>
    </Pressable>
  )
);
ReportRow.displayName = 'ReportRow';

const Tile: React.FC<{ label: string; value: string; tone?: SummaryTile['tone'] }> = ({
  label,
  value,
  tone,
}) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[
        styles.tileValue,
        tone === 'success' && { color: colors.success },
        tone === 'warning' && { color: colors.warning },
        tone === 'error' && { color: colors.destructive },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  rangeRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  rangeChip: {
    // 34 visually, with hitSlop below taking the real target past 48dp. A
    // full-height 48pt chip reads as a button row and crowds the summary.
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  rangeChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  rangeChipText: { fontSize: t.micro, fontWeight: '700', color: c.mutedForeground },
  rangeChipTextOn: { color: c.accentForeground },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  searchField: { flex: 1 },
  filterButton: {
    width: TOUCH,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.input,
    backgroundColor: c.secondary,
  },
  filterButtonActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: c.accentForeground },
  filterGroup: { gap: space.sm },
  sheetActions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  filterLabel: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  tile: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 3,
  },
  tileLabel: { fontSize: t.micro, color: c.mutedForeground, fontWeight: '600' },
  tileValue: {
    fontSize: t.bodyLg,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  itemPressed: { opacity: 0.75 },
  itemMain: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  itemSubtitle: { fontSize: t.caption, color: c.mutedForeground },
  itemDate: { fontSize: t.micro, color: c.mutedForeground },
  itemRight: { alignItems: 'flex-end', gap: 5 },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderStrong,
    alignSelf: 'center',
    marginBottom: space.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetTitle: { flex: 1, fontSize: t.bodyLg, fontWeight: '700', color: c.foreground },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
}));

export default TransactionReport;
