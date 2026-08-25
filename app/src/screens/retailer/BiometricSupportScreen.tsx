import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const BiometricSupportScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Biometric Support</Text>
          <Text style={styles.pageSubtitle}>Device management & troubleshooting</Text>
        </View>
        <MaterialCommunityIcons name="fingerprint" size={32} color="#EC4899" />
      </View>

      <Card style={styles.deviceCard}>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.emptyState}>
            <Ionicons name="hardware-chip-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No biometric devices registered</Text>
            <Text style={styles.emptySubtext}>Register your RD service device for AEPS</Text>
            <Button variant="outline" size="sm" style={{ marginTop: 12 }}>Register Device</Button>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.guidesCard}>
        <CardHeader>
          <CardTitle>Setup Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.guidesList}>
            {[
              { title: 'Morpho RD Service Setup', desc: 'Step-by-step guide for Morpho devices' },
              { title: 'Mantra RD Service Setup', desc: 'Configuration for Mantra biometric devices' },
              { title: 'Startek RD Service Setup', desc: 'Setup guide for Startek fingerprint scanners' },
              { title: 'Troubleshooting Common Issues', desc: 'Fix device detection & capture errors' },
            ].map((guide, i) => (
              <TouchableOpacity key={i} style={styles.guideItem} activeOpacity={0.8}>
                <View style={styles.guideIcon}>
                  <Ionicons name="document-text" size={22} color="#6366F1" />
                </View>
                <View style={styles.guideText}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideDesc}>{guide.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.supportCard}>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.supportButtons}>
            <Button variant="outline" size="sm" fullWidth>
              <Ionicons name="chatbubbles" size={18} color={colors.primary} />
              Live Chat
            </Button>
            <Button variant="outline" size="sm" fullWidth>
              <Ionicons name="call" size={18} color={colors.primary} />
              Call Support
            </Button>
            <Button variant="outline" size="sm" fullWidth>
              <Ionicons name="mail" size={18} color={colors.primary} />
              Email Support
            </Button>
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
  deviceCard: {},
  guidesCard: { marginTop: 8 },
  supportCard: { marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', color: c.foreground },
  emptySubtext: { fontSize: 12, color: c.mutedForeground, textAlign: 'center' },
  guidesList: { gap: 12 },
  guideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  guideIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#6366F120', justifyContent: 'center', alignItems: 'center' },
  guideText: { flex: 1 },
  guideTitle: { fontSize: 14, fontWeight: '600', color: c.foreground },
  guideDesc: { fontSize: 12, color: c.mutedForeground, marginTop: 2 },
  supportButtons: { flexDirection: 'row', gap: 8 },
}));

import { TouchableOpacity } from 'react-native';
export default BiometricSupportScreen;