import * as Location from 'expo-location';

export interface Coords {
  latitude: string;
  longitude: string;
}

/**
 * NPCI requires the agent's coordinates on every AEPS and DMT call. The
 * backend falls back to a fixed pair when they are missing, so a denied
 * permission degrades the transaction rather than blocking it.
 *
 * Cached for the session: the shop does not move between transactions, and a
 * GPS fix per keystroke would stall the form.
 */
let cached: Coords | null = null;
let inFlight: Promise<Coords | null> | null = null;
const LOCATION_TIMEOUT_MS = 10_000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location lookup timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export const getCoords = async (): Promise<Coords | null> => {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      // When Location Services are disabled, Android can leave
      // getCurrentPositionAsync pending instead of rejecting. Check first and
      // bound the lookup so AEPS/DMT actions never remain stuck on a spinner.
      if (!(await Location.hasServicesEnabledAsync())) return null;

      let position: Location.LocationObject;
      try {
        position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          LOCATION_TIMEOUT_MS
        );
      } catch {
        // A recent last-known fix is still preferable to sending no location
        // when the current GPS fix is temporarily unavailable indoors.
        const lastKnown = await withTimeout(
          Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 1000 }),
          2_000
        ).catch(() => null);
        if (!lastKnown) return null;
        position = lastKnown;
      }
      cached = {
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      };
      return cached;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Spreadable into an API payload: `{...(await coordsPayload())}`. */
export const coordsPayload = async (): Promise<Partial<Coords>> => (await getCoords()) ?? {};

export const clearCoordsCache = () => {
  cached = null;
};
