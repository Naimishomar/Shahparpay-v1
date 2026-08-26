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

export const getCoords = async (): Promise<Coords | null> => {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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
