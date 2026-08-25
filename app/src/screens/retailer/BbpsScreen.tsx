import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const billerCategories = [
  { name: 'Electricity', icon: 'flash', color: '#F59E0B', billers: ['BESCOM', 'MSEB', 'KSEB', 'TNEB', 'APEPDCL'] },
  { name: 'Gas', icon: 'fire', color: '#EF4444', billers: ['IOCL', 'BPCL', 'HP Gas', 'Indane', 'GAIL'] },
  { name: 'Water', icon: 'water', color: '#3B82F6', billers: ['BWSSB', 'MCGM', 'DJB', 'KWA', 'CMWSSB'] },
  { name: 'Broadband', icon: 'wifi', color: '#8B5CF6', billers: ['JioFiber', 'Airtel Xstream', 'ACT', 'Hathway', 'BSNL'] },
  { name: 'Insurance', icon: 'shield', color: '#10B981', billers: ['LIC', 'HDFC Life', 'ICICI Pru', 'SBI Life', 'Max Life'] },
  { name: 'Loan Repayment', icon: 'bank', color: '#06B6D4', billers: ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak'] },
  { name: 'Credit Card', icon: 'credit-card', color: '#F43F5E', billers: ['HDFC', 'SBI', 'ICICI', 'Axis', 'Amex'] },
  { name: 'FASTag', icon: 'car', color: '#6366F1', billers: ['NHAI', 'ICICI', 'HDFC', 'Axis', 'Paytm'] },
];

export const BbpsScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>BBPS Bill Payments</Text>
          <Text style={styles.pageSubtitle}>Pay all your bills in one place</Text>
        </View>
        <Ionicons name="receipt" size={32} color="#F59E0B" />
      </View>

      <View style={styles.categoriesGrid}>
        {billerCategories.map((cat, index) => (
          <View key={index} style={styles.categoryCard}>
            <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
              <MaterialCommunityIcons name={cat.icon as any} size={28} color={cat.color} />
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
            <Text style={styles.categoryCount}>{cat.billers.length}+ Billers</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }} fullWidth>Pay Bill</Button>
          </View>
        ))}
      </View>

      <Card style={styles.recentCard}>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No recent bill payments</Text>
            <Text style={styles.emptySubtext}>Your payments will appear here</Text>
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
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  categoryCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', gap: 10 },
  categoryIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  categoryName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  categoryCount: { fontSize: 11, color: c.mutedForeground },
  recentCard: { marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', color: c.foreground },
  emptySubtext: { fontSize: 12, color: c.mutedForeground },
}));

export default BbpsScreen;