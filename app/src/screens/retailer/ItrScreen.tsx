import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const itrForms = [
  { name: 'ITR-1 (Sahaj)', desc: 'Salary, one house property, other sources', eligibility: 'Income ≤ ₹50L', icon: 'file-document' },
  { name: 'ITR-2', desc: 'Capital gains, foreign income, >1 house', eligibility: 'Income > ₹50L', icon: 'file-chart' },
  { name: 'ITR-3', desc: 'Business/profession income', eligibility: 'Business income', icon: 'briefcase' },
  { name: 'ITR-4 (Sugam)', desc: 'Presumptive business income', eligibility: 'Income ≤ ₹50L', icon: 'calculator' },
];

export const ItrScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>ITR Filing</Text>
          <Text style={styles.pageSubtitle}>File your income tax returns easily</Text>
        </View>
        <MaterialCommunityIcons name="file-document-outline" size={32} color="#6366F1" />
      </View>

      <View style={styles.formsGrid}>
        {itrForms.map((form, index) => (
          <View key={index} style={styles.formCard}>
            <View style={[styles.formIcon, { backgroundColor: '#6366F120' }]}>
              <MaterialCommunityIcons name={form.icon as any} size={24} color="#6366F1" />
            </View>
            <Text style={styles.formName}>{form.name}</Text>
            <Text style={styles.formDesc}>{form.desc}</Text>
            <Text style={styles.formEligibility}>{form.eligibility}</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }} fullWidth>File Now</Button>
          </View>
        ))}
      </View>

      <Card style={styles.infoCard}>
        <CardHeader>
          <CardTitle>Documents Required</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.docGrid}>
            {['Form 16', 'Form 26AS', 'AIS/TIS', 'Bank Statements', 'Investment Proofs', 'Rent Receipts'].map((doc, i) => (
              <View key={i} style={styles.docTag}>
                <Text style={styles.docTagText}>{doc}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.dueDateCard}>
        <CardContent style={styles.dueDateContent}>
          <View style={styles.dueDateIcon}>
            <Ionicons name="calendar" size={28} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.dueDateTitle}>Filing Deadline</Text>
            <Text style={styles.dueDateValue}>31st July 2024 (AY 2024-25)</Text>
            <Text style={styles.dueDateNote}>Late filing fee up to ₹5,000</Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
};

const styles = themed((c) => ({
  scrollView: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: c.foreground },
  pageSubtitle: { fontSize: 13, color: c.mutedForeground, marginTop: 2 },
  formsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  formCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, gap: 8 },
  formIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  formName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  formDesc: { fontSize: 11, color: c.mutedForeground },
  formEligibility: { fontSize: 11, color: '#6366F1', fontWeight: '500' },
  infoCard: { marginTop: 8 },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  docTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.secondary },
  docTagText: { fontSize: 12, color: c.foreground },
  dueDateCard: { marginTop: 8 },
  dueDateContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dueDateIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F59E0B20', justifyContent: 'center', alignItems: 'center' },
  dueDateTitle: { fontSize: 12, color: c.mutedForeground },
  dueDateValue: { fontSize: 16, fontWeight: '700', color: c.foreground },
  dueDateNote: { fontSize: 11, color: '#F59E0B' },
}));

export default ItrScreen;