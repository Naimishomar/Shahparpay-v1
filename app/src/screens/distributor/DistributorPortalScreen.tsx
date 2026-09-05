import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { ConfirmSheet } from '@/components/ui/Sheet';
import { ImageField } from '@/components/ui/ImageField';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'requests', label: 'Retailer requests' },
  { key: 'mine', label: 'My requests' },
];

const MODES = ['NEFT', 'IMPS', 'RTGS', 'UPI', 'CASH_DEPOSIT', 'CHEQUE'];
const today = () => new Date().toISOString().slice(0, 10);

/** How far the summary card rides up into the brand band — same as Home. */
const CARD_OVERLAP = 52;

export const DistributorPortalScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState('overview');
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const [mode, setMode] = useState<string>('NEFT');
  const [amount, setAmount] = useState('');
  const [bankUtr, setBankUtr] = useState('');
  const [depositDate, setDepositDate] = useState(today());
  const [ownRemarks, setOwnRemarks] = useState('');
  const [ownSlip, setOwnSlip] = useState<PickedFile | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const stats = useAsync<any>(async () => (await api.getDistributorStats()).data, []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
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

  const dropRequest = useAction(async (id: string) => {
    const res = await api.deleteFundRequest(id);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const pending = (fundRequests.data ?? []).filter(
    (r: any) => String(r.status).toUpperCase() === 'PENDING'
  );
  const kycPending = (retailers.data ?? []).filter((r: any) => !r.isMerchantKycComplete);

  const onDecide = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setNotice('');
    const res = await decide.run(requestId, status);
    if (res) {
      setNotice(res.message || `Request ${status.toLowerCase()}.`);
      fundRequests.reload();
      stats.reload();
    }
  };

  const onDelete = async () => {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    setNotice('');
    const res = await dropRequest.run(target._id);
    if (res) {
      setNotice(res.message || 'Fund request deleted.');
      ownRequests.reload();
    }
  };

  const retailerName = (r: any) =>
    r.retailerId?.businessName ||
    r.retailerId?.retailerId ||
    `${r.retailerId?.firstName ?? ''} ${r.retailerId?.lastName ?? ''}`.trim() ||
    '—';

  const initials = (user?.name || 'D')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <Screen
      loading={stats.loading}
      refreshing={stats.refreshing || retailers.refreshing}
      onRefresh={() => {
        stats.refresh();
        balances.refresh();
        retailers.refresh();
        fundRequests.refresh();
        ownRequests.refresh();
      }}
      error={stats.error}
      onRetry={stats.reload}
      headerOverlap={CARD_OVERLAP}
      header={
        <View style={styles.band}>
          <View style={styles.bandTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.identity}>
              <Text style={styles.identityName} numberOfLines={1}>
                {user?.name || 'Distributor'}
              </Text>
              <Text style={styles.identityCode} numberOfLines={1}>
                {user?.code || user?.email || 'Distributor'}
              </Text>
            </View>
          </View>
        </View>
      }
    >
      <Card padding={space.lg}>
        <View style={styles.balRow}>
          <View style={styles.balMain}>
            <Text style={styles.balLabel}>Main wallet</Text>
            <Text style={styles.balValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(balances.data?.mainBalance)}
            </Text>
          </View>
          <View style={styles.balAside}>
            <Text style={styles.balLabel}>AEPS</Text>
            <Text style={styles.balAsideValue} numberOfLines={1}>
              {money(balances.data?.aepsBalance)}
            </Text>
          </View>
        </View>
        <View style={styles.balActions}>
          <Pressable
            onPress={() => setTab('mine')}
            style={({ pressed }) => [styles.balBtn, styles.balBtnPrimary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.balBtnPrimaryText}>Request funds</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('DistributorRetailers')}
            style={({ pressed }) => [styles.balBtn, styles.balBtnGhost, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.balBtnGhostText}>My retailers</Text>
          </Pressable>
        </View>
      </Card>

      <Segmented options={TABS} value={tab} onChange={setTab} />
      {!!notice && <SuccessBanner message={notice} />}
      {!!dropRequest.error && <ErrorBanner message={dropRequest.error} />}

      {tab === 'overview' && (
        <Grid columns={2}>
          <Tile
            icon="store-outline"
            label="Retailers"
            value={String(stats.data?.totalRetailers ?? 0)}
          />
          <Tile icon="wallet-outline" label="Commissions" value={money(stats.data?.totalCommissions)} />
          <Tile
            icon="account-multiple-outline"
            label="Network size"
            value={String(stats.data?.activeUsers ?? 0)}
          />
          <Tile
            icon="shield-alert-outline"
            label="KYC pending"
            value={String(kycPending.length)}
            tone={kycPending.length ? 'warning' : undefined}
          />
          <Tile
            icon="clipboard-check-outline"
            label="Pending requests"
            value={String(pending.length)}
            tone={pending.length ? 'warning' : undefined}
          />
          <Tile
            icon="hand-coin-outline"
            label="My open requests"
            value={String(
              (ownRequests.data ?? []).filter(
                (r: any) => String(r.status).toUpperCase() === 'PENDING'
              ).length
            )}
          />
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
                  <Row label="Requested" value={shortDate(req.createdAt)} last={!req.depositSlip} />
                  {!!req.depositSlip && (
                    <Row
                      label="Deposit slip"
                      value={
                        <Pressable
                          onPress={() => Linking.openURL(req.depositSlip)}
                          hitSlop={8}
                          accessibilityRole="button"
                        >
                          <Text style={styles.link}>View slip</Text>
                        </Pressable>
                      }
                      last
                    />
                  )}

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
                    {String(req.status).toUpperCase() === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        icon="trash-can-outline"
                        onPress={() => setDeleting(req)}
                        loading={dropRequest.pending}
                        style={{ marginTop: space.md }}
                        fullWidth
                      >
                        Delete request
                      </Button>
                    )}
                  </View>
                ))
              ) : (
                <EmptyState icon="clipboard-text-outline" title="No requests submitted yet" />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this request?"
        message={`The ${money(deleting?.amount)} request you sent to admin will be withdrawn. This cannot be undone.`}
        icon="trash-can-outline"
        confirmLabel="Delete"
        onConfirm={onDelete}
        pending={dropRequest.pending}
      />
    </Screen>
  );
};

const Tile: React.FC<{ icon: string; label: string; value: string; tone?: 'warning' }> = ({
  icon,
  label,
  value,
  tone,
}) => (
  <View style={styles.tile}>
    <View style={styles.tileTop}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.mutedForeground} />
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
  band: {
    backgroundColor: c.band,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg + CARD_OVERLAP,
  },
  bandTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(127,127,127,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: t.small, fontWeight: '700', color: c.bandForeground },
  identity: { flex: 1, minWidth: 0, gap: 1 },
  identityName: { fontSize: t.body, fontWeight: '700', color: c.bandForeground },
  identityCode: { fontSize: t.micro, color: c.bandForeground, opacity: 0.75 },

  balRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  balMain: { flex: 1, minWidth: 0, gap: 1 },
  balAside: { alignItems: 'flex-end', gap: 1 },
  balLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  balValue: { fontSize: t.h1, fontWeight: '800', color: c.foreground, fontVariant: ['tabular-nums'] },
  balAsideValue: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  balActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  balBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balBtnPrimary: { backgroundColor: c.accent },
  balBtnPrimaryText: { fontSize: t.small, fontWeight: '700', color: c.bandForeground },
  balBtnGhost: { backgroundColor: c.card, borderWidth: 1, borderColor: c.borderStrong },
  balBtnGhostText: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  pressed: { opacity: 0.75 },

  tile: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { flex: 1, fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  link: { fontSize: t.small, fontWeight: '700', color: c.accent },
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
}));

export default DistributorPortalScreen;
