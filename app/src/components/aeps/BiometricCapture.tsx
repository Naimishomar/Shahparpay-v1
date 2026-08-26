import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Screen';
import { ConfirmSheet } from '@/components/ui/Sheet';
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
            <MaterialCommunityIcons
              name={active ? 'check-circle' : 'circle-outline'}
              size={15}
              color={active ? colors.accent : colors.mutedForeground}
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

      {pidData ? (
        <View style={styles.captured} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="fingerprint" size={20} color={colors.success} />
          <Text style={styles.capturedText}>Fingerprint captured and ready to submit.</Text>
          <Pressable
            onPress={() => onCaptured(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Discard captured fingerprint"
          >
            <Text style={styles.recapture}>Rescan</Text>
          </Pressable>
        </View>
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

const styles = themed((c) => ({
  container: { gap: space.lg },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  devices: { gap: 6 },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  deviceChipActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  deviceText: { fontSize: t.caption, fontWeight: '600', color: c.foreground },
  deviceTextActive: { color: c.foreground },
  captured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.successSubtle,
  },
  capturedText: { flex: 1, fontSize: t.small, fontWeight: '600', color: c.success },
  recapture: { fontSize: t.small, fontWeight: '700', color: c.success, minWidth: 44, textAlign: 'right' },
  hint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default BiometricCapture;
