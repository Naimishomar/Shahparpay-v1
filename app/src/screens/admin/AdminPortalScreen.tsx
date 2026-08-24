import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const adminTabs = [
  { name: 'Overview', icon: 'home', count: null },
  { name: 'Distributors', icon: 'account-group', count: 12 },
  { name: 'Fund Requests', icon: 'cash', count: 5 },
  { name: 'Commissions', icon: 'currency-inr', count: null },
  { name: 'Create User', icon: 'account-plus', count: null },
];

export const AdminPortalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Admin Portal</Text>
          <Text style={styles.pageSubtitle}>Manage distributors & platform</Text>
        </View>
        <Ionicons name="shield" size={32} color="#6366F1" />
      </View>

      <View style={styles.tabs}>
        {adminTabs.map((tab, index) => (
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
      {activeTab === 1 && <DistributorsTab />}
      {activeTab === 2 && <FundRequestsTab />}
      {activeTab === 3 && <CommissionsTab />}
      {activeTab === 4 && <CreateUserTab />}
    </ScrollView>
  );
};

const OverviewTab = () => (
  <View style={styles.tabContent}>
    <View style={styles.statsGrid}>
      {[
        { label: 'Total Distributors', value: '12', color: '#3B82F6' },
        { label: 'Total Retailers', value: '156', color: '#8B5CF6' },
        { label: 'Pending Fund Requests', value: '5', color: '#F59E0B' },
        { label: 'Total Commission', value: '₹ 2.45L', color: '#10B981' },
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

const DistributorsTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="account-group" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>12 Distributors</Text>
          <Text style={styles.emptySubtext}>Tap to view details</Text>
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
          <Text style={styles.emptyText}>5 Pending Requests</Text>
          <Text style={styles.emptySubtext}>Review and approve</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const CommissionsTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardContent>
        <View style={styles.emptyState}>
          <Ionicons name="calculator" size={48} color="var(--muted-foreground)" />
          <Text style={styles.emptyText}>Commission Reports</Text>
          <Text style={styles.emptySubtext}>View detailed breakdown</Text>
        </View>
      </CardContent>
    </Card>
  </View>
);

const CreateUserTab = () => (
  <View style={styles.tabContent}>
    <Card>
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
      </CardHeader>
      <CardContent>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Role *</Text>
          <View style={styles.selectWrapper}>
            <Text style={styles.selectValue}>Select Role</Text>
            <Ionicons name="chevron-down" size={20} color="var(--muted-foreground)" />
          </View>
        </View>
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
        <Button className="mt-4" size="lg">Create User</Button>
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
  tabActive: { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' },
  tabText: { fontSize: 13, fontWeight: '500', color: 'var(--foreground)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabTextActive: { color: 'white' },
  tabBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: 'var(--secondary)', color: 'var(--foreground)' },
  tabBadgeActive: { backgroundColor: 'white', color: 'var(--primary)' },
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
export default AdminPortalScreen;