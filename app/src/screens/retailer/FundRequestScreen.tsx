import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const FundRequestScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Fund Request</Text>
          <Text style={styles.pageSubtitle}>Request funds from distributor</Text>
        </View>
        <Ionicons name="cash" size={32} color="#F59E0B" />
      </View>

      <Card style={styles.requestCard}>
        <CardHeader>
          <CardTitle>New Fund Request</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Amount Required *</Text>
            <Text style={styles.fieldValue}>Enter amount</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Purpose *</Text>
            <Text style={styles.fieldValue}>Select purpose</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Remarks</Text>
            <Text style={styles.fieldValue}>Additional details</Text>
          </View>
          <Button className="mt-4" size="lg">Submit Request</Button>
        </CardContent>
      </Card>

      <Card style={styles.historyCard}>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color="var(--muted-foreground)" />
            <Text style={styles.emptyText}>No fund requests yet</Text>
            <Text style={styles.emptySubtext}>Your requests will appear here</Text>
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
  requestCard: {},
  historyCard: { marginTop: 8 },
  formField: { marginBottom: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: 'var(--muted-foreground)' },
  fieldValue: { fontSize: 14, color: 'var(--foreground)' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', color: 'var(--foreground)' },
  emptySubtext: { fontSize: 12, color: 'var(--muted-foreground)' },
});

export default FundRequestScreen;