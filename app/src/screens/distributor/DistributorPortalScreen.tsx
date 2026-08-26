import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  shortDate,
} from '@/components/ui/Screen';
import { ImageField } from '@/components/ui/ImageField';
import { OnboardMemberSheet } from '@/components/network/OnboardMemberSheet';
import { EditRetailerSheet } from '@/components/network/EditRetailerSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'requests', label: 'Retailer requests' },
  { key: 'retailers', label: 'Retailers' },
  { key: 'mine', label: 'My requests' },
];

const MODES = ['NEFT', 'IMPS', 'RTGS', 'UPI', 'CASH_DEPOSIT', 'CHEQUE'];
const today = () => new Date().toISOString().slice(0, 10);

export const DistributorPortalScreen: React.FC = () => {
  const [tab, setTab] = useState('overview');
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const [mode, setMode] = useState<string>('NEFT');
  const [amount, setAmount] = useState('');
  const [bankUtr, setBankUtr] = useState('');
  const [depositDate, setDepositDate] = useState(today());
  const [ownRemarks, setOwnRemarks] = useState('');
  const [ownSlip, setOwnSlip] = useState<PickedFile | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<any | null>(null);

  const stats = useAsync<any>(async () => (await api.getDistributorStats()).data, []);
  const retailers = useAsync<any[]>(async () => (await api.getDistributorRetailers()).data ?? [], []);
  const fundRequests = useAsync<any[]>(
    async () => (await api.getDistributorFundRequests()).data ?? [],
    []
  );
  const ownRequests = useAsync<any[]>(
    async () => (await api.getDistributorOwnFundRequests()).data ?? [],
    []
  );

  const decide = useAction(async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await api.updateFundRequest({
      requestId,
      status,
      adminRemarks: remarks[requestId] || '',
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const requestFunds = useAction(async () => {
    const res = await api.createDistributorFundRequest(
      {
        transactionMode: mode,
        amount: Number(amount),
        bankUtr: bankUtr.trim(),
        depositDate,
        remarks: ownRemarks.trim(),
      },
      ownSlip ?? undefined
    );
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

  const retailerName = (r: any) =>
    r.retailerId?.businessName ||
    r.retailerId?.retailerId ||
    `${r.retailerId?.firstName ?? ''} ${r.retailerId?.lastName ?? ''}`.trim() ||
    '—';

  return (
    <Screen
      loading={stats.loading}
      refreshing={stats.refreshing || retailers.refreshing}
      onRefresh={() => {
        stats.refresh();
        retailers.refresh();
        fundRequests.refresh();
        ownRequests.refresh();
      }}
      error={stats.error}
      onRetry={stats.reload}
    >
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {!!notice && <SuccessBanner message={notice} />}

      {tab === 'overview' && (
        <Grid columns={2}>
          <Tile label="Retailers" value={String(stats.data?.totalRetailers ?? 0)} />
          <Tile label="Commissions" value={money(stats.data?.totalCommissions)} />
          <Tile label="Active users" value={String(stats.data?.activeUsers ?? 0)} />
          <Tile label="Pending requests" value={String(pending.length)} tone="warning" />
        </Grid>
      )}

      {tab === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle icon="clipboard-check-outline">
              {`Retailer fund requests (${pending.length} pending)`}
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
                  <Row label="Retailer" value={retailerName(req)} />
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

      {tab === 'retailers' && (
        <Card>
          <CardHeader>
            <CardTitle icon="store-outline">
              {`My retailers (${retailers.data?.length ?? 0})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              icon="account-plus-outline"
              onPress={() => setOnboarding(true)}
              style={{ marginBottom: space.md }}
              fullWidth
            >
              Onboard a retailer
            </Button>
            {retailers.loading ? null : retailers.data?.length ? (
              retailers.data.map((ret: any, i: number) => (
                <Pressable
                  key={ret._id}
                  onPress={() => setSelectedRetailer(ret)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${ret.businessName || ret.name || ret.retailerId}`}
                  style={({ pressed }) => [
                    styles.listItem,
                    i === retailers.data!.length - 1 && styles.listItemLast,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {ret.businessName || ret.name || ret.retailerId}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {ret.retailerId} · {ret.contactNumber}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {`AEPS ${money(ret.aepsWalletBalance)} · Main ${money(ret.mainWalletBalance)}`}
                    </Text>
                  </View>
                  <View style={styles.listRight}>
                    <Text style={styles.listAmount}>{money(ret.commissionsEarned)}</Text>
                    <StatusPill status={ret.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ))
            ) : (
              <EmptyState
                icon="store-outline"
                title="No retailers yet"
                subtitle="Onboard your first retailer to start earning commission"
                action={{ label: 'Onboard a retailer', onPress: () => setOnboarding(true) }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'mine' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle icon="hand-coin-outline">Request funds from admin</CardTitle>
            </CardHeader>
            <CardContent style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>How did you pay?</Text>
                <Segmented
                  options={MODES.map((m) => ({ key: m, label: m.replace('_', ' ') }))}
                  value={mode}
                  onChange={setMode}
                />
              </View>
              <Input
                label="Amount"
                required
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                leftIcon="currency-inr"
              />
              <Input
                label="Bank UTR / reference"
                required
                value={bankUtr}
                onChangeText={setBankUtr}
                autoCapitalize="characters"
                leftIcon="pound"
              />
              <Input
                label="Deposit date"
                required
                value={depositDate}
                onChangeText={setDepositDate}
                placeholder="YYYY-MM-DD"
                leftIcon="calendar-outline"
              />
              <ImageField
                label="Deposit slip"
                value={ownSlip}
                onChange={setOwnSlip}
                helperText="A photo of the receipt gets your request approved faster"
              />
              <Input
                label="Remarks"
                value={ownRemarks}
                onChangeText={setOwnRemarks}
                multiline
                leftIcon="note-text-outline"
              />
              {!!requestFunds.error && <ErrorBanner message={requestFunds.error} />}
              <Button
                onPress={async () => {
                  setNotice('');
                  const res = await requestFunds.run();
                  if (res) {
                    setNotice(res.message || 'Fund request submitted to admin.');
                    setAmount('');
                    setBankUtr('');
                    setOwnRemarks('');
                    ownRequests.reload();
                  }
                }}
                disabled={Number(amount) <= 0 || bankUtr.trim().length < 4}
                loading={requestFunds.pending}
                icon="send-outline"
                fullWidth
              >
                Submit request
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle icon="history">My request history</CardTitle>
            </CardHeader>
            <CardContent>
              {ownRequests.loading ? null : ownRequests.data?.length ? (
                ownRequests.data.map((req: any) => (
                  <View key={req._id} style={styles.requestItem}>
                    <View style={styles.requestTop}>
                      <Text style={styles.requestAmount}>{money(req.amount)}</Text>
                      <StatusPill status={req.status} />
                    </View>
                    <Row label="Mode" value={String(req.transactionMode || '').replace(/_/g, ' ')} />
                    <Row label="UTR" value={req.bankUtr} />
                    <Row label="Requested" value={shortDate(req.createdAt)} last={!req.adminRemarks} />
                    {!!req.adminRemarks && <Row label="Remarks" value={req.adminRemarks} last />}
                  </View>
                ))
              ) : (
                <EmptyState icon="clipboard-text-outline" title="No requests submitted yet" />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <OnboardMemberSheet
        visible={onboarding}
        kind="retailer"
        onClose={() => setOnboarding(false)}
        onCreated={() => {
          retailers.reload();
          stats.reload();
        }}
      />

      {!!selectedRetailer && (
        <EditRetailerSheet
          retailer={selectedRetailer}
          onClose={() => setSelectedRetailer(null)}
          onSaved={retailers.reload}
        />
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
  field: { gap: space.sm },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
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

export default DistributorPortalScreen;
