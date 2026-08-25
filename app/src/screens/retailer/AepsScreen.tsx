import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const services = [
  { name: 'Cash Withdrawal', icon: 'cash-minus', description: 'Aadhaar enabled cash withdrawal', route: 'Withdrawal' },
  { name: 'Balance Enquiry', icon: 'scale-balance', description: 'Check account balance via Aadhaar', route: 'BalanceEnquiry' },
  { name: 'Mini Statement', icon: 'file-document', description: 'Get last 10 transactions', route: 'MiniStatement' },
  { name: 'Aadhaar Pay', icon: 'qrcode-scan', description: 'Accept payments via Aadhaar', route: 'AadhaarPay' },
];

export const AepsScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>AEPS Services</Text>
          <Text style={styles.pageSubtitle}>Aadhaar Enabled Payment System</Text>
        </View>
        <MaterialCommunityIcons name="fingerprint" size={32} color={colors.primary} />
      </View>

      <View style={styles.servicesGrid}>
        {services.map((service, index) => (
          <TouchableOpacity
            key={index}
            style={styles.serviceCard}
            activeOpacity={0.8}
          >
            <View style={[styles.serviceIcon, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name={service.icon as any} size={24} color="white" />
            </View>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceDesc}>{service.description}</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }}>
              Proceed
            </Button>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.infoCard}>
        <CardHeader>
          <CardTitle>Important Information</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              AEPS services require biometric authentication. Ensure your device has a registered biometric device connected.
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            <Text style={styles.infoText}>
              All transactions are secured with 256-bit encryption and comply with NPCI guidelines.
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={20} color="#F59E0B" />
            <Text style={styles.infoText}>
              Transaction limits: ₹10,000 per transaction, ₹25,000 daily per customer.
            </Text>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
};

const styles = themed((c) => ({
  scrollView: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: c.foreground,
  },
  pageSubtitle: {
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 2,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    gap: 10,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.foreground,
    textAlign: 'center',
  },
  serviceDesc: {
    fontSize: 11,
    color: c.mutedForeground,
    textAlign: 'center',
  },
  infoCard: {
    marginTop: 8,
  },
  infoItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: c.foreground,
    flex: 1,
    lineHeight: 20,
  },
}));

export default AepsScreen;