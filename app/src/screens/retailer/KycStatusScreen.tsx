import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const kycSteps = [
  { id: 'web', name: 'Web KYC (Step 1)', desc: 'Complete PaySprint onboarding', icon: 'globe', status: 'pending' },
  { id: 'biometric', name: 'Biometric Activation (Step 2)', desc: 'Register fingerprint device', icon: 'fingerprint', status: 'pending' },
];

export const KycStatusScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>KYC Status</Text>
          <Text style={styles.pageSubtitle}>Track your verification progress</Text>
        </View>
        <Ionicons name="shield-checkmark" size={32} color="#10B981" />
      </View>

      <Card style={styles.statusCard}>
        <CardContent>
          <View style={styles.overallStatus}>
            <View style={styles.statusCircle}>
              <Ionicons name="time" size={32} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.statusTitle}>KYC In Progress</Text>
              <Text style={styles.statusDesc}>Complete both steps to activate all services</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.stepsCard}>
        <CardHeader>
          <CardTitle>Verification Steps</CardTitle>
        </CardHeader>
        <CardContent>
          {kycSteps.map((step, index) => (
            <View key={step.id} style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepIcon}>
                  <MaterialCommunityIcons name={step.icon} size={24} color="var(--primary)" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{step.name}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
              <View style={styles.stepAction}>
                <Button variant={step.status === 'completed' ? 'default' : 'outline'} size="sm">
                  {step.status === 'completed' ? 'Completed' : 'Start'}
                </Button>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card style={styles.infoCard}>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.notesList}>
            {[
              'Web KYC must be completed first before biometric activation',
              'Bank 3 (Fino) requires Web KYC; Bank 2 (Yes/NSDL) skips to biometric',
              'Biometric device must be RD Service registered',
              'KYC validity: 1 year from completion date',
              'Contact support if you face issues during verification',
            ].map((note, i) => (
              <View key={i} style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.noteText}>{note}</Text>
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
  statusCard: {},
  overallStatus: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F59E0B20', justifyContent: 'center', alignItems: 'center' },
  statusTitle: { fontSize: 18, fontWeight: '700', color: 'var(--foreground)' },
  statusDesc: { fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 },
  stepsCard: { marginTop: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'var(--primary)', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { fontSize: 14, fontWeight: '700', color: 'white' },
  stepContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  stepIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--primary)', justifyContent: 'center', alignItems: 'center' },
  stepInfo: { flex: 1 },
  stepName: { fontSize: 14, fontWeight: '600', color: 'var(--foreground)' },
  stepDesc: { fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 },
  stepAction: {},
  infoCard: { marginTop: 8 },
  notesList: { gap: 10 },
  noteItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { fontSize: 13, color: 'var(--foreground)', flex: 1, lineHeight: 20 },
});

export default KycStatusScreen;