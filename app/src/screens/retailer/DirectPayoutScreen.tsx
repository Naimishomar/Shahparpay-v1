import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const DirectPayoutScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Direct Payout</Text>
          <Text style={styles.pageSubtitle}>Instant payout to bank accounts</Text>
        </View>
        <Ionicons name="send" size={32} color="#06B6D4" />
      </View>

      <Card style={styles.payoutCard}>
        <CardHeader>
          <CardTitle>New Payout</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Beneficiary Name *</Text>
            <Text style={styles.fieldValue}>Enter beneficiary name</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Account Number *</Text>
            <Text style={styles.fieldValue}>Enter bank account number</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>IFSC Code *</Text>
            <Text style={styles.fieldValue}>Enter IFSC code</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Amount *</Text>
            <Text style={styles.fieldValue}>Enter payout amount</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Purpose *</Text>
            <Text style={styles.fieldValue}>Select payout purpose</Text>
          </View>
          <Button style={{ marginTop: 16 }} size="lg">Process Payout</Button>
        </CardContent>
      </Card>

      <Card style={styles.beneficiaryCard}>
        <CardHeader>
          <CardTitle>Saved Beneficiaries</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No saved beneficiaries</Text>
            <Text style={styles.emptySubtext}>Add beneficiaries for faster payouts</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }}>Add Beneficiary</Button>
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
  payoutCard: {},
  beneficiaryCard: { marginTop: 8 },
  formField: { marginBottom: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: c.mutedForeground },
  fieldValue: { fontSize: 14, color: c.foreground },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', color: c.foreground },
  emptySubtext: { fontSize: 12, color: c.mutedForeground },
}));

export default DirectPayoutScreen;