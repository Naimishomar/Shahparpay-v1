import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const WalletTransferScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Wallet Transfer</Text>
          <Text style={styles.pageSubtitle}>Transfer funds between wallets</Text>
        </View>
        <Ionicons name="wallet" size={32} color="#10B981" />
      </View>

      <Card style={styles.balanceCard}>
        <CardContent style={styles.balanceContent}>
          <View style={styles.walletItem}>
            <View style={[styles.walletIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="wallet" size={24} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.walletLabel}>AEPS Wallet</Text>
              <Text style={styles.walletAmount}>₹ 0.00</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.walletItem}>
            <View style={[styles.walletIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="wallet" size={24} color="#10B981" />
            </View>
            <View>
              <Text style={styles.walletLabel}>Main Wallet</Text>
              <Text style={styles.walletAmount}>₹ 0.00</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.transferCard}>
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>From Wallet</Text>
            <View style={styles.selectWrapper}>
              <Text style={styles.selectValue}>AEPS Wallet</Text>
              <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>To Wallet</Text>
            <View style={styles.selectWrapper}>
              <Text style={styles.selectValue}>Main Wallet</Text>
              <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Amount *</Text>
            <Text style={styles.fieldValue}>Enter amount to transfer</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Remarks</Text>
            <Text style={styles.fieldValue}>Optional</Text>
          </View>
          <Button style={{ marginTop: 16 }} size="lg">Transfer Now</Button>
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
  balanceCard: {},
  balanceContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  walletLabel: { fontSize: 12, color: c.mutedForeground },
  walletAmount: { fontSize: 18, fontWeight: '700', color: c.foreground },
  divider: { width: 1, height: 40, backgroundColor: c.border },
  transferCard: { marginTop: 8 },
  formField: { marginBottom: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: c.mutedForeground },
  selectWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
  selectValue: { fontSize: 14, color: c.foreground },
  fieldValue: { fontSize: 14, color: c.foreground },
}));

export default WalletTransferScreen;