import React, { useState } from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  SectionTitle,
  Row,
  SuccessBanner,
  shortDate,
  SkeletonCard,
  SkeletonRows,
  SkeletonTitle,
} from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from '@/components/aeps/BiometricCapture';
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
  { name: 'SecuGen RD Service', pkg: 'com.secugen.rdservice' },
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
  const { device, setDevice } = useBiometricDevice();
  // Discarded immediately: this is a "does the scanner work" check, not a
  // transaction, so the PID block must never leave the screen.
  const [testPassed, setTestPassed] = useState(false);
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
      skeleton={<View style={{ gap: 16 }}><SkeletonTitle /><SkeletonCard><SkeletonRows count={3} amount={false} /></SkeletonCard><SkeletonTitle /><SkeletonCard><SkeletonRows count={3} amount={false} /></SkeletonCard></View>}
      refreshing={status.refreshing}
      onRefresh={status.refresh}
      error={status.error}
      onRetry={status.reload}
    >
      <SectionTitle>Biometric readiness</SectionTitle>
      <Card>
        <CardContent>
          <Row
            label="Merchant eKYC"
            value={<StatusText status={status.data?.isMerchantKycComplete ? 'COMPLETED' : 'PENDING'} />}
          />
          <Row
            label="Daily 2FA today"
            value={<StatusText status={status.data?.isDailyAuthDoneToday ? 'SUCCESS' : 'PENDING'} />}
          />
          <Row label="Last daily auth" value={shortDate(status.data?.lastDailyAuthDate)} />
          <Row label="Active pipes" value={activePipes.length ? activePipes.join(', ') : 'None'} last />
        </CardContent>
      </Card>

      <SectionTitle>RD service apps</SectionTitle>
      <Card>
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
              <IconTile icon="fingerprint" size={44} iconSize={20} />
              <View style={styles.rdText}>
                <Text style={styles.rdTitle}>{rd.name}</Text>
                <Text style={styles.rdPkg} numberOfLines={1}>
                  {rd.pkg}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </CardContent>
      </Card>

      <SectionTitle>Test your scanner</SectionTitle>
      <Card>
        <CardContent style={styles.test}>
          <Text style={styles.help}>
            Runs one real capture through the RD service and throws the result away. Use it to
            confirm the scanner works before a customer is standing at the counter.
          </Text>
          {testPassed && (
            <SuccessBanner message="Scanner is working. The RD service returned a valid signed capture." />
          )}
          <BiometricCapture
            device={device}
            onDeviceChange={setDevice}
            pidData={null}
            onCaptured={(pid) => setTestPassed(!!pid)}
            label="Run a test capture"
            confirmMessage="Place any finger on the scanner. Nothing is sent anywhere — the capture is discarded."
          />
        </CardContent>
      </Card>

      <SectionTitle>Troubleshooting</SectionTitle>
      <Card>
        <CardContent>
          {TIPS.map((tip, i) => (
            <View key={i} style={[styles.tip, i === TIPS.length - 1 && styles.tipLast]}>
              <Ionicons name="bulb-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

    </Screen>
  );
};

/** BHIM status: small coloured text, never a filled pill. */
const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || 'PENDING').toUpperCase();
  const color = /SUCCESS|COMPLETE|APPROVED|ACTIVE|ACCEPTED|CONVERTED/.test(s)
    ? colors.success
    : /FAIL|REJECT/.test(s)
      ? colors.destructive
      : colors.warning;
  return (
    <Text style={{ fontSize: t.small, fontWeight: '500', color }}>
      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
    </Text>
  );
};

const styles = themed((c) => ({
  test: { gap: space.lg },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19, marginBottom: space.sm },
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
  rdText: { flex: 1, minWidth: 0, gap: 2 },
  rdTitle: { fontSize: t.body + 1, fontWeight: '400', color: c.foreground },
  rdPkg: { fontSize: t.small, color: c.mutedForeground },
  tip: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tipLast: { borderBottomWidth: 0 },
  tipText: { flex: 1, fontSize: t.small, color: c.foreground, lineHeight: 19 },
}));

export default BiometricSupportScreen;
