import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const settlementServices = [
  { name: 'Fund Transfer', icon: 'bank-transfer', desc: 'Transfer funds to bank accounts', color: '#3B82F6' },
  { name: 'Bulk Payout', icon: 'package-variant', desc: 'Process multiple payouts at once', color: '#8B5CF6' },
  { name: 'Payout Report', icon: 'file-chart', desc: 'View settlement history', color: '#06B6D4' },
  { name: 'Beneficiary Mgmt', icon: 'account-group', desc: 'Manage beneficiary accounts', color: '#F59E0B' },
];

export const AepsSettlementScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>AEPS Settlement</Text>
          <Text style={styles.pageSubtitle}>Fund settlement and payout management</Text>
        </View>
        <MaterialCommunityIcons name="bank" size={32} color="#06B6D4" />
      </View>

      <View style={styles.servicesGrid}>
        {settlementServices.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
              <MaterialCommunityIcons name={service.icon as any} size={24} color={service.color} />
            </View>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDesc}>{service.desc}</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }}>
              Open
            </Button>
          </View>
        ))}
      </View>

      <Card style={styles.summaryCard}>
        <CardHeader>
          <CardTitle>Settlement Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pending Settlements</Text>
              <Text style={styles.summaryValue}>₹ 0.00</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Settled Today</Text>
              <Text style={styles.summaryValue}>₹ 0.00</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Failed Transactions</Text>
              <Text style={styles.summaryValue}>0</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total This Month</Text>
              <Text style={styles.summaryValue}>₹ 0.00</Text>
            </View>
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
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  serviceCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', gap: 10 },
  serviceIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  serviceName: { fontSize: 14, fontWeight: '600', color: c.foreground, textAlign: 'center' },
  serviceDesc: { fontSize: 11, color: c.mutedForeground, textAlign: 'center' },
  summaryCard: { marginTop: 8 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { width: '48%', padding: 12, borderRadius: 12, backgroundColor: c.secondary, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: c.mutedForeground, textAlign: 'center', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: c.foreground },
}));

export default AepsSettlementScreen;