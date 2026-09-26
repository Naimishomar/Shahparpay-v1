import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { STORAGE_KEYS } from '@/constants';
import { isoDate } from '@/components/ui/Screen';

const { width } = Dimensions.get('window');

interface AppSplashScreenProps {
  onFinish: (targetRoute?: string) => void;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    // Preload backend data during the 3-second splash window so screens don't show skeleton loaders
    const preloadBackendData = async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.token);
        if (!token) return;

        const now = new Date();
        const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const today = isoDate(now);

        const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        windowStart.setDate(windowStart.getDate() - 6);

        await Promise.allSettled([
          api.getWalletBalance(),
          api.getRetailerDashboard({ startDate: monthStart, endDate: today }),
          api.getWalletLedger({ startDate: isoDate(windowStart), endDate: today, limit: 50 }),
          api.getCommissionByDay(7),
          api.getTickerUpdates(),
          api.getNotifications(),
        ]);
      } catch {
        // Ignore prefetch failures
      }
    };

    preloadBackendData();

    // Automatically navigate to the app after 3 seconds
    const timeout = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onFinish]);

  const serviceTiles = [
    {
      id: 'loan',
      title: 'Loan Apply',
      route: 'LeadGeneration',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#1e1b4b' }]}>
          <Text style={styles.rupeeText}>₹</Text>
        </View>
      ),
    },
    {
      id: 'irctc',
      title: 'IRCTC',
      route: 'Services',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#1e1b4b' }]}>
          <Text style={styles.irctcText}>IRCTC</Text>
          <MaterialCommunityIcons name="train" size={15} color="#1e1b4b" />
        </View>
      ),
    },
    {
      id: 'dl',
      title: 'Driving Licence',
      route: 'Services',
      icon: (
        <View style={styles.dlBadge}>
          <Text style={styles.dlText}>DL</Text>
          <View style={styles.dlLineRow}>
            <View style={styles.dlDot} />
            <View style={styles.dlLines}>
              <View style={[styles.dlLine, { width: '100%' }]} />
              <View style={[styles.dlLine, { width: '70%' }]} />
            </View>
          </View>
        </View>
      ),
    },
    {
      id: 'gst',
      title: 'GST Registration',
      route: 'Services',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#e2e8f0' }]}>
          <Text style={styles.gstTitle}>GST</Text>
          <View style={styles.gstTag}>
            <Text style={styles.gstTagText}>REGISTRATION</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'cash_deposit',
      title: 'Cash Deposit',
      route: 'AddMoney',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#fef3c7' }]}>
          <MaterialCommunityIcons name="bank" size={20} color="#1e1b4b" />
          <View style={styles.depositArrow}>
            <Text style={styles.depositArrowText}>↓</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'mini_atm',
      title: 'Mini ATM',
      route: 'MATM',
      icon: (
        <View style={styles.atmMachine}>
          <View style={styles.atmScreen} />
          <View style={styles.atmKeys}>
            <View style={styles.keyDot} />
            <View style={styles.keyDot} />
          </View>
        </View>
      ),
    },
    {
      id: 'account_opening',
      title: 'Digital Account Opening',
      route: 'Services',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#0891b2' }]}>
          <MaterialCommunityIcons name="bank-outline" size={20} color="#ffffff" />
        </View>
      ),
    },
    {
      id: 'aadhar_pay',
      title: 'Aadhar Pay',
      route: 'AEPS',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#ffedd5' }]}>
          <Text style={styles.aadharHeader}>AADHAAR</Text>
          <Text style={styles.aadharSub}>PAY</Text>
        </View>
      ),
    },
    {
      id: 'bbps',
      title: 'BBPS',
      route: 'BBPS',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#e2e8f0' }]}>
          <View style={styles.bbpsRow}>
            <Text style={styles.bbpsB}>B</Text>
            <Text style={styles.bbpsText}>BHARAT{'\n'}BILLPAY</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'aeps',
      title: 'AePS',
      route: 'AEPS',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#e2e8f0' }]}>
          <View style={styles.aepsRow}>
            <Text style={styles.aepsA}>A</Text>
            <MaterialCommunityIcons name="fingerprint" size={15} color="#059669" />
            <Text style={styles.aepsPS}>PS</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'pan_card',
      title: 'Pan Card',
      route: 'PAN',
      icon: (
        <View style={styles.panBadge}>
          <View style={styles.panFlag} />
          <View style={styles.panRow}>
            <View style={styles.panPhoto} />
            <Text style={styles.panText}>INCOME TAX</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'udyog_aadhar',
      title: 'Udyog Aadhar',
      route: 'Services',
      icon: (
        <View style={[styles.badgeBase, styles.borderBadge, { borderColor: '#fef3c7' }]}>
          <MaterialCommunityIcons name="fingerprint" size={16} color="#d97706" />
          <Text style={styles.udyogText}>UDYOG AADHAR</Text>
        </View>
      ),
    },
    {
      id: 'dmt',
      title: 'Money Transfer',
      route: 'DMT',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#4f46e5' }]}>
          <MaterialCommunityIcons name="bank-transfer" size={20} color="#ffffff" />
        </View>
      ),
    },
    {
      id: 'upi_qr',
      title: 'UPI QR',
      route: 'UPIPayments',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#059669' }]}>
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="#ffffff" />
        </View>
      ),
    },
    {
      id: 'recharge',
      title: 'Recharge',
      route: 'Recharge',
      icon: (
        <View style={[styles.badgeBase, { backgroundColor: '#d97706' }]}>
          <MaterialCommunityIcons name="cellphone" size={20} color="#ffffff" />
        </View>
      ),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.container}>
        {/* Top White Section with Scaled Logo & Tagline */}
        <View style={styles.topWhiteSection}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.taglineText}>Digital Banking & Payment Solutions</Text>
        </View>

        {/* Wave Transition Header */}
        <View style={styles.waveWrapper}>
          <Svg
            width={width}
            height={40}
            viewBox="0 0 1440 200"
            preserveAspectRatio="none"
            style={styles.svgElement}
          >
            <Path
              d="M0,32L60,42.7C120,53,240,75,360,90.7C480,107,600,117,720,112C840,107,960,85,1080,74.7C1200,64,1320,64,1380,64L1440,64L1440,200L1380,200C1320,200,1200,200,1080,200C960,200,480,200,360,200C240,200,120,200,60,200L0,200Z"
              fill="#000000"
            />
          </Svg>
        </View>

        {/* Bottom Black Container with 3 Items Per Row (15 Badges total filling height) */}
        <View style={styles.bottomBlackSection}>
          <View style={styles.gridContainer}>
            {serviceTiles.map((tile) => (
              <TouchableOpacity
                key={tile.id}
                activeOpacity={0.8}
                onPress={() => onFinish(tile.route)}
                style={styles.tileItem}
              >
                {/* Circular White Container */}
                <View style={styles.circleContainer}>{tile.icon}</View>

                {/* White Service Name Text */}
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {tile.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Empowering Financial Inclusion Across India</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topWhiteSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
  },
  logoImage: {
    height: 48,
    width: '60%',
    maxWidth: 210,
  },
  taglineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    letterSpacing: 0.4,
    marginTop: 4,
    textAlign: 'center',
  },
  waveWrapper: {
    width: '100%',
    backgroundColor: '#ffffff',
    marginTop: -1,
  },
  svgElement: {
    marginBottom: -10,
  },
  bottomBlackSection: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: 'space-between',
    paddingTop: 0,
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignContent: 'space-around',
    paddingTop: 4,
    paddingBottom: 4,
  },
  tileItem: {
    width: (width - 32) / 3,
    alignItems: 'center',
  },
  circleContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  badgeBase: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderBadge: {
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  rupeeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  irctcText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#1e1b4b',
    lineHeight: 8.5,
  },
  dlBadge: {
    width: 38,
    height: 26,
    backgroundColor: '#0891b2',
    borderRadius: 4,
    padding: 2.5,
    justifyContent: 'space-between',
  },
  dlText: {
    fontSize: 6,
    fontWeight: '900',
    color: '#ffffff',
    backgroundColor: '#155e75',
    paddingHorizontal: 2.5,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  dlLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  dlDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ffffff',
  },
  dlLines: {
    flex: 1,
    gap: 1.5,
  },
  dlLine: {
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 1,
  },
  gstTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1e3a8a',
  },
  gstTag: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 2.5,
    paddingVertical: 0.5,
    borderRadius: 1,
    marginTop: 0.5,
  },
  gstTagText: {
    fontSize: 5,
    fontWeight: '900',
    color: '#ffffff',
  },
  depositArrow: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositArrowText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  atmMachine: {
    width: 24,
    height: 34,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    padding: 2.5,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  atmScreen: {
    width: '100%',
    height: 9,
    backgroundColor: '#22d3ee',
    borderRadius: 1.5,
  },
  atmKeys: {
    flexDirection: 'row',
    gap: 2,
  },
  keyDot: {
    width: 4,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 1,
  },
  aadharHeader: {
    fontSize: 6,
    fontWeight: '900',
    color: '#dc2626',
  },
  aadharSub: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f97316',
  },
  bbpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  bbpsB: {
    fontSize: 12,
    fontWeight: '900',
    color: '#f97316',
  },
  bbpsText: {
    fontSize: 6,
    fontWeight: '800',
    color: '#1e3a8a',
    lineHeight: 7,
  },
  aepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  aepsA: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
  },
  aepsPS: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0e7490',
  },
  panBadge: {
    width: 36,
    height: 24,
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    borderColor: '#7dd3fc',
    borderWidth: 1,
    padding: 2,
    justifyContent: 'space-between',
  },
  panFlag: {
    height: 2.5,
    backgroundColor: '#f97316',
    borderRadius: 1,
  },
  panRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panPhoto: {
    width: 7.5,
    height: 7.5,
    backgroundColor: '#94a3b8',
    borderRadius: 1.5,
  },
  panText: {
    fontSize: 5,
    fontWeight: '900',
    color: '#1e293b',
  },
  udyogText: {
    fontSize: 5,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 0.5,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 13,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#a1a1aa',
    textAlign: 'center',
  },
});

export default AppSplashScreen;
