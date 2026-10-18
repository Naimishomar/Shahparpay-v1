import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';
import { STORAGE_KEYS } from '@/constants';
import { isoDate } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { isRouteEnabled } from '@/constants/services';
import { useTheme } from '@/context/ThemeContext';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { TopGlow } from '@/components/ui/TopGlow';
import { BrandMark } from '@/components/ui/BrandMark';
import { IconTile } from '@/components/ui/Gradient';

interface AppSplashScreenProps {
  onFinish: (targetRoute?: string) => void;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ onFinish }) => {
  // Signed out, or still restoring the session: user is null and every tile shows.
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const insets = useSafeAreaInsets();
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

  // Shortcuts straight into a service once the splash ends — only the ones
  // the app actually offers, each opening its own screen.
  const tiles = [
    { title: 'AEPS', icon: 'fingerprint', route: 'AEPS' },
    { title: 'Micro ATM', icon: 'credit-card-outline', route: 'MATM' },
    { title: 'Money transfer', icon: 'bank-transfer', route: 'DMT' },
    { title: 'Recharge', icon: 'cellphone', route: 'Recharge' },
    { title: 'Bills', icon: 'receipt', route: 'BBPS' },
    { title: 'PAN card', icon: 'card-account-details-outline', route: 'PAN' },
    { title: 'ITR filing', icon: 'file-document-outline', route: 'ITR' },
    { title: 'Loans', icon: 'account-plus-outline', route: 'LeadGeneration' },
  ].filter((tile) => isRouteEnabled(user, tile.route));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <TopGlow height={520} />

      {/* The mark, the name, the promise — BHIM's calm opening. */}
      <View style={styles.brand}>
        <View style={styles.mark}>
          <BrandMark size={44} color={colors.foreground} />
        </View>
        <Text style={styles.name}>Shahparpay</Text>
        <Text style={styles.tagline}>Digital banking & payments for your shop</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Banking point services</Text>
          <MaterialCommunityIcons name="star-four-points" size={11} color={colors.mutedForeground} />
          <View style={styles.rule} />
        </View>
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <Pressable
              key={tile.route + tile.title}
              onPress={() => onFinish(tile.route)}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={tile.title}
            >
              <IconTile icon={tile.icon} size={56} iconSize={26} />
              <Text style={styles.tileLabel} numberOfLines={2}>
                {tile.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.highlight} />
        <Text style={styles.footerText}>Empowering financial inclusion across India</Text>
      </View>
    </View>
  );
};

const styles = themed((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
    paddingHorizontal: space.lg,
    justifyContent: 'space-between',
  },
  brand: { alignItems: 'center', gap: space.sm },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  name: { fontSize: 34, fontWeight: '500', color: c.foreground, letterSpacing: 0.2 },
  tagline: { fontSize: t.body, color: c.mutedForeground },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  tile: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  tileLabel: { fontSize: t.small, color: c.foreground, textAlign: 'center', lineHeight: 17 },
  footer: { alignItems: 'center', gap: space.md },
  footerText: { fontSize: t.small, color: c.mutedForeground },
}));
