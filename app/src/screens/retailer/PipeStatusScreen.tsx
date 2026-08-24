import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const pipes = [
  { name: 'Bank 3 (Fino)', status: 'Active', statusColor: '#10B981', desc: 'Recommended for new merchants', icon: 'bank' },
  { name: 'Bank 2 (Yes/NSDL)', status: 'Available', statusColor: '#3B82F6', desc: 'Alternative AEPS provider', icon: 'bank' },
];

export const PipeStatusScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>AEPS Pipe Status</Text>
          <Text style={styles.pageSubtitle}>Monitor bank pipe connectivity</Text>
        </View>
        <Ionicons name="pipe" size={32} color="#06B6D4" />
      </View>

      <View style={styles.pipesGrid}>
        {pipes.map((pipe, index) => (
          <Card key={index} style={styles.pipeCard}>
            <CardContent>
              <View style={styles.pipeHeader}>
                <View style={[styles.pipeIcon, { backgroundColor: `${pipe.statusColor}20` }]}>
                  <MaterialCommunityIcons name={pipe.icon} size={24} color={pipe.statusColor} />
                </View>
                <View style={styles.pipeInfo}>
                  <Text style={styles.pipeName}>{pipe.name}</Text>
                  <Text style={styles.pipeDesc}>{pipe.desc}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${pipe.statusColor}20` }]}>
                  <View style={[styles.statusDot, { backgroundColor: pipe.statusColor }]} />
                  <Text style={[styles.statusText, { color: pipe.statusColor }]}>{pipe.status}</Text>
                </View>
              </View>
              <View style={styles.pipeMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Uptime</Text>
                  <Text style={styles.metricValue}>99.9%</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Latency</Text>
                  <Text style={styles.metricValue}>45ms</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Success Rate</Text>
                  <Text style={styles.metricValue}>98.5%</Text>
                </View>
              </View>
              <Button variant="outline" size="sm" className="mt-3" fullWidth>View Details</Button>
            </CardContent>
          </Card>
        ))}
      </View>

      <Card style={styles.incidentCard}>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.emptyText}>No active incidents</Text>
            <Text style={styles.emptySubtext}>All pipes operating normally</Text>
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
  pipesGrid: { gap: 12 },
  pipeCard: {},
  pipeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pipeIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pipeInfo: { flex: 1 },
  pipeName: { fontSize: 16, fontWeight: '600', color: 'var(--foreground)' },
  pipeDesc: { fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  pipeMetrics: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'var(--border)' },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: 'var(--muted-foreground)' },
  metricValue: { fontSize: 14, fontWeight: '700', color: 'var(--foreground)', marginTop: 2 },
  incidentCard: { marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500', color: 'var(--foreground)' },
  emptySubtext: { fontSize: 12, color: 'var(--muted-foreground)' },
});

export default PipeStatusScreen;