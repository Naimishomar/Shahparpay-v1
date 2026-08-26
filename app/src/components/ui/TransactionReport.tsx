import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { Input } from './Input';
import { Button } from './Button';
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
  emptyTitle?: string;
  emptyIcon?: string;
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
  emptyTitle = 'Nothing to report yet',
  emptyIcon = 'chart-box-outline',
}) => {
  const { padding, gap } = useResponsive();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>('30d');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const report = useAsync<any[]>(() => fetcher(rangeToDates(range)), [range]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (report.data ?? []).filter((item) => {
      if (status !== 'ALL' && String(statusOf(item) ?? '').toUpperCase() !== status) return false;
      if (!term) return true;
      return searchFields(item).toLowerCase().includes(term);
    });
  }, [report.data, query, status, statusOf, searchFields]);

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

  return (
    <View style={styles.container}>
      <View style={[styles.filters, { paddingHorizontal: padding, gap }]}>
        <Input
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
        <Segmented
          options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
          value={range}
          onChange={setRange}
        />
        <Segmented
          options={STATUSES.map((s) => ({ key: s, label: s === 'ALL' ? 'All status' : s }))}
          value={status}
          onChange={setStatus}
        />
      </View>

      {report.loading ? (
        <LoadingBlock label="Loading report" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => String(item?._id ?? item?.transactionId ?? index)}
          contentContainerStyle={{ padding, paddingBottom: padding * 2 + insets.bottom, gap }}
          refreshing={report.refreshing}
          onRefresh={report.refresh}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={{ gap }}>
              {!!report.error && (
                <Banner
                  tone="error"
                  message={report.error}
                  action={{ label: 'Retry', onPress: report.reload }}
                />
              )}
              <Grid columns={2}>
                <Tile label="Transactions" value={String(totals.count)} />
                <Tile label="Total volume" value={money(totals.volume)} />
                <Tile label="Successful" value={money(totals.success)} tone="success" />
                <Tile label="Failed" value={String(totals.failed)} tone="error" />
              </Grid>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={emptyIcon}
              title={query || status !== 'ALL' ? 'No matching entries' : emptyTitle}
              subtitle={
                query || status !== 'ALL'
                  ? 'Try a wider date range or clear the filters.'
                  : 'Completed transactions show up here.'
              }
              action={
                query || status !== 'ALL'
                  ? {
                      label: 'Clear filters',
                      onPress: () => {
                        setQuery('');
                        setStatus('ALL');
                        setRange('all');
                      },
                    }
                  : undefined
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${titleOf(item)}, ${money(amountOf(item))}, ${statusOf(item) ?? 'unknown status'}`}
            >
              <View style={styles.itemMain}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {titleOf(item)}
                </Text>
                {!!subtitleOf?.(item) && (
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {subtitleOf(item)}
                  </Text>
                )}
                <Text style={styles.itemDate}>{dateTime(dateOf(item))}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemAmount} numberOfLines={1}>
                  {money(amountOf(item))}
                </Text>
                <StatusPill status={statusOf(item)} />
              </View>
            </Pressable>
          )}
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
    </View>
  );
};

const Tile: React.FC<{ label: string; value: string; tone?: 'success' | 'error' }> = ({
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
  container: { flex: 1, backgroundColor: c.background },
  filters: {
    paddingTop: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
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
