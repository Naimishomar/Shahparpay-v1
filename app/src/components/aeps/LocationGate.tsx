import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { openLocationSettings, requireCoords, type LocationFailure } from '@/services/location';
import { useLocationReady } from '@/hooks/useLocationReady';

const COPY: Record<LocationFailure, { title: string; body: string; action: string }> = {
  denied: {
    title: 'Location access needed',
    body: 'The bank geo-fences AEPS to your registered shop address. Without your real location every transaction is refused.',
    action: 'Allow location',
  },
  'services-off': {
    title: 'Location Services are off',
    body: 'Turn on Location so AEPS can record where the transaction was made.',
    action: 'Turn on Location',
  },
  unavailable: {
    title: 'Could not get your location',
    body: 'Step near a window or outside and try again.',
    action: 'Try again',
  },
};

/**
 * Warns before the form, not after the submit.
 *
 * AEPS without coordinates is refused by the bank as out of its geo-fence, and
 * that refusal arrives as a provider error with nothing pointing at the real
 * cause. Checking on focus means the retailer is told while they can still fix
 * it, rather than after they have taken the customer's finger on the scanner.
 */
export const LocationGate: React.FC = () => {
  // The same hook the capture button reads, so the warning and the block can
  // never disagree about whether location is usable.
  const { problem, setProblem } = useLocationReady();
  const [busy, setBusy] = useState(false);

  if (!problem) return null;
  const copy = COPY[problem];

  const onFix = async () => {
    setBusy(true);
    try {
      if (problem === 'denied') {
        // Ask in-app first: on a first run the permission has never been
        // requested, and sending someone to Settings for a dialog they have
        // not seen yet is a detour they should not need.
        const granted = await requireCoords({ force: true }).then(
          () => true,
          () => false
        );
        if (granted) {
          setProblem(null);
          return;
        }
      }
      await openLocationSettings(problem);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name="map-marker-alert" size={20} color={colors.warning} />
      <View style={styles.text}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      <Pressable
        onPress={onFix}
        disabled={busy}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={copy.action}
      >
        <Text style={styles.actionText}>{busy ? '…' : copy.action}</Text>
      </Pressable>
    </View>
  );
};

const styles = themed((c) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderLeftWidth: 3,
    borderLeftColor: c.warning,
    borderRadius: radius.md,
    backgroundColor: c.warningSubtle,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: t.small, fontWeight: '700', color: c.warning },
  body: { fontSize: t.caption, color: c.warning, lineHeight: 18, opacity: 0.9 },
  action: { minHeight: TOUCH, justifyContent: 'center', paddingLeft: space.sm },
  actionText: { fontSize: t.caption, fontWeight: '800', color: c.warning, textAlign: 'right' },
}));

export default LocationGate;
