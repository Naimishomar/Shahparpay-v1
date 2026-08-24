import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import api from '@/services/api';
import { DashboardStats, RecentSale } from '@/types';
import { QUICK_ACTIONS } from '@/constants';

export const DashboardScreen: React.FC = () => {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('Today');

  const fetchStats = async (showLoading = true) => {
    if (!token) return;
    try {
      if (showLoading) setLoading(true);
      const res = await api.getRetailerDashboard();
      if (res.success) {
        setStats(res.data.stats);
        setRecentSales(res.data.recentSales);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats(false);
  };

  const topStats = [
    { title: 'Total Success DMT', value: stats?.DMT ? `₹ ${stats.DMT.toFixed(2)}` : '₹ 0.00', icon: 'currency-inr', color: '#3B82F6' },
    { title: 'Total Success Recharge', value: stats?.RECHARGE ? `₹ ${stats.RECHARGE.toFixed(2)}` : '₹ 0.00', icon: 'cellphone', color: '#8B5CF6' },
    { title: 'Total Success AEPS', value: stats?.AEPS_WITHDRAWAL ? `₹ ${stats.AEPS_WITHDRAWAL.toFixed(2)}` : '₹ 0.00', icon: 'fingerprint', color: '#EC4899' },
    { title: 'Total Success Payout', value: stats?.AEPS_SETTLEMENT ? `₹ ${stats.AEPS_SETTLEMENT.toFixed(2)}` : '₹ 0.00', icon: 'bank', color: '#06B6D4' },
  ];

  const bottomStats = [
    { title: 'Total Success BBPS', value: stats?.BILL_PAYMENT ? `₹ ${stats.BILL_PAYMENT.toFixed(2)}` : '₹ 0.00', icon: 'receipt', color: '#F59E0B' },
    { title: 'Total Success UPI', value: stats?.WALLET_TOPUP ? `₹ ${stats.WALLET_TOPUP.toFixed(2)}` : '₹ 0.00', icon: 'wallet', color: '#10B981' },
    { title: 'Total Earnings', value: stats?.TotalCommission ? `₹ ${stats.TotalCommission.toFixed(2)}` : '₹ 0.00', icon: 'currency-inr', color: '#6366F1' },
  ];

  const bottomStats2 = [
    { title: 'Total Customers', value: stats?.TotalCustomers?.toString() || '0', icon: 'account-group', color: '#8B5CF6' },
    { title: 'Total Transactions', value: stats?.TotalTransactionsAmount ? `₹ ${stats.TotalTransactionsAmount.toFixed(2)}` : '₹ 0.00', icon: 'wallet', color: '#06B6D4' },
    { title: 'Total Commission', value: stats?.TotalCommission ? `₹ ${stats.TotalCommission.toFixed(2)}` : '₹ 0.00', icon: 'currency-inr', color: '#F59E0B' },
  ];

  const renderStatCard = (stat: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.statCard}
      activeOpacity={0.9}
    >
      <View style={styles.statCardHeader}>
        <Text style={styles.statTitle}>{stat.title}</Text>
        <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}20` }]}>
          <Ionicons name={stat.icon} size={24} color={stat.color} />
        </View>
      </View>
      <Text style={styles.statValue}>{stat.value}</Text>
    </TouchableOpacity>
  );

  const renderQuickAction = (action: any) => {
    const iconMap: Record<string, string> = {
      fingerprint: 'fingerprint',
      users: 'account-group',
      'credit-card': 'credit-card',
      'file-text': 'file-document',
    };

    const colorMap: Record<string, string> = {
      blue: '#3B82F6',
      teal: '#14B8A6',
      rose: '#F43F5E',
      indigo: '#6366F1',
    };

    const color = colorMap[action.color] || '#3B82F6';

    return (
      <TouchableOpacity
        style={[styles.quickActionCard, { borderColor: `${color}40` }]}
        onPress={() => { /* navigate to action.route */ }}
        activeOpacity={0.8}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
          <MaterialCommunityIcons name={iconMap[action.icon] || 'help'} size={28} color={color} />
        </View>
        <Text style={styles.quickActionTitle}>{action.name}</Text>
        <Text style={styles.quickActionDesc}>Tap to open</Text>
      </TouchableOpacity>
    );
  };

  const renderRecentSale = (sale: RecentSale, index: number) => (
    <View key={index} style={styles.recentSaleItem}>
      <View style={[styles.recentSaleAvatar, { backgroundColor: 'var(--primary)' }]}>
        <Text style={styles.recentSaleAvatarText}>
          {sale.service ? sale.service.charAt(0) : sale.name.charAt(0)}
        </Text>
      </View>
      <View style={styles.recentSaleInfo}>
        <Text style={styles.recentSaleService}>{sale.service || sale.name}</Text>
        <Text style={styles.recentSaleName}>{sale.name}</Text>
        <Text style={styles.recentSaleDetails}>{sale.details || sale.date}</Text>
      </View>
      <View style={styles.recentSaleAmount}>
        <Text style={[
          styles.recentSaleAmountText,
          sale.status === 'SUCCESS' && styles.amountSuccess,
          sale.status === 'FAILED' && styles.amountFailed,
          sale.status === 'PENDING' && styles.amountPending,
        ]}>
          {sale.amount}
        </Text>
        {sale.date && (
          <Text style={styles.recentSaleDate}>
            {new Date(sale.date).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.spinner} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.datePickerButton}>
          <Text style={styles.datePickerText}>{dateRange}</Text>
          <Ionicons name="chevron-down" size={18} color="var(--muted-foreground)" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {topStats.map(renderStatCard)}
      </View>

      <View style={styles.statsGrid}>
        {bottomStats.map(renderStatCard)}
      </View>

      <View style={styles.statsGrid}>
        {bottomStats2.map(renderStatCard)}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <View style={styles.quickActionsGrid}>
        {QUICK_ACTIONS.map(renderQuickAction)}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sales</Text>
      </View>

      <Card style={styles.recentSalesCard}>
        <CardContent>
          {recentSales.length > 0 ? (
            recentSales.map(renderRecentSale)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="var(--muted-foreground)" />
              <Text style={styles.emptyText}>No recent sales found</Text>
            </View>
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'var(--primary)',
    borderTopColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {},
  greeting: {
    fontSize: 14,
    color: 'var(--muted-foreground)',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'var(--foreground)',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--border)',
    backgroundColor: 'var(--background)',
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'var(--foreground)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'var(--card)',
    borderWidth: 1,
    borderColor: 'var(--border)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'var(--muted-foreground)',
    flex: 1,
    marginRight: 8,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'var(--foreground)',
  },
  sectionHeader: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'var(--foreground)',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'var(--card)',
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'var(--foreground)',
    textAlign: 'center',
  },
  quickActionDesc: {
    fontSize: 11,
    color: 'var(--muted-foreground)',
    textAlign: 'center',
  },
  recentSalesCard: {
    marginTop: 8,
  },
  recentSaleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--border)',
  },
  recentSaleAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentSaleAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  recentSaleInfo: {
    flex: 1,
    gap: 2,
  },
  recentSaleService: {
    fontSize: 13,
    fontWeight: '600',
    color: 'var(--foreground)',
  },
  recentSaleName: {
    fontSize: 12,
    fontWeight: '500',
    color: 'var(--foreground)',
  },
  recentSaleDetails: {
    fontSize: 11,
    color: 'var(--muted-foreground)',
  },
  recentSaleAmount: {
    alignItems: 'flex-end',
    gap: 2,
  },
  recentSaleAmountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountSuccess: {
    color: '#10B981',
  },
  amountFailed: {
    color: '#EF4444',
  },
  amountPending: {
    color: '#F59E0B',
  },
  recentSaleDate: {
    fontSize: 10,
    color: 'var(--muted-foreground)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--muted-foreground)',
  },
});

export default DashboardScreen;