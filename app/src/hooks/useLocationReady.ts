import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { checkLocationReady, type LocationFailure } from '@/services/location';

/**
 * Whether a geo-fenced service can run right now, re-checked whenever the
 * screen regains focus — which is exactly when the retailer comes back from
 * Settings having fixed it.
 *
 * Shared so the warning banner and the capture button agree: a screen that
 * warns about location but still lets the retailer take the customer's
 * fingerprint has told them nothing useful.
 */
export function useLocationReady() {
  const [problem, setProblem] = useState<LocationFailure | null>(null);

  const recheck = useCallback(async () => {
    const next = await checkLocationReady();
    setProblem(next);
    return next;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      checkLocationReady().then((next) => {
        if (alive) setProblem(next);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  return { problem, recheck, setProblem };
}
