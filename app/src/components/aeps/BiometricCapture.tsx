import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useModalInsets } from '@/hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Screen';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { TopGlow } from '@/components/ui/TopGlow';
import {
  captureBiometric,
  DEVICE_BRANDS,
  DEVICE_LABELS,
  RdServiceMissingError,
  isCaptureSupported,
  type CaptureOptions,
  type DeviceBrand,
} from '@/services/rdService';

const DEVICE_KEY = 'biometricDevice';

/**
 * The retailer owns one scanner and uses it every day, so the brand is asked
 * once and remembered. Reading it lazily keeps the first paint synchronous.
 */
export const useBiometricDevice = () => {
  const [device, setDeviceState] = useState<DeviceBrand>('mantra');

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_KEY).then((stored) => {
      if (stored && DEVICE_BRANDS.includes(stored as DeviceBrand)) {
        setDeviceState(stored as DeviceBrand);
      }
    });
  }, []);

  const setDevice = useCallback((next: DeviceBrand) => {
    setDeviceState(next);
    AsyncStorage.setItem(DEVICE_KEY, next);
  }, []);

  return { device, setDevice };
};

export const DevicePicker: React.FC<{
  value: DeviceBrand;
  onChange: (device: DeviceBrand) => void;
}> = ({ value, onChange }) => (
  <View style={styles.devices}>
    <Text style={styles.label}>Scanner brand</Text>
    <View style={styles.deviceGrid}>
      {DEVICE_BRANDS.map((brand) => {
        const active = brand === value;
        return (
          <Pressable
            key={brand}
            onPress={() => onChange(brand)}
            style={({ pressed }) => [
              styles.deviceChip,
              active && styles.deviceChipActive,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={DEVICE_LABELS[brand]}
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={active ? colors.highlight : colors.mutedForeground}
            />
            <Text style={[styles.deviceText, active && styles.deviceTextActive]} numberOfLines={1}>
              {DEVICE_LABELS[brand]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

interface BiometricCaptureProps {
  device: DeviceBrand;
  onDeviceChange: (device: DeviceBrand) => void;
  /** Signed PID block, or null before the first successful capture. */
  pidData: string | null;
  onCaptured: (pidData: string | null) => void;
  /** Extra capture options: per-pipe `wadh`, transaction `otp`. */
  options?: Omit<CaptureOptions, 'device'>;
  /** Blocks capture and explains why (missing form fields, pending eKYC…). */
  blockedReason?: string | null;
  /** Warning shown before the scan starts. AEPS scans the customer's finger. */
  confirmMessage?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Device picker + capture button + capture state, shared by every flow that
 * needs a PID block. Capture is confirmed first because the finger on the
 * scanner is often the customer's, not the retailer's, and a mis-timed scan
 * burns a real bank-side transaction.
 */
export const BiometricCapture: React.FC<BiometricCaptureProps> = ({
  device,
  onDeviceChange,
  pidData,
  onCaptured,
  options,
  blockedReason,
  confirmMessage,
  label = 'Capture fingerprint',
  disabled,
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const runCapture = async () => {
    setConfirming(false);
    setScanning(true);
    setError(null);
    setMissing(false);
    try {
      const { pidData: captured } = await captureBiometric({ ...options, device });
      onCaptured(captured);
    } catch (err: any) {
      onCaptured(null);
      setMissing(err instanceof RdServiceMissingError);
      setError(err?.message || 'Fingerprint capture failed.');
    } finally {
      setScanning(false);
    }
  };

  const start = () => (confirmMessage ? setConfirming(true) : runCapture());

  if (!isCaptureSupported) {
    return (
      <Banner
        tone="warning"
        message={
          Platform.OS === 'ios'
            ? 'UIDAI certifies no fingerprint RD Service for iOS. Use the Android app or the web portal with a connected scanner.'
            : 'Fingerprint capture is not available on this platform.'
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <DevicePicker value={device} onChange={onDeviceChange} />

      {!!blockedReason && <Banner tone="warning" message={blockedReason} />}

      {/* The scanner prompt: a big round target that turns green once a PID
          block is in hand. RD Services report no live quality score; the one
          signed into the PID block is shown only after capture. */}
      <View style={styles.hero} accessibilityLiveRegion="polite">
        <FingerTarget scanning={scanning} done={!!pidData} />
        <Text style={styles.heroTitle}>
          {pidData ? 'Fingerprint captured' : scanning ? 'Place finger on scanner' : 'Ready to scan'}
        </Text>
        <Text style={styles.heroBody}>
          {pidData
            ? 'Signed and ready to submit.'
            : 'Press firmly and keep the finger still until the scanner light turns green.'}
        </Text>
      </View>

      {pidData ? (
        // The hero above already says "captured"; this only offers the way back.
        <Button
          variant="outline"
          icon="refresh"
          fullWidth
          onPress={() => onCaptured(null)}
          accessibilityLabel="Discard captured fingerprint"
        >
          Rescan
        </Button>
      ) : (
        <Button
          icon="fingerprint"
          haptic="light"
          size="lg"
          fullWidth
          loading={scanning}
          disabled={disabled || !!blockedReason}
          onPress={start}
        >
          {scanning ? 'Scanning…' : label}
        </Button>
      )}

      {!!error && (
        <Banner
          tone="error"
          message={error}
          action={missing ? undefined : { label: 'Retry', onPress: start }}
        />
      )}

      <Text style={styles.hint}>
        The scan is signed by the UIDAI RD Service on this device. Shahparpay never sees or stores
        the raw fingerprint.
      </Text>

      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Ready to scan?"
        icon="fingerprint"
        message={confirmMessage ?? ''}
        confirmLabel="Start scan"
        onConfirm={runCapture}
      />
    </View>
  );
};

/** "State Bank of India" → "SB": the letter-circle a bank row shows in place of a logo. */
export const bankInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

/** Quality score the RD Service signs into the PID block, when it sends one. */
export const pidQuality = (pidData: string | null) => {
  const score = Number(pidData?.match(/qScore="(\d+(?:\.\d+)?)"/)?.[1]);
  return Number.isFinite(score) && score > 0 ? Math.min(100, Math.round(score)) : null;
};

/** The flow's buttons: BHIM's orange pill, or the neutral outline pill when `ghost`. */
export const ActionButton: React.FC<{
  label: string;
  icon?: string;
  onPress: () => void;
  ghost?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ label, icon, onPress, ghost, disabled, loading, style }) => (
  <Button
    variant={ghost ? 'outline' : 'default'}
    icon={icon}
    onPress={onPress}
    disabled={disabled}
    loading={loading}
    accessibilityLabel={label}
    style={style}
  >
    {label}
  </Button>
);

/** A large line fingerprint inside a hairline ring; a quarter arc turns while scanning. */
export const FingerTarget: React.FC<{ scanning?: boolean; done?: boolean }> = ({ scanning, done }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '390deg'] });
  const tint = done ? colors.success : colors.highlight;
  return (
    <View style={styles.fp}>
      <View style={[styles.fpRing, done && { borderColor: colors.success }]} />
      {scanning && (
        <Animated.View style={[styles.fpArc, { borderTopColor: tint, transform: [{ rotate }] }]} />
      )}
      <View style={styles.fpDisc}>
        <Ionicons name="finger-print-outline" size={96} color={done ? colors.success : colors.foreground} />
      </View>
    </View>
  );
};

/**
 * Full-screen capture step (mockup 07). Starts the scan as it opens; once a
 * PID block is in hand the retailer submits from here or rescans. Cancel
 * drops whatever the RD Service returns afterwards.
 */
export const CaptureStep: React.FC<{
  visible: boolean;
  title: string;
  bankName: string;
  aadhaarNumber: string;
  device: DeviceBrand;
  options?: Omit<CaptureOptions, 'device'>;
  pidData: string | null;
  onCaptured: (pidData: string | null) => void;
  onClose: () => void;
  submitLabel: string;
  submitting?: boolean;
  submitError?: string | null;
  onSubmit: () => void;
}> = ({
  visible,
  title,
  bankName,
  aadhaarNumber,
  device,
  options,
  pidData,
  onCaptured,
  onClose,
  submitLabel,
  submitting,
  submitError,
  onSubmit,
}) => {
  const insets = useModalInsets();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const live = useRef(false);

  const runCapture = async () => {
    setScanning(true);
    setError(null);
    setMissing(false);
    onCaptured(null);
    try {
      const { pidData: captured } = await captureBiometric({ ...options, device });
      if (live.current) onCaptured(captured);
    } catch (err: any) {
      if (!live.current) return;
      setMissing(err instanceof RdServiceMissingError);
      setError(err?.message || 'Fingerprint capture failed.');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    live.current = visible;
    if (visible) runCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const quality = pidQuality(pidData);
  const initials = bankInitials(bankName);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.step, { paddingTop: insets.top }]}>
        <TopGlow />
        <View style={styles.topbar}>
          <Pressable
            onPress={onClose}
            hitSlop={11}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.stepBody}>
          <View style={styles.who}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.whoText}>
              <Text style={styles.whoBank} numberOfLines={1}>
                {bankName}
              </Text>
              <Text style={styles.whoSub}>Aadhaar XXXX XXXX {aadhaarNumber.slice(-4)}</Text>
            </View>
          </View>
          <View style={styles.stepTarget} accessibilityLiveRegion="polite">
            <FingerTarget scanning={scanning} done={!!pidData} />
          </View>
          <Text style={styles.stepTitle}>
            {pidData ? 'Fingerprint captured' : error ? 'Scan did not finish' : 'Place finger on scanner'}
          </Text>
          <Text style={styles.stepText}>
            {pidData
              ? 'Signed by the RD Service. Submit to send it to the bank.'
              : 'Ask the customer to press firmly. Keep the finger still until the light turns green.'}
          </Text>
          {quality !== null && (
            <>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${quality}%` }]} />
              </View>
              <Text style={styles.meterText}>Quality {quality}%</Text>
            </>
          )}
          {!!error && (
            <View style={styles.stepBanner}>
              <Banner tone="error" message={error} />
            </View>
          )}
          {!!submitError && (
            <View style={styles.stepBanner}>
              <Banner tone="error" message={submitError} />
            </View>
          )}
        </ScrollView>
        <View style={[styles.stepFoot, { paddingBottom: 16 + insets.bottom }]}>
          {pidData ? (
            <>
              <ActionButton ghost label="Rescan" onPress={runCapture} disabled={submitting} style={styles.flex} />
              <ActionButton label={submitLabel} onPress={onSubmit} loading={submitting} style={styles.flex} />
            </>
          ) : error && !missing ? (
            <>
              <ActionButton ghost label="Cancel" onPress={onClose} style={styles.flex} />
              <ActionButton icon="fingerprint" label="Try again" onPress={runCapture} style={styles.flex} />
            </>
          ) : (
            <ActionButton ghost label="Cancel" onPress={onClose} style={styles.flex} />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = themed((c) => ({
  container: { gap: space.lg },
  flex: { flex: 1 },
  fp: { width: 196, height: 196, alignItems: 'center', justifyContent: 'center' },
  fpRing: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  fpArc: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fpDisc: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
  },
  step: { flex: 1, backgroundColor: c.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
  },
  topTitle: { flex: 1, fontSize: 21, fontWeight: '500', color: c.foreground },
  stepBody: { paddingHorizontal: space.lg, alignItems: 'center', paddingTop: space.sm, paddingBottom: space.lg },
  who: { alignItems: 'center', gap: space.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tileGradient[0],
  },
  avatarText: { fontSize: t.bodyLg, fontWeight: '500', color: c.tileForeground },
  whoText: { alignItems: 'center', gap: 2 },
  whoBank: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, textAlign: 'center' },
  whoSub: {
    fontSize: t.small,
    color: c.mutedForeground,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: space.md,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  stepTarget: { marginTop: space.xxxl },
  stepTitle: { fontSize: t.title, fontWeight: '400', color: c.foreground, marginTop: space.xxl, textAlign: 'center' },
  stepText: {
    fontSize: t.small,
    color: c.mutedForeground,
    marginTop: space.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  meter: {
    marginTop: space.xl,
    width: 180,
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: c.border,
  },
  meterFill: { height: '100%', backgroundColor: c.success },
  meterText: { fontSize: t.caption, color: c.mutedForeground, marginTop: space.sm },
  stepBanner: { alignSelf: 'stretch', marginTop: space.lg },
  stepFoot: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  label: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  devices: { gap: space.sm },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  deviceChipActive: { borderColor: c.highlight },
  deviceText: { fontSize: t.small, color: c.foreground },
  deviceTextActive: { color: c.accent, fontWeight: '500' },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  heroTitle: { fontSize: t.bodyLg, fontWeight: '500', color: c.foreground, marginTop: space.md },
  heroBody: {
    fontSize: t.small,
    color: c.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: space.lg,
  },
  hint: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 17 },
}));

export default BiometricCapture;
