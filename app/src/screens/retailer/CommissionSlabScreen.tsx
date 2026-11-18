import React from 'react';
import { View, Text } from 'react-native';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Screen, SkeletonRows } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

const API_PATH = '/api/commission';

type Slab = { label: string; sample: number; earns: number };
type Row = { left: string; right: string; muted?: boolean };

const rupees = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const slabRows = (slabs: Slab[] = [], perSample: boolean): Row[] =>
  slabs.map((s) => ({
    left: s.label,
    right: s.earns ? (perSample ? `${rupees(s.earns)} on ${rupees(s.sample)}` : rupees(s.earns)) : 'No commission',
    muted: !s.earns,
  }));

/** /api/commission as sections; mirrors frontend/src/lib/rateCard.ts. */
const sections = (r: any): { title: string; note: string; rows: Row[] }[] => {
  const tds = `${r.aeps.tdsPercent}% TDS is deducted.`;
  return [
    { title: 'AEPS cash withdrawal', note: `Per transaction. ${tds}`, rows: slabRows(r.aeps.withdrawal, true) },
    { title: 'UPI cash withdrawal', note: `Flat per transaction, ₹500 to ₹5,000. ${tds}`, rows: slabRows(r.upiCashWithdrawal, false) },
    { title: 'AEPS cash deposit', note: `Per transaction. ${tds}`, rows: slabRows(r.aeps.deposit, false) },
    { title: 'Micro ATM cash withdrawal', note: `Per transaction. ${tds}`, rows: slabRows(r.matm, true) },
    { title: 'Mobile recharge', note: `Percentage of the recharge amount. ${tds}`, rows: r.prepaid.map((o: any) => ({ left: o.name, right: `${o.percent}%` })) },
    { title: 'DTH recharge', note: 'Percentage of the recharge amount.', rows: r.dth.map((o: any) => ({ left: o.name, right: `${o.percent}%` })) },
    { title: 'BBPS bill payments', note: 'Flat per bill, except where a percentage is shown.', rows: r.bbps.map((b: any) => ({ left: b.name, right: b.kind === 'flat' ? rupees(b.value) : `${b.value}%` })) },
    { title: 'PAN card', note: `Per application. ${tds}`, rows: [{ left: `Application at ${rupees(r.pan.fee)}`, right: rupees(r.pan.earns) }] },
    { title: 'Lead generation', note: `Flat, once the lead is approved. ${tds}`, rows: r.leads.map((l: any) => ({ left: l.name, right: rupees(l.earns) })) },
    { title: 'Service charges', note: 'Debited with the transaction and refunded if it fails.', rows: r.charges.map((c: any) => ({ left: c.name, right: `${rupees(c.fee)}${c.plusGst ? ' + GST' : ''}`, muted: true })) },
  ];
};

/** The retailer's rate card in one place, as on the web portal's Commission Slab page. */
export const CommissionSlabScreen: React.FC = () => {
  const rates = useAsync<any>(async () => (await api.get(API_PATH)).data, []);
  return (
    <Screen loading={rates.loading} skeleton={<SkeletonRows count={6} />} error={rates.error} onRetry={rates.reload} refreshing={rates.refreshing} onRefresh={rates.refresh}>
      {rates.data &&
        sections(rates.data).map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.note}>{s.note}</Text>
            {s.rows.map((row) => (
              <View key={row.left} style={styles.row}>
                <Text style={styles.left}>{row.left}</Text>
                <Text style={[styles.right, row.muted && styles.mutedText]}>{row.right}</Text>
              </View>
            ))}
          </View>
        ))}
    </Screen>
  );
};

const styles = themed((c) => ({
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.border, gap: space.xs },
  title: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  note: { fontSize: t.small, color: c.mutedForeground, marginBottom: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.border },
  left: { flex: 1, fontSize: t.small, color: c.foreground },
  right: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  mutedText: { color: c.mutedForeground },
}));
