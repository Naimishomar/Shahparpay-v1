import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
              <Ionicons name="chevron-down" size={20} color="var(--muted-foreground)" />
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>To Wallet</Text>
            <View style={styles.selectWrapper}>
              <Text style={styles.selectValue}>Main Wallet</Text>
              <Ionicons name="chevron-down" size={20} color="var(--muted-foreground)" />
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
          <Button className="mt-4" size="lg">Transfer Now</Button>
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
  balanceCard: {},
  balanceContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  walletLabel: { fontSize: 12, color: 'var(--muted-foreground)' },
  walletAmount: { fontSize: 18, fontWeight: '700', color: 'var(--foreground)' },
  divider: { width: 1, height: 40, backgroundColor: 'var(--border)' },
  transferCard: { marginTop: 8 },
  formField: { marginBottom: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: 'var(--muted-foreground)' },
  selectWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: 'var(--border)', backgroundColor: 'var(--background)' },
  selectValue: { fontSize: 14, color: 'var(--foreground)' },
  fieldValue: { fontSize: 14, color: 'var(--foreground)' },
});

export default WalletTransferScreen;