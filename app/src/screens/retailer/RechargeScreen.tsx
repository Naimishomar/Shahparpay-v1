import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const rechargeCategories = [
  { name: 'Mobile Recharge', icon: 'cellphone', desc: 'Prepaid & Postpaid', color: '#3B82F6', operators: ['Jio', 'Airtel', 'Vi', 'BSNL'] },
  { name: 'DTH Recharge', icon: 'television', desc: 'All major DTH operators', color: '#8B5CF6', operators: ['Tata Play', 'Airtel DTH', 'Dish TV', 'Sun Direct'] },
  { name: 'Data Card', icon: 'wifi', desc: 'Datacard & Dongle recharge', color: '#06B6D4', operators: ['JioFi', 'Airtel 4G', 'Vi MiFi'] },
  { name: 'Broadband', icon: 'lan', desc: 'Landline & Broadband bills', color: '#F59E0B', operators: ['JioFiber', 'Airtel Xstream', 'ACT', 'Hathway'] },
];

export const RechargeScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Recharge & Bills</Text>
          <Text style={styles.pageSubtitle}>Mobile, DTH, Data & Broadband</Text>
        </View>
        <Ionicons name="smartphone" size={32} color="#3B82F6" />
      </View>

      <View style={styles.categoriesGrid}>
        {rechargeCategories.map((cat, index) => (
          <View key={index} style={styles.categoryCard}>
            <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
              <MaterialCommunityIcons name={cat.icon} size={28} color={cat.color} />
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
            <Text style={styles.categoryDesc}>{cat.desc}</Text>
            <View style={styles.operators}>
              {cat.operators.slice(0, 3).map((op, i) => (
                <Text key={i} style={styles.operatorTag}>{op}</Text>
              ))}
              {cat.operators.length > 3 && (
                <Text style={styles.operatorTag}>+{cat.operators.length - 3} more</Text>
              )}
            </View>
            <Button variant="outline" size="sm" className="mt-3" fullWidth>Recharge</Button>
          </View>
        ))}
      </View>

      <Card style={styles.offersCard}>
        <CardHeader>
          <CardTitle>Running Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.offersList}>
            {[
              'Jio: Get 10% cashback up to ₹50 on ₹299+ recharge',
              'Airtel: Free 1GB data on ₹199+ recharge',
              'Vi: ₹20 cashback on first recharge this month',
            ].map((offer, i) => (
              <View key={i} style={styles.offerItem}>
                <Ionicons name="flash" size={16} color="#F59E0B" />
                <Text style={styles.offerText}>{offer}</Text>
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
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  categoryCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: 'var(--card)', borderWidth: 1, borderColor: 'var(--border)', gap: 10 },
  categoryIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  categoryName: { fontSize: 14, fontWeight: '600', color: 'var(--foreground)' },
  categoryDesc: { fontSize: 11, color: 'var(--muted-foreground)' },
  operators: { flexDirection: 'row', flexWrap: 'row', gap: 6, marginTop: 4 },
  operatorTag: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'var(--secondary)', color: 'var(--foreground)' },
  offersCard: { marginTop: 8 },
  offersList: { gap: 8 },
  offerItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  offerText: { fontSize: 12, color: 'var(--foreground)', flex: 1 },
});

export default RechargeScreen;