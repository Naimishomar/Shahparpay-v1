import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const upiServices = [
  { name: 'Collect Payment', icon: 'qrcode-scan', desc: 'Generate QR/Link to collect', color: '#10B981' },
  { name: 'Pay UPI ID', icon: 'send', desc: 'Send money to any UPI ID', color: '#3B82F6' },
  { name: 'Scan & Pay', icon: 'camera', desc: 'Scan QR code to pay', color: '#8B5CF6' },
  { name: 'Transaction History', icon: 'history', desc: 'View all UPI transactions', color: '#F59E0B' },
];

export const UpiPaymentsScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>UPI Payments</Text>
          <Text style={styles.pageSubtitle}>Instant payments via UPI</Text>
        </View>
        <Ionicons name="wallet" size={32} color="#10B981" />
      </View>

      <View style={styles.servicesGrid}>
        {upiServices.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
              <MaterialCommunityIcons name={service.icon as any} size={24} color={service.color} />
            </View>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDesc}>{service.desc}</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }} fullWidth>Open</Button>
          </View>
        ))}
      </View>

      <Card style={styles.balanceCard}>
        <CardContent style={styles.balanceContent}>
          <View>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceAmount}>₹ 0.00</Text>
          </View>
          <View style={styles.balanceActions}>
            <Button variant="outline" size="sm">Add Money</Button>
            <Button size="sm">Withdraw</Button>
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
  balanceCard: { marginTop: 8 },
  balanceContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: c.mutedForeground },
  balanceAmount: { fontSize: 24, fontWeight: '700', color: c.foreground },
  balanceActions: { flexDirection: 'row', gap: 8 },
}));

export default UpiPaymentsScreen;