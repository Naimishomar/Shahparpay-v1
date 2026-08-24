import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const dmtServices = [
  { name: 'Domestic Transfer', icon: 'bank-transfer', desc: 'IMPS/NEFT to any bank', color: '#3B82F6' },
  { name: 'Beneficiary Mgmt', icon: 'account-plus', desc: 'Add/manage beneficiaries', color: '#8B5CF6' },
  { name: 'Transfer History', icon: 'history', desc: 'View all DMT transactions', color: '#F59E0B' },
  { name: 'Bulk Transfer', icon: 'package-variant', desc: 'Multiple transfers at once', color: '#10B981' },
];

export const DmtScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>DMT Services</Text>
          <Text style={styles.pageSubtitle}>Domestic Money Transfer</Text>
        </View>
        <Ionicons name="send" size={32} color="#3B82F6" />
      </View>

      <View style={styles.servicesGrid}>
        {dmtServices.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
              <MaterialCommunityIcons name={service.icon} size={24} color={service.color} />
            </View>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDesc}>{service.desc}</Text>
            <Button variant="outline" size="sm" className="mt-3" fullWidth>Open</Button>
          </View>
        ))}
      </View>

      <Card style={styles.limitsCard}>
        <CardHeader>
          <CardTitle>Transfer Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.limitsList}>
            {[
              { label: 'Per Transaction', value: '₹ 25,000' },
              { label: 'Daily Limit', value: '₹ 50,000' },
              { label: 'Monthly Limit', value: '₹ 2,00,000' },
              { label: 'Beneficiary Limit', value: '₹ 25,000' },
            ].map((item, i) => (
              <View key={i} style={styles.limitItem}>
                <Text style={styles.limitLabel}>{item.label}</Text>
                <Text style={styles.limitValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: 'var(--background)' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: 'var(--foreground)' },
  pageSubtitle: { fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  serviceCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: 'var(--card)', borderWidth: 1, borderColor: 'var(--border)', alignItems: 'center', gap: 10 },
  serviceIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  serviceName: { fontSize: 14, fontWeight: '600', color: 'var(--foreground)', textAlign: 'center' },
  serviceDesc: { fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center' },
  limitsCard: { marginTop: 8 },
  limitsList: { gap: 12 },
  limitItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'var(--border)' },
  limitLabel: { fontSize: 13, color: 'var(--muted-foreground)' },
  limitValue: { fontSize: 13, fontWeight: '600', color: 'var(--foreground)' },
});

export default DmtScreen;