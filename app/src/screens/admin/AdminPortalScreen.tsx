import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  Grid,
  Row,
  Segmented,
  StatusPill,
  SuccessBanner,
  money,
  dateTime,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'requests', label: 'Fund requests' },
  { key: 'distributors', label: 'Distributors' },
  { key: 'settings', label: 'Settings' },
];

export const AdminPortalScreen: React.FC = () => {
  const [tab, setTab] = useState('overview');
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [commission, setCommission] = useState('');
  const [notice, setNotice] = useState('');

  const stats = useAsync<any>(async () => (await api.getAdminStats()).data, []);
  const distributors = useAsync<any[]>(async () => (await api.getAdminDistributors()).data ?? [], []);
  const fundRequests = useAsync<any[]>(async () => (await api.getAdminFundRequests()).data ?? [], []);
  const recent = useAsync<any[]>(
    async () => (await api.getAdminRecentTransactions({ limit: 15 })).data ?? [],
    []
  );
  const settings = useAsync<any>(async () => {
    const res = await api.getGlobalSettings();
    setCommission(String(res.data?.aepsCommission ?? ''));
    return res.data;
  }, []);

  const decide = useAction(async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await api.updateAdminFundRequest({
      requestId,
      status,
      adminRemarks: remarks[requestId] || '',
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const saveSettings = useAction(async () => {
    const res = await api.updateGlobalSettings({ aepsCommission: Number(commission) });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const pending = (fundRequests.data ?? []).filter(
    (r: any) => String(r.status).toUpperCase() === 'PENDING'
  );

  const onDecide = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setNotice('');
    const res = await decide.run(requestId, status);
    if (res) {
      setNotice(res.message || `Request ${status.toLowerCase()}.`);
      fundRequests.reload();
      stats.reload();
    }
  };

  return (
    <Screen
      loading={stats.loading}
      refreshing={stats.refreshing || fundRequests.refreshing}
      onRefresh={() => {
        stats.refresh();
        distributors.refresh();
        fundRequests.refresh();
        recent.refresh();
        settings.refresh();
      }}
      error={stats.error}
      onRetry={stats.reload}
    >
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {!!notice && <SuccessBanner message={notice} />}

      {tab === 'overview' && (
        <>
          <Grid columns={2}>
            <Tile label="Distributors" value={String(stats.data?.totalDistributors ?? 0)} />
            <Tile label="Retailers" value={String(stats.data?.totalRetailers ?? 0)} />
            <Tile label="Transactions" value={String(stats.data?.totalTransactions ?? 0)} />
            <Tile label="Volume" value={money(stats.data?.totalTrxVolume)} />
            <Tile label="Admin wallet" value={money(stats.data?.adminWalletBalance)} />
            <Tile label="Pending requests" value={String(pending.length)} tone="warning" />
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle icon="history">Recent transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.loading ? null : recent.data?.length ? (
                recent.data.map((txn: any, i: number) => (
                  <View
                    key={txn._id || i}
                    style={[styles.listItem, i === recent.data!.length - 1 && styles.listItemLast]}
                  >
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {String(txn.type || 'TXN').replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.listMeta} numberOfLines={1}>
                        {txn.userId?.businessName || txn.userId?.name || txn.userId?.retailerId || '—'}
                        {' · '}
                        {dateTime(txn.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.listRight}>
                      <Text style={styles.listAmount}>{money(txn.amount)}</Text>
                      <StatusPill status={txn.status} />
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState icon="receipt-text-outline" title="No transactions yet" />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle icon="clipboard-check-outline">
              {`Distributor fund requests (${pending.length} pending)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!!decide.error && <ErrorBanner message={decide.error} />}
            {fundRequests.loading ? null : fundRequests.data?.length ? (
              fundRequests.data.map((req: any) => (
                <View key={req._id} style={styles.requestItem}>
                  <View style={styles.requestTop}>
                    <Text style={styles.requestAmount}>{money(req.amount)}</Text>
                    <StatusPill status={req.status} />
                  </View>
                  <Row
                    label="From"
                    value={
                      req.distributorId?.businessName ||
                      req.distributorId?.name ||
                      req.distributorId?.distributorId ||
                      '—'
                    }
                  />
                  <Row label="Mode" value={String(req.transactionMode || '').replace(/_/g, ' ')} />
                  <Row label="UTR" value={req.bankUtr} />
                  <Row label="Deposited" value={shortDate(req.depositDate)} />
                  <Row label="Requested" value={shortDate(req.createdAt)} last />

                  {String(req.status).toUpperCase() === 'PENDING' && (
                    <View style={styles.actions}>
                      <Input
                        placeholder="Remarks (optional)"
                        value={remarks[req._id] || ''}
                        onChangeText={(v) => setRemarks((r) => ({ ...r, [req._id]: v }))}
                        leftIcon="note-text-outline"
                      />
                      <View style={styles.actionRow}>
                        <Button
                          size="sm"
                          icon="check"
                          onPress={() => onDecide(req._id, 'APPROVED')}
                          loading={decide.pending}
                          style={styles.flex}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          icon="close"
                          onPress={() => onDecide(req._id, 'REJECTED')}
                          loading={decide.pending}
                          style={styles.flex}
                        >
                          Reject
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <EmptyState icon="clipboard-check-outline" title="No fund requests" />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'distributors' && (
        <Card>
          <CardHeader>
            <CardTitle icon="account-group-outline">
              {`Distributors (${distributors.data?.length ?? 0})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributors.loading ? null : distributors.data?.length ? (
              distributors.data.map((dist: any, i: number) => (
                <View
                  key={dist._id}
                  style={[styles.listItem, i === distributors.data!.length - 1 && styles.listItemLast]}
                >
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {dist.businessName || dist.name}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {dist.distributorId} · {dist.retailers?.length ?? 0} retailers
                    </Text>
                  </View>
                  <View style={styles.listRight}>
                    <Text style={styles.listAmount}>{money(dist.commissionsEarned)}</Text>
                    <StatusPill status={dist.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyState icon="account-group-outline" title="No distributors yet" />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle icon="cog-outline">Global settings</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Input
              label="AEPS commission"
              value={commission}
              onChangeText={(v) => setCommission(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              leftIcon="percent-outline"
              helperText="Applied to every AEPS withdrawal across the network"
            />
            {!!settings.error && <ErrorBanner message={settings.error} onRetry={settings.reload} />}
            {!!saveSettings.error && <ErrorBanner message={saveSettings.error} />}
            <Button
              onPress={async () => {
                setNotice('');
                const res = await saveSettings.run();
                if (res) {
                  setNotice(res.message || 'Settings saved.');
                  settings.reload();
                }
              }}
              loading={saveSettings.pending}
              disabled={!commission}
              icon="content-save-outline"
              fullWidth
            >
              Save settings
            </Button>
          </CardContent>
        </Card>
      )}
    </Screen>
  );
};

const Tile: React.FC<{ label: string; value: string; tone?: 'warning' }> = ({
  label,
  value,
  tone,
}) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[styles.tileValue, tone === 'warning' && { color: colors.warning }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  tile: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 3,
  },
  tileLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.bodyLg,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  requestItem: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  requestAmount: {
    fontSize: t.bodyLg,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  actions: { gap: space.md, marginTop: space.md },
  actionRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  listItemLast: { borderBottomWidth: 0 },
  listInfo: { flex: 1, minWidth: 0, gap: 2 },
  listName: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  listMeta: { fontSize: t.micro, color: c.mutedForeground },
  listRight: { alignItems: 'flex-end', gap: 4 },
  listAmount: {
    fontSize: t.small,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default AdminPortalScreen;
