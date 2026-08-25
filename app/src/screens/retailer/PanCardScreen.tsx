import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { themed } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const PanCardScreen: React.FC = () => {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>PAN Card Services</Text>
          <Text style={styles.pageSubtitle}>Apply for new PAN or corrections</Text>
        </View>
        <Ionicons name="card" size={32} color="#F43F5E" />
      </View>

      <Card style={styles.tabCard}>
        <CardContent>
          <View style={styles.tabs}>
            <Button variant="default" size="sm">NSDL PAN</Button>
            <Button variant="outline" size="sm">e-PAN</Button>
            <Button variant="outline" size="sm">Correction</Button>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.formCard}>
        <CardHeader>
          <CardTitle>New PAN Application (NSDL)</CardTitle>
        </CardHeader>
        <CardContent>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <Text style={styles.fieldValue}>Enter as per Aadhaar</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Father's Name *</Text>
              <Text style={styles.fieldValue}>Enter father's full name</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Date of Birth *</Text>
              <Text style={styles.fieldValue}>DD/MM/YYYY</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Mobile Number *</Text>
              <Text style={styles.fieldValue}>For OTP verification</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <Text style={styles.fieldValue}>Optional</Text>
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Address *</Text>
              <Text style={styles.fieldValue}>Residential address</Text>
            </View>
          </View>
          <View style={styles.documents}>
            <Text style={styles.docTitle}>Required Documents</Text>
            <View style={styles.docList}>
              {['Aadhaar Card', 'Address Proof', 'Date of Birth Proof', 'Photo'].map((doc, i) => (
                <View key={i} style={styles.docItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.docText}>{doc}</Text>
                </View>
              ))}
            </View>
          </View>
          <Button style={{ marginTop: 16 }} size="lg">Submit Application</Button>
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
  tabCard: { marginBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8 },
  formCard: {},
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  formField: { width: '48%', gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: c.mutedForeground },
  fieldValue: { fontSize: 14, color: c.foreground },
  documents: { paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border },
  docTitle: { fontSize: 13, fontWeight: '600', color: c.foreground, marginBottom: 12 },
  docList: { gap: 8 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docText: { fontSize: 13, color: c.foreground },
}));

export default PanCardScreen;