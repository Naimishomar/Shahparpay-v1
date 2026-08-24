import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const distributorTabs = [
  { name: 'Overview', icon: 'home', count: null },
  { name: 'Retailers', icon: 'account-group', count: 25 },
  { name: 'Fund Requests', icon: 'cash', count: 3 },
  { name: 'Create Retailer', icon: 'account-plus', count: null },
  { name: 'Profile', icon: 'person', count: null },
];

export const DistributorPortalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Distributor Portal</Text>
          <Text style={styles.pageSubtitle}>Manage your retailer network</Text>
        </View>
        <Ionicons name="store" size={32} color="#14B8A6" />
      </View>

      <View style={styles.tabs}>
        {distributorTabs.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.tab,
              activeTab === index && styles.tabActive,
            ]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[
              styles.tabText,
              activeTab === index && styles.tabTextActive,
            ]}>
              {tab.name}
              {tab.count !== null && (
                <Text style={[
                  styles.tabBadge,
                  activeTab === index && styles.tabBadgeActive,
                ]}>
                  {tab.count}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 && <OverviewTab />}
      {activeTab === 1 && <RetailersTab />}
      {activeTab === 2 && <FundRequestsTab />}
      {activeTab === 3 && <CreateRetailerTab />}
      {activeTab === 4 && <ProfileTab />}
    </ScrollView>
  );
};

const OverviewTab = () => (
  <View style={styles.tabContent}>
    <View style={styles.statsGrid}>
      {[
        { label: 'Total Retailers', value: '25', color: '#3B82F6' },
        { label: 'Active Retailers', value: '18', color: '#10B981' },
        { label: 'Pending Fund Requests', value: '3', color: '#F59E0B' },
        { label: 'Total Commission', value: '₹ 45,000', color: '#8B5CF6' },
      ].map((stat, i) => (
        <Card key={i} style={styles.statCard}>
          <CardContent>
            <Text style={[styles.statLabel, { color: stat.color }]}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </CardContent>
        </Card>
      ))}
    </View>

    <Card style={styles.recentCard}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="information-circle" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>No recent activity</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const RetailersTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="account-group" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>25 Retailers</Text>
          <Text style={styles.emptySubtext}>Manage your retailer network</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const FundRequestsTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="cash" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>3 Pending Requests</Text>
          <Text style={styles.emptySubtext}>Review and approve</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const CreateRetailerTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardHeader>
        <CardTitle>Create New Retailer</CardTitle>
      </CardHeader>
      <CardContent>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <Text style={styles.fieldValue}>Enter full name</Text>
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Email *</Text>
          <Text style={styles.fieldValue}>Enter email address</Text>
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Mobile *</Text>
          <Text style={styles.fieldValue}>Enter mobile number</Text>
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Password *</Text>
          <Text style={styles.fieldValue}>Enter password</Text>
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Location *</Text>
          <Text style={styles.fieldValue}>Select city/state</Text>
        </View>
        <Button className="mt-4" size="lg">Create Retailer</Button>
      </CardContent>
    </Card>
  </View>
);

const ProfileTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="person" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>Profile Settings</Text>
          <Text style={styles.emptySubtext}>Manage your account</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: 'var(--background)' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: 'var(--foreground)' },
  pageSubtitle: { fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'var(--border)', backgroundColor: 'var(--background)' },
  tabActive: { backgroundColor: '#14B8A6', borderColor: '#14B8A6' },
  tabText: { fontSize: 13, fontWeight: '500', color: 'var(--foreground)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabTextActive: { color: 'white' },
  tabBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: 'var(--secondary)', color: 'var(--foreground)' },
  tabBadgeActive: { backgroundColor: 'white', color: '#14B8A6' },
  tabContent: { gap: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', borderRadius: 16 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', color: 'var(--foreground)', marginTop: 4 },
  recentCard: { marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '500', color: 'var(--foreground)' },
  emptySubtext: { fontSize: 12, color: 'var(--muted-foreground)' },
  formField: { marginBottom: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: 'var(--muted-foreground)' },
  selectWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: 'var(--border)', backgroundColor: 'var(--background)' },
  selectValue: { fontSize: 14, color: 'var(--foreground)' },
  fieldValue: { fontSize: 14, color: 'var(--foreground)' },
});

import { TouchableOpacity } from 'react-native';
export default DistributorPortalScreen;