import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { themed, space, type as t, radius, colors } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  Grid,
  Row,
  Segmented,
  StatusPill,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import api from '@/services/api';

const PRODUCTS = [
  { key: 'Credit Card', label: 'Credit Card' },
  { key: 'Personal Loan', label: 'Personal Loan' },
  { key: 'Business Loan', label: 'Business Loan' },
  { key: 'Home Loan', label: 'Home Loan' },
  { key: 'Loan Against Property', label: 'Loan Against Property' },
  { key: 'Insurance', label: 'Insurance' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LeadGenerationScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [product, setProduct] = useState(PRODUCTS[0].key);
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [showStates, setShowStates] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [notice, setNotice] = useState('');

  const leads = useAsync<any[]>(async () => (await api.getLeadHistory()).data ?? [], []);

  const submit = useAction(async () => {
    const res = await api.generateLead({
      name: name.trim(),
      mobile_no: mobile.trim(),
      email: email.trim() || undefined,
      product,
      pincode: pincode.trim(),
      state,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const refreshStatus = useAction(async (refid: string) => {
    const res = await api.getLeadStatus(refid);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const emailInvalid = !!email && !EMAIL_RE.test(email.trim());
  const valid =
    name.trim().length > 2 && mobile.length === 10 && pincode.length === 6 && !!state && !emailInvalid;

  const filteredStates = useMemo(
    () =>
      INDIAN_STATES.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())),
    [stateQuery]
  );

  const stats = (leads.data ?? []).reduce(
    (acc: any, lead: any) => {
      const s = String(lead.status || 'PENDING').toUpperCase();
      acc.total += 1;
      if (['APPROVED', 'CONVERTED', 'SUCCESS'].includes(s)) acc.converted += 1;
      else if (['REJECTED', 'FAILED'].includes(s)) acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { total: 0, converted: 0, pending: 0, rejected: 0 }
  );

  const onSubmit = async () => {
    setNotice('');
    const res = await submit.run();
    if (res) {
      setNotice(res.message || 'Lead submitted.');
      setName('');
      setMobile('');
      setEmail('');
      setPincode('');
      leads.reload();
    }
  };

  const onCheckStatus = async (refid: string) => {
    setNotice('');
    const res = await refreshStatus.run(refid);
    if (res) {
      setNotice(`Status: ${res.data?.executive_status || res.data?.status || 'Pending'}`);
      leads.reload();
    }
  };

  return (
    <Screen
      refreshing={leads.refreshing}
      onRefresh={leads.refresh}
      error={leads.error}
      onRetry={leads.reload}
    >
      <Grid columns={2}>
        <Tile label="Total leads" value={String(stats.total)} />
        <Tile label="Converted" value={String(stats.converted)} tone="success" />
        <Tile label="Pending" value={String(stats.pending)} tone="warning" />
        <Tile label="Rejected" value={String(stats.rejected)} tone="error" />
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle icon="account-plus-outline">New lead</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              Product<Text style={styles.required}> *</Text>
            </Text>
            <Segmented options={PRODUCTS} value={product} onChange={setProduct} />
          </View>

          <Input
            label="Customer name"
            required
            value={name}
            onChangeText={setName}
            leftIcon="account-outline"
            autoComplete="name"
          />
          <Input
            label="Mobile number"
            required
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            leftIcon="phone-outline"
            autoComplete="tel"
            placeholder="10 digits"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="email-outline"
            error={emailInvalid ? 'Enter a valid email address' : undefined}
          />
          <Input
            label="Pincode"
            required
            value={pincode}
            onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            leftIcon="map-marker-outline"
            placeholder="6 digits"
          />

          <SelectField
            label="State"
            required
            value={state}
            placeholder="Select state"
            open={showStates}
            onPress={() => setShowStates(!showStates)}
          />
          {showStates && (
            <View style={styles.picker}>
              <Input
                placeholder="Search state"
                value={stateQuery}
                onChangeText={setStateQuery}
                leftIcon="magnify"
                autoCapitalize="none"
              />
              <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredStates.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setState(s);
                      setShowStates(false);
                      setStateQuery('');
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>{s}</Text>
                  </Pressable>
                ))}
                {!filteredStates.length && <Text style={styles.pickerEmpty}>No matching state</Text>}
              </ScrollView>
            </View>
          )}

          {!!submit.error && <ErrorBanner message={submit.error} />}
          {!!notice && <SuccessBanner message={notice} />}
          <Button
            onPress={onSubmit}
            disabled={!valid}
            loading={submit.pending}
            icon="send-outline"
            size="lg"
            fullWidth
          >
            Generate lead
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Lead history</CardTitle>
        </CardHeader>
        <CardContent>
          {!!refreshStatus.error && <ErrorBanner message={refreshStatus.error} />}
          {leads.loading ? null : leads.data?.length ? (
            leads.data.slice(0, 25).map((lead: any) => (
              <View key={lead._id || lead.refid} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {lead.name}
                  </Text>
                  <StatusPill status={lead.executive_status || lead.status} />
                </View>
                <Row label="Product" value={lead.product} />
                <Row label="Mobile" value={lead.mobile_no || lead.mobile} />
                <Row label="Reference" value={lead.refid} />
                <Row label="Created" value={shortDate(lead.createdAt)} last />
                {!!lead.refid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                    onPress={() => onCheckStatus(lead.refid)}
                    loading={refreshStatus.pending}
                    style={styles.statusButton}
                  >
                    Check status
                  </Button>
                )}
              </View>
            ))
          ) : (
            <EmptyState icon="account-group-outline" title="No leads generated yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const Tile: React.FC<{ label: string; value: string; tone?: 'success' | 'warning' | 'error' }> = ({
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
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  required: { color: c.destructive },
  picker: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
  },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  itemName: { flex: 1, minWidth: 0, fontSize: t.body, fontWeight: '700', color: c.foreground },
  statusButton: { alignSelf: 'flex-start', marginTop: space.xs },
}));

export default LeadGenerationScreen;
