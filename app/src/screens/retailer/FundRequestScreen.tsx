import React, { useState } from 'react';
import { View, Text, Alert, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  SectionTitle,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  Row,
  Segmented,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { ImageField } from '@/components/ui/ImageField';
import { IconTile } from '@/components/ui/Gradient';
import { useAsync, useAction } from '@/hooks/useAsync';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

// Values are the backend enum verbatim (fundRequest.model.js), same as web.
const MODES = ['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cash Deposit', 'Cheque'].map((m) => ({ key: m, label: m }));
const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const FundRequestScreen: React.FC = () => {
  const [mode, setMode] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [bankUtr, setBankUtr] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [depositSlip, setDepositSlip] = useState<PickedFile | null>(null);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const requests = useAsync<any[]>(async () => (await api.getRetailerFundRequests()).data ?? [], []);

  const submit = useAction(async () => {
    const res = await api.createFundRequest(
      {
        transactionMode: mode,
        amount: Number(amount),
        bankUtr: bankUtr.trim(),
        depositDate,
        remarks: remarks.trim(),
      },
      depositSlip ?? undefined
    );
    if (!res.success) throw new Error(res.message || 'Failed to submit fund request');
    return res;
  });

  const remove = useAction(async (id: string) => {
    const res = await api.deleteFundRequest(id);
    if (!res.success) throw new Error(res.message || 'Failed to delete fund request');
    return res;
  });

  const dateValid = DATE_RE.test(depositDate) && !Number.isNaN(Date.parse(depositDate));
  const all = requests.data ?? [];
  const countOf = (st: string) => all.filter((r) => st === 'ALL' || r.status === st).length;
  const shown = all.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);
  const approvedTotal = all
    .filter((r) => r.status === 'APPROVED')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const onSubmit = async () => {
    setNotice('');
    setFormError('');
    if (!mode || !amount || !bankUtr.trim() || !depositDate) {
      setFormError('Please fill all required fields');
      return;
    }
    // Web's <input type="number" min="1"> / <input type="date"> enforce these.
    if (!(Number(amount) >= 1)) {
      setFormError('Amount must be at least ₹1');
      return;
    }
    if (!dateValid) {
      setFormError('Use the format YYYY-MM-DD');
      return;
    }
    const res = await submit.run();
    if (res) {
      setNotice('Fund request submitted successfully');
      setMode('');
      setDepositDate('');
      setAmount('');
      setBankUtr('');
      setRemarks('');
      setDepositSlip(null);
      requests.reload();
    }
  };

  // Deleting a request is not reversible, so it goes through a confirmation.
  const confirmDelete = (item: any) =>
    Alert.alert(
      'Delete request?',
      'Are you sure you want to delete this fund request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await remove.run(item._id);
            if (res) {
              setNotice('Fund request deleted successfully');
              requests.reload();
            }
          },
        },
      ]
    );

  return (
    <Screen
      refreshing={requests.refreshing}
      onRefresh={requests.refresh}
      error={requests.error}
      onRetry={requests.reload}
    >
      <SectionTitle>Add Fund Request</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <Text style={styles.label}>Request Trade Wallet funds from your distributor against a bank deposit.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Transaction Mode *</Text>
            <Segmented
              options={MODES}
              value={mode}
              onChange={setMode}
            />
          </View>

          <Input
            label="Deposit Amount"
            required
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            leftIcon="currency-inr"
          />
          <Input
            label="Bank UTR / Ref ID"
            required
            value={bankUtr}
            onChangeText={setBankUtr}
            autoCapitalize="characters"
            placeholder="Enter UTR"
            leftIcon="pound"
          />
          <Input
            label="Deposit Date"
            required
            value={depositDate}
            onChangeText={setDepositDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            leftIcon="calendar-outline"
            error={depositDate && !dateValid ? 'Use the format YYYY-MM-DD' : undefined}
          />
          <ImageField
            label="Deposit Slip"
            value={depositSlip}
            onChange={setDepositSlip}
          />
          <Input
            label="Remark"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional remarks..."
            multiline
            leftIcon="note-text-outline"
          />

          {!!(formError || submit.error) && <ErrorBanner message={formError || submit.error || ''} />}
          {!!notice && <SuccessBanner message={notice} />}

          <Button
            onPress={onSubmit}
            loading={submit.pending}
            size="lg"
            fullWidth
          >
            Submit Request
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Row label="Total requests" value={String(all.length)} />
          <Row label="Pending" value={String(countOf('PENDING'))} />
          <Row label="Approved" value={String(countOf('APPROVED'))} />
          <Row label="Approved amount" value={`₹${approvedTotal.toLocaleString('en-IN')}`} last />
        </CardContent>
      </Card>

      <SectionTitle>Your requests</SectionTitle>
      <Segmented
        options={FILTERS.map((st) => ({
          key: st,
          label: `${st.charAt(0) + st.slice(1).toLowerCase()} ${countOf(st)}`,
        }))}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <Card>
        <CardContent>
          {!!remove.error && <ErrorBanner message={remove.error} />}
          {requests.loading ? <SkeletonRows count={3} /> : shown.length ? (
            shown.map((req: any, index: number, shown: any[]) => (
              <View key={req._id} style={[styles.item, index === shown.length - 1 && styles.itemLast]}>
                <View style={styles.itemTop}>
                  <IconTile icon="hand-coin-outline" size={44} iconSize={20} />
                  <Text style={styles.itemAmount} numberOfLines={1}>
                    {money(req.amount)}
                  </Text>
                  <StatusText status={req.status} />
                </View>
                <Row label="Txn Mode" value={req.transactionMode} />
                <Row label="Bank UTR" value={req.bankUtr} mono />
                <Row label="Deposit Date" value={shortDate(req.depositDate)} />
                <Row
                  label="Deposit Slip"
                  value={
                    req.depositSlipUrl ? (
                      <Pressable onPress={() => Linking.openURL(req.depositSlipUrl)} hitSlop={8} accessibilityRole="link">
                        <Text style={styles.link}>View</Text>
                      </Pressable>
                    ) : (
                      '—'
                    )
                  }
                />
                <Row label="Remarks" value={req.remarks || '—'} last={!req.adminRemarks} />
                {!!req.adminRemarks && <Row label="Admin remarks" value={req.adminRemarks} last />}
                {String(req.status).toUpperCase() === 'PENDING' && (
                  <Pressable
                    onPress={() => confirmDelete(req)}
                    style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete request"
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    <Text style={styles.deleteText}>Delete request</Text>
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <EmptyState
              icon="clipboard-text-outline"
              title="No fund requests found."
            />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

/** BHIM status: small coloured text, never a filled pill. */
const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || 'PENDING').toUpperCase();
  const color = /SUCCESS|COMPLETE|APPROVED|ACTIVE|ACCEPTED|CONVERTED/.test(s)
    ? colors.success
    : /FAIL|REJECT/.test(s)
      ? colors.destructive
      : colors.warning;
  return (
    <Text style={{ fontSize: t.small, fontWeight: '500', color }}>
      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
    </Text>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xs,
  },
  itemAmount: {
    flex: 1,
    fontSize: t.bodyLg,
    fontWeight: '500',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  itemLast: { borderBottomWidth: 0 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: space.xs,
  },
  link: { fontSize: t.body, fontWeight: '500', color: c.primary },
  deleteText: { fontSize: t.body, fontWeight: '500', color: c.destructive },
}));

export default FundRequestScreen;
