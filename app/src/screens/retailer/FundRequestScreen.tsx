import React, { useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
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
  isoDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { ImageField } from '@/components/ui/ImageField';
import { IconTile } from '@/components/ui/Gradient';
import { useAsync, useAction } from '@/hooks/useAsync';
import type { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

const MODES = [
  { key: 'NEFT', label: 'NEFT' },
  { key: 'IMPS', label: 'IMPS' },
  { key: 'RTGS', label: 'RTGS' },
  { key: 'UPI', label: 'UPI' },
  { key: 'CASH_DEPOSIT', label: 'Cash deposit' },
  { key: 'CHEQUE', label: 'Cheque' },
] as const;

/** Local date, not UTC: before 05:30 IST toISOString() is still on yesterday,
 *  so the deposit date defaulted to the wrong day every early morning. */
const today = () => isoDate(new Date());
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const FundRequestScreen: React.FC = () => {
  const [mode, setMode] = useState<string>('NEFT');
  const [amount, setAmount] = useState('');
  const [bankUtr, setBankUtr] = useState('');
  const [depositDate, setDepositDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [depositSlip, setDepositSlip] = useState<PickedFile | null>(null);
  const [notice, setNotice] = useState('');

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
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const remove = useAction(async (id: string) => {
    const res = await api.deleteFundRequest(id);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const dateValid = DATE_RE.test(depositDate) && !Number.isNaN(Date.parse(depositDate));
  const valid = Number(amount) > 0 && bankUtr.trim().length >= 4 && dateValid;

  const onSubmit = async () => {
    setNotice('');
    const res = await submit.run();
    if (res) {
      setNotice(res.message || 'Fund request submitted for approval.');
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
      `This permanently removes the ${money(item.amount)} request. It cannot be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await remove.run(item._id);
            if (res) {
              setNotice('Fund request deleted.');
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
      <SectionTitle>New fund request</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>How did you pay?</Text>
            <Segmented
              options={MODES.map((m) => ({ key: m.key as string, label: m.label }))}
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
            placeholder="0.00"
            leftIcon="currency-inr"
          />
          <Input
            label="Bank UTR / reference"
            required
            value={bankUtr}
            onChangeText={setBankUtr}
            autoCapitalize="characters"
            placeholder="From your bank receipt"
            leftIcon="pound"
            helperText="Your distributor uses this to match the deposit"
          />
          <Input
            label="Deposit date"
            required
            value={depositDate}
            onChangeText={setDepositDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            leftIcon="calendar-outline"
            error={depositDate && !dateValid ? 'Use the format YYYY-MM-DD' : undefined}
          />
          <ImageField
            label="Deposit slip"
            value={depositSlip}
            onChange={setDepositSlip}
            helperText="A photo of the receipt or transfer screenshot gets your request approved faster"
          />
          <Input
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional note for your distributor"
            multiline
            leftIcon="note-text-outline"
          />

          {!!submit.error && <ErrorBanner message={submit.error} />}
          {!!notice && <SuccessBanner message={notice} />}

          <Button
            onPress={onSubmit}
            disabled={!valid}
            loading={submit.pending}
            size="lg"
            fullWidth
          >
            Submit request
          </Button>
        </CardContent>
      </Card>

      <SectionTitle>Request history</SectionTitle>
      <Card>
        <CardContent>
          {!!remove.error && <ErrorBanner message={remove.error} />}
          {requests.loading ? <SkeletonRows count={3} /> : requests.data?.length ? (
            requests.data.map((req: any, index: number, shown: any[]) => (
              <View key={req._id} style={[styles.item, index === shown.length - 1 && styles.itemLast]}>
                <View style={styles.itemTop}>
                  <IconTile icon="hand-coin-outline" size={44} iconSize={20} />
                  <Text style={styles.itemAmount} numberOfLines={1}>
                    {money(req.amount)}
                  </Text>
                  <StatusText status={req.status} />
                </View>
                <Row label="Mode" value={String(req.transactionMode || '').replace(/_/g, ' ')} />
                <Row label="UTR" value={req.bankUtr} />
                <Row label="Deposited" value={shortDate(req.depositDate)} />
                <Row label="Requested" value={shortDate(req.createdAt)} last={!req.adminRemarks} />
                {!!req.adminRemarks && <Row label="Remarks" value={req.adminRemarks} last />}
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
              title="No fund requests yet"
              subtitle="Submitted requests and their approval status show up here"
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
  deleteText: { fontSize: t.body, fontWeight: '500', color: c.destructive },
}));

export default FundRequestScreen;
