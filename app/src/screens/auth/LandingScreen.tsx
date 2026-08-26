import React from 'react';
import { View, Text, ScrollView, Image, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, themed, radius, space, type as t } from '../../theme/colors';

const FEATURES = [
  { icon: 'fingerprint', title: 'AEPS banking', desc: 'Withdrawals, balance and mini statements' },
  { icon: 'bank-transfer', title: 'Money transfer', desc: 'IMPS and NEFT to any bank account' },
  { icon: 'cellphone', title: 'Recharge & bills', desc: 'Mobile, DTH and every BBPS category' },
  { icon: 'cash-fast', title: 'Instant payouts', desc: 'Settle your wallet straight to bank' },
];

export const LandingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { resolvedTheme } = useTheme();
  const { padding } = useResponsive();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: padding + 8,
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + space.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            // Black-on-transparent asset: untinted it disappears on the dark
            // background. One tint keeps a single file correct in both themes.
            tintColor={colors.foreground}
            accessibilityLabel="Shahparpay"
          />
          <Text style={styles.heading} accessibilityRole="header">
            One app for every counter service
          </Text>
          <Text style={styles.description}>
            AEPS, money transfer, recharge, bill payments and payouts — settled to your wallet the
            moment they succeed.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={20}
                  color={colors.accent}
                />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            onPress={() => navigation.navigate('Login')}
            icon="login"
            size="lg"
            fullWidth
          >
            Continue to sign in
          </Button>
          <View style={styles.trust}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.trustText}>NPCI-compliant · Two-factor secured</Text>
          </View>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Shahparpay Solutions Pvt. Ltd.</Text>
      </ScrollView>
    </View>
  );
};

const styles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: space.xxxl },
  hero: { alignItems: 'center', gap: space.sm, maxWidth: 460, alignSelf: 'center' },
  logo: { width: 148, height: 52, marginBottom: space.sm },
  heading: {
    fontSize: t.h1,
    lineHeight: 38,
    fontWeight: '800',
    color: c.foreground,
    textAlign: 'center',
  },
  description: {
    fontSize: t.body,
    color: c.mutedForeground,
    textAlign: 'center',
    lineHeight: 23,
    // ~50 characters per line keeps this readable on a phone.
    maxWidth: 400,
  },
  features: { gap: space.md, width: '100%', maxWidth: 460, alignSelf: 'center' },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, minWidth: 0, gap: 2 },
  featureTitle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  featureDesc: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 17 },
  actions: { gap: space.md, width: '100%', maxWidth: 460, alignSelf: 'center' },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  trustText: { fontSize: t.micro, color: c.mutedForeground },
  footer: { fontSize: t.micro, color: c.mutedForeground, textAlign: 'center' },
}));

export default LandingScreen;
