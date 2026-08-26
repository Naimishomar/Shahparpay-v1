import React from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Screen, Banner, Row, StatusPill, shortDate } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

/**
 * Fingerprint capture needs a vendor RD service app installed on the device;
 * the store links below are the only actionable part of this screen. Everything
 * else reports the merchant's live biometric readiness from the backend.
 */
const RD_SERVICES = [
  { name: 'Mantra RD Service', pkg: 'com.mantra.rdservice' },
  { name: 'Morpho RD Service', pkg: 'com.scl.rdservice' },
  { name: 'Startek RD Service', pkg: 'com.acpl.registersdk' },
  { name: 'Evolute RD Service', pkg: 'com.evolute.rdservice' },
  { name: 'Precision RD Service', pkg: 'com.precision.pb510.rdservice' },
];

const TIPS = [
  'Device not detected: reconnect the scanner and open the RD service app once.',
  'Capture timeout: clean the sensor and press firmly for the full countdown.',
  'Daily 2FA failing: complete it from the AEPS screen before the first transaction of the day.',
  'Pipe inactive: check Pipe Status — onboarding may still be pending with the bank.',
];

export const BiometricSupportScreen: React.FC = () => {
  const { user } = useAuth();
  const merchantcode = user?.retailerId || user?.code;
  const status = useAsync<any>(
    async () => (await api.getAepsMerchantStatus({ merchantcode })).data,
    [merchantcode]
  );

  const openStore = (pkg: string) => {
    const url =
      Platform.OS === 'android'
        ? `https://play.google.com/store/apps/details?id=${pkg}`
        : 'https://play.google.com/store/search?q=rd%20service';
    Linking.openURL(url).catch(() => {});
  };

  const activePipes: string[] = status.data?.activePipes ?? [];

  return (
    <Screen
      loading={status.loading}
      refreshing={status.refreshing}
      onRefresh={status.refresh}
      error={status.error}
      onRetry={status.reload}
    >
      <Card>
        <CardHeader>
          <CardTitle icon="shield-check-outline">Biometric readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label="Merchant eKYC"
            value={<StatusPill status={status.data?.isMerchantKycComplete ? 'COMPLETED' : 'PENDING'} />}
          />
          <Row
            label="Daily 2FA today"
            value={<StatusPill status={status.data?.isDailyAuthDoneToday ? 'SUCCESS' : 'PENDING'} />}
          />
          <Row label="Last daily auth" value={shortDate(status.data?.lastDailyAuthDate)} />
          <Row label="Active pipes" value={activePipes.length ? activePipes.join(', ') : 'None'} last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="fingerprint">RD service apps</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={styles.help}>
            Install the RD service matching your fingerprint scanner, then register the device once.
            AEPS capture will not start without it.
          </Text>
          {RD_SERVICES.map((rd, i) => (
            <Pressable
              key={rd.pkg}
              style={({ pressed }) => [
                styles.rdItem,
                i === RD_SERVICES.length - 1 && styles.rdItemLast,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => openStore(rd.pkg)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${rd.name} in the Play Store`}
            >
              <View style={styles.rdIcon}>
                <MaterialCommunityIcons name="fingerprint" size={18} color={colors.accent} />
              </View>
              <View style={styles.rdText}>
                <Text style={styles.rdTitle}>{rd.name}</Text>
                <Text style={styles.rdPkg} numberOfLines={1}>
                  {rd.pkg}
                </Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={17} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="lifebuoy">Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tip}>
              <MaterialCommunityIcons name="information" size={15} color={colors.info} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <Banner
        tone="info"
        message="This build cannot drive an RD service directly. Use the web portal on a machine with the device attached for biometric transactions."
      />
    </Screen>
  );
};

const styles = themed((c) => ({
  help: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18, marginBottom: space.md },
  rdItem: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rdItemLast: { borderBottomWidth: 0 },
  rdIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rdText: { flex: 1, minWidth: 0, gap: 2 },
  rdTitle: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  rdPkg: { fontSize: t.micro, color: c.mutedForeground },
  tip: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm },
  tipText: { flex: 1, fontSize: t.caption, color: c.foreground, lineHeight: 18 },
}));

export default BiometricSupportScreen;
