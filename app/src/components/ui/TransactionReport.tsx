import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Modal, TextInput, ActivityIndicator, Platform, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { IconTile } from './Gradient';
import {
  Banner,
  EmptyState,
  Grid,
  Skeleton,
  SkeletonCard,
  SkeletonRows,
  SkeletonTitle,
  Row,
  Segmented,
  dateTime,
  isoDate,
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
  /** Everything in the range at once — for the short histories (ITR, PAN…). */
  fetcher?: (range: { startDate?: string; endDate?: string }) => Promise<any[]>;
  /**
   * One page at a time, filtered and totalled by the server — for the long
   * lists (History, the transaction reports, the ledger). Search, status and
   * the chip are sent along instead of being applied on the phone.
   */
  pageFetcher?: (args: PageArgs) => Promise<PageResult>;
  /** Tiles from the server's totals; defaults to count / volume / success / failed. */
  summaryFrom?: (summary: any) => SummaryTile[];
  /** Fields concatenated for the search box. */
  searchFields: (item: any) => string;
  amountOf?: (item: any) => number;
  statusOf?: (item: any) => string | undefined;
  titleOf: (item: any) => string;
  subtitleOf?: (item: any) => string;
  dateOf?: (item: any) => string | undefined;
  /**
   * Which way the money went, for the + / − sign and the green credit amount.
   * Defaults to the row status when that is CREDIT/DEBIT (the ledgers).
   */
  flowOf?: (item: any) => 'in' | 'out' | undefined;
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
  /** Also the row's icon chip. */
  emptyIcon?: string;
  /** Per-row icon chip, when one report mixes transaction types. */
  iconOf?: (item: any) => string;
  /**
   * Type chips (mockup 15). When given they replace the summary tiles and the
   * range row, and the last chip opens the filter sheet.
   */
  chips?: { key: string; label: string; match: (item: any) => boolean }[];
  searchPlaceholder?: string;
  /** Extra sheet content under the filters; `close` dismisses the sheet. */
  filterExtra?: (close: () => void) => React.ReactNode;
  /** Scrolls above the rows, e.g. History's summary and report links. */
  header?: React.ReactNode;
}

/** Success / Pending / Failed, as small coloured text (BHIM: no filled pills). */
const TAG_TONE: Record<string, 'success' | 'warning' | 'destructive'> = {
  SUCCESS: 'success',
  CREDIT: 'success',
  PENDING: 'warning',
  INITIATED: 'warning',
  PROCESSING: 'warning',
  FAILED: 'destructive',
  REJECTED: 'destructive',
  REFUNDED: 'destructive',
};

export interface PageArgs {
  range: { startDate?: string; endDate?: string };
  page: number;
  search: string;
  status: string;
  chip: string;
}

export interface PageResult {
  rows: any[];
  hasMore: boolean;
  summary?: any;
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

function rangeToDates(key: RangeKey): { startDate?: string; endDate?: string } {
  if (key === 'all') return {};
  const end = new Date();
  const start = new Date();
  if (key === 'today') start.setHours(0, 0, 0, 0);
  if (key === '7d') start.setDate(start.getDate() - 7);
  if (key === '30d') start.setDate(start.getDate() - 30);
  // isoDate, not toISOString().slice(0,10): the latter converts to UTC first,
  // so before 05:30 IST both ends of the range land on the previous day and
  // "Today" comes back empty.
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

const STATUSES = ['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const;

/** BHIM's day separator: "Today | Tuesday", "Yesterday | Monday", "04 Sep | Thursday". */
const dayHeading = (key: string) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });
  if (key === isoDate(new Date())) return `Today | ${weekday}`;
  if (key === isoDate(yesterday)) return `Yesterday | ${weekday}`;
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} | ${weekday}`;
};

// Web draws a focus ring around a bare TextInput; the pill border is the field.
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

/** Pill search, as on Home. */
const SearchPill: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <View style={styles.search}>
    <Ionicons name="search-outline" size={20} color={colors.foreground} />
    <TextInput
      style={[styles.searchInput, noOutline]}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      returnKeyType="search"
      accessibilityLabel={placeholder}
    />
    {!!value && (
      <Pressable onPress={() => onChange('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
        <Ionicons name="close" size={20} color={colors.mutedForeground} />
      </Pressable>
    )}
  </View>
);

/**
 * One engine behind every report screen: date range, search, status filter,
 * running totals, a virtualised list, and a tap-through detail sheet.
 *
 * FlatList rather than mapping inside a ScrollView — these lists routinely run
 * to a thousand rows.
 */
export const TransactionReport: React.FC<Props> = ({
  fetcher,
  pageFetcher,
  summaryFrom,
  searchFields,
  amountOf = (i) => Number(i?.amount ?? 0),
  statusOf = (i) => i?.status,
  titleOf,
  subtitleOf,
  dateOf = (i) => i?.createdAt,
  flowOf,
  details,
  summary,
  statuses = STATUSES,
  emptyTitle = 'Nothing to report yet',
  emptyIcon = 'chart-box-outline',
  iconOf,
  chips,
  searchPlaceholder = 'Search reference, name, number',
  filterExtra,
  header,
}) => {
  const { padding, gap } = useResponsive();
  const insets = useSafeAreaInsets();
  // The History list (chips) opens on everything; a report on the last month.
  const [range, setRange] = useState<RangeKey>(chips ? 'all' : '30d');
  const [status, setStatus] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chip, setChip] = useState('all');
  // Filtering a thousand rows on every keystroke re-rendered the whole list
  // and made typing visibly lag.
  const debouncedQuery = useDebounce(query, pageFetcher ? 400 : 200);

  const paged = !!pageFetcher;
  // Paged: the first page is keyed on every filter, so changing one starts the
  // list over from the server; later pages are appended as the list scrolls.
  const firstPage = useAsync<PageResult>(
    () =>
      pageFetcher!({ range: rangeToDates(range), page: 1, search: debouncedQuery.trim(), status, chip }),
    [range, debouncedQuery, status, chip],
    paged
  );
  const [more, setMore] = useState<{ rows: any[]; page: number; hasMore: boolean; loading: boolean }>({
    rows: [],
    page: 1,
    hasMore: false,
    loading: false,
  });
  useEffect(() => {
    setMore({ rows: [], page: 1, hasMore: !!firstPage.data?.hasMore, loading: false });
  }, [firstPage.data]);
  const loadMore = useCallback(async () => {
    if (!paged || more.loading || !more.hasMore) return;
    setMore((m) => ({ ...m, loading: true }));
    try {
      const next = await pageFetcher!({
        range: rangeToDates(range),
        page: more.page + 1,
        search: debouncedQuery.trim(),
        status,
        chip,
      });
      setMore((m) => ({ rows: [...m.rows, ...next.rows], page: m.page + 1, hasMore: next.hasMore, loading: false }));
    } catch {
      // A failed page leaves the list as it is; scrolling again retries.
      setMore((m) => ({ ...m, loading: false }));
    }
  }, [paged, more, pageFetcher, range, debouncedQuery, status, chip]);

  const whole = useAsync<any[]>(() => fetcher!(rangeToDates(range)), [range], !paged);
  const report = paged ? firstPage : whole;
  const loaded = useMemo(
    () => (paged ? [...(firstPage.data?.rows ?? []), ...more.rows] : (whole.data ?? [])),
    [paged, firstPage.data, more.rows, whole.data]
  );

  const rows = useMemo(() => {
    // The server already applied every filter to a paged list.
    if (paged) return loaded;
    const term = debouncedQuery.trim().toLowerCase();
    const match = chips?.find((c) => c.key === chip)?.match;
    return loaded.filter((item) => {
      if (match && !match(item)) return false;
      if (status !== 'ALL' && String(statusOf(item) ?? '').toUpperCase() !== status) return false;
      if (!term) return true;
      return searchFields(item).toLowerCase().includes(term);
    });
  }, [paged, loaded, debouncedQuery, status, statusOf, searchFields, chips, chip]);

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
  const items = useMemo(() => {
    const out: ReportItem[] = rows.map((item, index) => {
      const raw = dateOf(item);
      const when = raw ? new Date(raw) : null;
      const valid = !!when && !Number.isNaN(when.getTime());
      const status = statusOf(item);
      const s = String(status ?? '').toUpperCase();
      const amount = amountOf(item);
      const failed = /FAIL|REJECT/.test(s);
      // Money that never moved gets no sign: a failed debit did not leave.
      const flow = failed
        ? undefined
        : (flowOf?.(item) ?? (s === 'CREDIT' ? 'in' : s === 'DEBIT' ? 'out' : undefined));
      return {
        item,
        key: String(item?._id ?? item?.transactionId ?? item?.UTR ?? item?.SNO ?? index),
        title: titleOf(item),
        subtitle: subtitleOf?.(item) ?? '',
        // The day heading carries the date, so the row only needs the time.
        date: valid
          ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : dateTime(raw),
        day: valid ? isoDate(when) : '',
        amount: flow ? `${flow === 'in' ? '+' : '−'} ${money(Math.abs(amount))}` : money(amount),
        credit: flow === 'in',
        failed,
        icon: iconOf?.(item) ?? emptyIcon,
        status,
        first: false,
        last: false,
      };
    });
    // Rows arrive newest first; a run of one day shares a heading and a card.
    out.forEach((row, i) => {
      row.first = i === 0 || out[i - 1].day !== row.day;
      row.last = i === out.length - 1 || out[i + 1].day !== row.day;
    });
    return out;
  }, [rows, titleOf, subtitleOf, dateOf, amountOf, statusOf, flowOf, iconOf, emptyIcon]);

  const serverSummary = firstPage.data?.summary;
  const tiles: SummaryTile[] = useMemo(
    () =>
      paged
        ? summaryFrom
          ? summaryFrom(serverSummary ?? {})
          : [
              { label: 'Transactions', value: String(serverSummary?.count ?? 0) },
              { label: 'Total volume', value: money(serverSummary?.volume ?? 0) },
              { label: 'Successful', value: money(serverSummary?.success ?? 0), tone: 'success' },
              { label: 'Failed', value: String(serverSummary?.failed ?? 0), tone: 'error' },
            ]
        : summary
        ? summary(rows)
        : [
            { label: 'Transactions', value: String(totals.count) },
            { label: 'Total volume', value: money(totals.volume) },
            { label: 'Successful', value: money(totals.success), tone: 'success' },
            { label: 'Failed', value: String(totals.failed), tone: 'error' },
          ],
    [paged, summaryFrom, serverSummary, summary, rows, totals]
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
    () =>
      chips ? (
        <View style={{ gap }}>
          {header}
          {!!report.error && (
            <Banner
              tone="error"
              message={report.error}
              action={{ label: 'Retry', onPress: report.reload }}
            />
          )}
        </View>
      ) : (
      <View style={{ gap, marginBottom: space.xs }}>
        {!!report.error && (
          <Banner
            tone="error"
            message={report.error}
            action={{ label: 'Retry', onPress: report.reload }}
          />
        )}
        {/* Two across, not four. Every tile here carries a full money string
            (money() renders ₹1,23,456.78, not an abbreviated ₹1.2L), and four
            to a row left each one shrinking to fit at a different size. */}
        <Grid columns={2}>
          {tiles.map((tile) => (
            <Tile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
          ))}
        </Grid>
        {/* Range is the filter people actually change, so it sits in the open;
            status stays in the sheet with the rest. */}
        <Segmented
          options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
          value={range}
          onChange={setRange}
        />
      </View>
    ),
    [gap, report.error, report.reload, tiles, range, chips, header]
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
    ({ item }: { item: ReportItem }) => (
      <ReportRow row={item} onPress={setSelected} />
    ),
    []
  );

  return (
    <View style={styles.container}>
      {/* Search stays on the surface; the range and status pickers moved behind
          the filter button so the list starts near the top of the screen. */}
      {chips ? (
        <View style={{ paddingHorizontal: padding }}>
          <SearchPill value={query} onChange={setQuery} placeholder={searchPlaceholder} />
          <View style={styles.chipRow}>
            {chips.map((option) => {
              const on = option.key === chip;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setChip(option.key)}
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setFiltersOpen(true)}
              style={({ pressed }) => [styles.chip, activeFilters > 0 && styles.chipOn, pressed && styles.pressed]}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
            >
              <View style={styles.chipInner}>
                <Ionicons name="options-outline" size={17} color={colors.foreground} />
                {activeFilters > 0 && <Text style={styles.chipTextOn}>{activeFilters}</Text>}
              </View>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.filters, { paddingHorizontal: padding }]}>
          <View style={styles.flex}>
            <SearchPill value={query} onChange={setQuery} placeholder="Search reference, name, number" />
          </View>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={({ pressed }) => [
              styles.filterButton,
              activeFilters > 0 && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
          >
            <Ionicons name="options-outline" size={21} color={colors.foreground} />
            {activeFilters > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilters}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {report.loading ? (
        // The list's own shape while the first page is in flight: the header
        // (History's summary and report links load on their own), or the
        // report's tiles and range pills, then a day heading and its rows.
        <ScrollView
          contentContainerStyle={{ padding, paddingTop: chips ? 0 : padding, gap }}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading report"
        >
          {chips ? (
            header
          ) : (
            <>
              <View style={styles.skTiles}>
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonCard key={i} style={styles.skTile}>
                    <Skeleton width="60%" height={11} />
                    <Skeleton width="80%" height={20} />
                  </SkeletonCard>
                ))}
              </View>
              <View style={styles.skPills}>
                {[64, 84, 84, 64].map((w, i) => (
                  <Skeleton key={i} width={w} height={36} radius={18} />
                ))}
              </View>
            </>
          )}
          <SkeletonTitle />
          <SkeletonCard>
            <SkeletonRows count={6} />
          </SkeletonCard>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            padding,
            paddingTop: chips ? 0 : padding,
            paddingBottom: padding * 2 + insets.bottom,
          }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          refreshing={report.refreshing}
          onRefresh={report.refresh}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            more.loading ? <ActivityIndicator style={{ marginVertical: space.lg }} color={colors.mutedForeground} /> : null
          }
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
              {!!selected && <IconTile icon={iconOf?.(selected) ?? emptyIcon} size={44} iconSize={20} />}
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {selected ? titleOf(selected) : ''}
              </Text>
              <Pressable
                onPress={() => setSelected(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            {!!selected && (
              <>
                <View style={styles.sheetAmountWrap}>
                  <Text style={styles.sheetAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {money(amountOf(selected))}
                  </Text>
                  <StatusText status={statusOf(selected)} />
                </View>
                <View style={styles.sheetCard}>
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
              </>
            )}
            <Button variant="outline" onPress={() => setSelected(null)} fullWidth>
              Close
            </Button>
          </View>
        </View>
      </Modal>

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        subtitle={paged ? `${serverSummary?.count ?? rows.length} entries` : `${rows.length} of ${loaded.length} entries`}
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
        {filterExtra?.(() => setFiltersOpen(false))}
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
  /** Local YYYY-MM-DD, or '' when the row has no usable date. */
  day: string;
  amount: string;
  credit: boolean;
  failed: boolean;
  icon: string;
  status?: string;
  /** First / last row of its day — the heading and the card's rounded ends. */
  first: boolean;
  last: boolean;
}

/** "Success" / "Pending" / "Failed" — the word, in its colour. */
const statusLabel = (status?: string) => {
  const s = String(status ?? '').toUpperCase();
  return { tone: TAG_TONE[s], label: s ? s.charAt(0) + s.slice(1).toLowerCase() : 'Unknown' };
};

const StatusText: React.FC<{ status?: string }> = ({ status }) => {
  const { tone, label } = statusLabel(status);
  return <Text style={[styles.tag, { color: tone ? colors[tone] : colors.mutedForeground }]}>{label}</Text>;
};

/**
 * One transaction line, the same as Home's: grey line-icon circle, title,
 * "meta · time", the signed amount and the status as coloured text. Shared by
 * every screen that lists money movements, so they all read the same.
 */
export const TxnRow: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount: string;
  credit?: boolean;
  failed?: boolean;
  status?: string;
  last?: boolean;
  onPress?: () => void;
}> = ({ icon, title, subtitle, date, amount, credit, failed, status, last, onPress }) => {
  const { label } = statusLabel(status);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.item, last && styles.itemLast, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${amount}, ${label}`}
    >
      <IconTile icon={icon} size={44} iconSize={20} />
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {[subtitle, date].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text
          style={[styles.itemAmount, credit && styles.itemCredit, failed && styles.itemFailed]}
          numberOfLines={1}
        >
          {amount}
        </Text>
        <StatusText status={status} />
      </View>
    </Pressable>
  );
};

/**
 * Memoised: FlatList re-renders every visible row whenever renderItem changes
 * identity, so with an inline renderItem a single keystroke re-rendered the
 * whole viewport. All the display work is already done in `items`, leaving
 * this a pure function of primitives.
 */
const ReportRow = React.memo<{ row: ReportItem; onPress: (item: any) => void }>(
  ({ row, onPress }) => (
    <View>
      {row.first && !!row.day && (
        <View style={styles.day}>
          <Text style={styles.dayLabel} accessibilityRole="header">
            {dayHeading(row.day)}
          </Text>
          <MaterialCommunityIcons
            name="star-four-points"
            size={10}
            color={colors.mutedForeground}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={styles.dayRule} />
        </View>
      )}
      <View style={[styles.card, row.first && styles.cardFirst, row.last && styles.cardLast]}>
        <TxnRow
          icon={row.icon}
          title={row.title}
          subtitle={row.subtitle}
          date={row.date}
          amount={row.amount}
          credit={row.credit}
          failed={row.failed}
          status={row.status}
          last={row.last}
          onPress={() => onPress(row.item)}
        />
      </View>
    </View>
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
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  filterButton: {
    width: TOUCH,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  filterButtonActive: { borderColor: c.foreground, backgroundColor: c.surfaceAlt },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: c.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '600', color: c.highlightForeground },
  filterGroup: { gap: space.sm },
  sheetActions: { flexDirection: 'row', gap: space.sm },
  filterLabel: { fontSize: t.small, fontWeight: '400', color: c.mutedForeground },
  tile: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  tileLabel: { fontSize: t.caption, color: c.mutedForeground, fontWeight: '400' },
  tileValue: {
    fontSize: t.title,
    fontWeight: '500',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: t.body, color: c.foreground, paddingVertical: space.sm },
  // Filter chips: outlined pills, the selected one filled — as Segmented.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, marginBottom: space.sm },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  chipOn: { backgroundColor: c.surfaceAlt, borderColor: c.foreground },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: t.small, fontWeight: '400', color: c.mutedForeground },
  chipTextOn: { fontSize: t.small, color: c.foreground, fontWeight: '500' },
  // BHIM's "Today | Tuesday ✦ ————".
  day: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  dayLabel: { fontSize: t.body, fontWeight: '400', color: c.foreground },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
  // A day's rows read as one card: each row draws the card's sides, the first
  // adds the top edge, the last the bottom.
  card: {
    backgroundColor: c.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.lg,
  },
  cardFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space.xs },
  cardLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingBottom: space.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemMain: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  itemSubtitle: { fontSize: t.caption, color: c.mutedForeground },
  itemRight: { alignItems: 'flex-end', gap: 3 },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '500',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  itemCredit: { color: c.success },
  itemFailed: { color: c.destructive },
  tag: { fontSize: t.caption, fontWeight: '500' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderStrong,
    alignSelf: 'center',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetTitle: { flex: 1, fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  // BHIM sets an amount big and light.
  sheetAmountWrap: { alignItems: 'center', gap: space.xs },
  sheetAmount: { fontSize: 44, fontWeight: '300', color: c.foreground, fontVariant: ['tabular-nums'] },
  sheetCard: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  skTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  skTile: { width: '47%', flexGrow: 1, gap: space.sm, paddingVertical: space.lg },
  skPills: { flexDirection: 'row', gap: space.sm },
}));

export default TransactionReport;
