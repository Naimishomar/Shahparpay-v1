import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const leadProducts = [
  { name: 'Credit Card', icon: 'credit-card', desc: 'Premium & lifetime free cards', color: '#F43F5E', commission: 'Up to ₹2,000' },
  { name: 'Personal Loan', icon: 'cash', desc: 'Instant approval, low interest', color: '#3B82F6', commission: 'Up to 2%' },
  { name: 'Business Loan', icon: 'briefcase', desc: 'Collateral-free up to ₹50L', color: '#06B6D4', commission: 'Up to 1.5%' },
  { name: 'Home Loan', icon: 'home', desc: 'Best rates from top banks', color: '#8B5CF6', commission: 'Up to 0.5%' },
  { name: 'Loan Against Prop', icon: 'domain', desc: 'Up to ₹10Cr, flexible tenure', color: '#F59E0B', commission: 'Up to 1%' },
  { name: 'Insurance', icon: 'shield', desc: 'Life, health & vehicle', color: '#10B981', commission: 'Up to 15%' },
];

export const LeadGenerationScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Lead Generation</Text>
          <Text style={styles.pageSubtitle}>Earn commissions on financial products</Text>
        </View>
        <Ionicons name="people" size={32} color="#14B8A6" />
      </View>

      <View style={styles.productsGrid}>
        {leadProducts.map((product, index) => (
          <View key={index} style={styles.productCard}>
            <View style={[styles.productIcon, { backgroundColor: `${product.color}20` }]}>
              <MaterialCommunityIcons name={product.icon as any} size={28} color={product.color} />
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productDesc}>{product.desc}</Text>
            <View style={styles.productFooter}>
              <Text style={styles.commission}>
                <Ionicons name="cash" size={14} color="#10B981" />
                {product.commission}
              </Text>
              <Button variant="outline" size="xs">Generate Lead</Button>
            </View>
          </View>
        ))}
      </View>

      <Card style={styles.statsCard}>
        <CardHeader>
          <CardTitle>Your Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Leads Generated</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Converted</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Earnings</Text>
              <Text style={styles.statValue}>₹ 0</Text>
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
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  productCard: { width: '48%', padding: 16, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, gap: 10 },
  productIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: c.foreground },
  productDesc: { fontSize: 11, color: c.mutedForeground },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  commission: { fontSize: 12, fontWeight: '600', color: '#10B981', flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsCard: { marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '48%', padding: 12, borderRadius: 12, backgroundColor: c.secondary, alignItems: 'center' },
  statLabel: { fontSize: 11, color: c.mutedForeground, textAlign: 'center', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: c.foreground },
}));

export default LeadGenerationScreen;