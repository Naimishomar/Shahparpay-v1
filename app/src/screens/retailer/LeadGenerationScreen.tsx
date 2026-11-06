import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { themed, space, type as t, radius, colors } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import { Input, SelectField } from '@/components/ui/Input';
import { Screen, SectionTitle, Grid, Segmented, Toast } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import api from '@/services/api';

// Product codes the backend forwards to PaySprint; same list as the web.
const PRODUCTS = [
  { key: 'CC', label: 'Credit Card' },
  { key: 'PL', label: 'Personal Loan' },
  { key: 'BL', label: 'Business Loan' },
  { key: 'IL', label: 'Instant Loan' },
  { key: 'SA', label: 'Savings Account' },
];

const EMPTY = { name: '', mobile_no: '', email: '', product: 'CC', pincode: '', state: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same buckets as the web's status pill, keyed on executive_status. */
const bucket = (status?: string) => {
  const s = String(status || 'PENDING').toUpperCase();
  if (s.includes('APPROV') || s.includes('SUCCESS') || s.includes('DISBURS')) return 'approved';
  if (s.includes('REJECT') || s.includes('NOT_INTERESTED') || s.includes('FAIL')) return 'rejected';
  return 'pending';
};

export const LeadGenerationScreen: React.FC = () => {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [showStates, setShowStates] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({ message: '', tone: 'error' });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  // The web only reads history for the three counters; a failure is a toast,
  // not a blocked page.
  const leads = useAsync<any[]>(async () => {
    try {
      const res = await api.getLeadHistory();
      return res.success ? res.data ?? [] : [];
    } catch {
      setToast({ message: 'Failed to load leads history.', tone: 'error' });
      return [];
    }
  }, []);

  const list = leads.data ?? [];
  const approvedCount = list.filter((l) => bucket(l.executive_status) === 'approved').length;
  const pendingCount = list.filter((l) => bucket(l.executive_status) === 'pending').length;
  const productName = PRODUCTS.find((p) => p.key === form.product)?.label || form.product;

  const filteredStates = useMemo(
    () => INDIAN_STATES.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())),
    [stateQuery]
  );

  const onSubmit = async () => {
    if (!form.name || !form.mobile_no || !form.email || !form.product) {
      setToast({ message: 'Please fill in all required fields.', tone: 'error' });
      return;
    }
    // The web's type="email" field blocks the submit on a malformed address.
    if (!EMAIL_RE.test(form.email)) {
      setToast({ message: 'Please enter a valid email address.', tone: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.generateLead(form);
      if (data.success) {
        setToast({ message: 'Lead generated successfully!', tone: 'success' });
        setForm(EMPTY);
        leads.reload();
        // ponytail: web POSTs `encdata` in a hidden form; the app can only GET the URL.
        if (data.data?.url) Linking.openURL(data.data.url).catch(() => {});
      } else {
        setToast({ message: data.message || 'Failed to generate lead.', tone: 'error' });
      }
    } catch (error: any) {
      const body = error?.response?.data;
      setToast({
        message: body ? body.message || 'Failed to generate lead.' : 'An error occurred during submission.',
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      refreshing={leads.refreshing}
      onRefresh={leads.refresh}
      overlay={<Toast message={toast.message} tone={toast.tone} onHide={() => setToast((s) => ({ ...s, message: '' }))} />}
    >
      <Text style={styles.help}>Generate leads for credit cards, loans and accounts, and track their status.</Text>
      <Grid columns={3}>
        <Tile icon="account-group-outline" label="Total leads" value={leads.loading ? '…' : String(list.length)} />
        <Tile icon="check-circle-outline" label="Approved" value={leads.loading ? '…' : String(approvedCount)} tone="success" />
        <Tile icon="clock-outline" label="In progress" value={leads.loading ? '…' : String(pendingCount)} tone="warning" />
      </Grid>

      <Card>
        <CardContent style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              Choose a product<Text style={styles.required}> *</Text>
            </Text>
            <Segmented options={PRODUCTS} value={form.product} onChange={(product) => set({ product })} />
          </View>
        </CardContent>
      </Card>

      <SectionTitle>Customer details</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <Input
            label="Customer Name"
            required
            value={form.name}
            onChangeText={(name) => set({ name })}
            leftIcon="account-outline"
            autoComplete="name"
            placeholder="Enter full name"
          />
          <Input
            label="Mobile Number"
            required
            value={form.mobile_no}
            onChangeText={(v) => set({ mobile_no: v.replace(/\D/g, '').slice(0, 10) })}
            keyboardType="phone-pad"
            leftIcon="phone-outline"
            autoComplete="tel"
            placeholder="Enter 10 digit mobile"
          />
          <Input
            label="Email ID"
            required
            value={form.email}
            onChangeText={(email) => set({ email })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="email-outline"
            placeholder="Enter email address"
          />
          <Input
            label="Pincode"
            value={form.pincode}
            onChangeText={(v) => set({ pincode: v.replace(/\D/g, '').slice(0, 6) })}
            keyboardType="number-pad"
            leftIcon="map-marker-outline"
            placeholder="6 digit pincode"
          />

          <SelectField
            label="State"
            value={form.state}
            placeholder="Select State"
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
                      set({ state: s });
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

          <Button onPress={onSubmit} loading={submitting} size="lg" fullWidth icon="link-variant">
            {`Generate ${productName} Link`}
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
};

const Tile: React.FC<{
  icon: string;
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'error';
}> = ({ icon, label, value, tone }) => (
  <View style={styles.tile}>
    <IconTile icon={icon} size={40} iconSize={18} />
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
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  tileLabel: { fontSize: t.small, color: c.mutedForeground },
  tileValue: {
    fontSize: t.h2,
    fontWeight: '400',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
  required: { color: c.destructive },
  picker: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
}));

export default LeadGenerationScreen;
