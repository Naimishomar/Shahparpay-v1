import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

export const LandingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { resolvedTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'var(--background)' }]}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />

      <View style={styles.backgroundElements}>
        <View style={styles.bgElement1} />
        <View style={styles.bgElement2} />
      </View>

      <View style={styles.content}>
        <View style={styles.leftPanel}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandContent}>
            <Text style={styles.heading}>
              Next-Gen <Text style={styles.headingMuted}>Financial Network.</Text>
            </Text>
            <Text style={styles.description}>
              The ultimate unified platform for AePS, DMT, and Recharge services.
              Secure, fast, and reliable.
            </Text>

            <View style={styles.features}>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name="shield-check" size={20} color="var(--primary)" />
                </View>
                <Text style={styles.featureText}>256-bit Encryption</Text>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Ionicons name="flash" size={20} color="var(--primary)" />
                </View>
                <Text style={styles.featureText}>Instant Settlement</Text>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name="server-network" size={20} color="var(--primary)" />
                </View>
                <Text style={styles.featureText}>99.9% Uptime</Text>
              </View>
            </View>
          </View>

          <View style={styles.copyright}>
            <Text style={styles.copyrightText}>
              © {new Date().getFullYear()} Shahparpay Networks. All rights reserved.
            </Text>
          </View>
        </View>

        <View style={styles.rightPanel}>
          <View style={styles.loginCard}>
            <View style={styles.loginHeader}>
              <Text style={styles.loginTitle}>Sign In</Text>
              <Text style={styles.loginSubtitle}>Access your dashboard</Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login' as any)}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Continue to Login</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.demoButton}>
              <Text style={styles.demoButtonText}>Explore Demo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgElement1: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '60%',
    height: '60%',
    borderRadius: 9999,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  bgElement2: {
    position: 'absolute',
    bottom: '-20%',
    right: '-10%',
    width: '70%',
    height: '70%',
    borderRadius: 9999,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  leftPanel: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'flex-start',
  },
  logo: {
    width: 140,
    height: 50,
  },
  brandContent: {
    maxWidth: 400,
  },
  heading: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 50,
    color: 'var(--foreground)',
    marginBottom: 16,
  },
  headingMuted: {
    color: 'var(--muted-foreground)',
  },
  description: {
    fontSize: 18,
    lineHeight: 28,
    color: 'var(--muted-foreground)',
    marginBottom: 32,
    maxWidth: 400,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: 'var(--secondary)',
    borderWidth: 1,
    borderColor: 'var(--border)',
  },
  featureIcon: {
    padding: 4,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'var(--foreground)',
  },
  copyright: {
    paddingTop: 24,
  },
  copyrightText: {
    fontSize: 12,
    color: 'var(--muted-foreground)',
  },
  rightPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderRadius: 24,
    backgroundColor: 'var(--card)',
    borderWidth: 1,
    borderColor: 'var(--border)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'var(--foreground)',
    marginBottom: 4,
  },
  loginSubtitle: {
    fontSize: 14,
    color: 'var(--muted-foreground)',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'var(--primary)',
    marginBottom: 20,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'var(--primary-foreground)',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'var(--border)',
  },
  dividerText: {
    fontSize: 13,
    color: 'var(--muted-foreground)',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--border)',
    backgroundColor: 'transparent',
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'var(--foreground)',
  },
});

export default LandingScreen;