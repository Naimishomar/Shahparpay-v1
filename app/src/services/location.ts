import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';

export interface Coords {
  latitude: string;
  longitude: string;
}

/** Why a fix could not be taken, in the order a retailer would fix it. */
export type LocationFailure = 'denied' | 'services-off' | 'unavailable';

export class LocationError extends Error {
  reason: LocationFailure;
  constructor(reason: LocationFailure, message: string) {
    super(message);
    this.name = 'LocationError';
    this.reason = reason;
  }
}

const MESSAGES: Record<LocationFailure, string> = {
  denied:
    'Location permission is off. AEPS is geo-fenced by the bank, so the transaction cannot be sent without your shop’s real location. Allow location access and try again.',
  'services-off':
    'Location Services are turned off on this device. Turn them on so AEPS can record your shop’s location.',
  unavailable:
    'Could not get your location. Step near a window or outside, wait a moment, and try again.',
};

/**
 * The agent's coordinates, as NPCI requires on every AEPS call.
 *
 * Accuracy.High, not Balanced: the bank geo-fences an AePS outlet against the
 * address it was registered at, and Balanced resolves to roughly a hundred
 * metres from cell towers and wifi — enough to land outside the fence and be
 * refused. High asks the GPS.
 *
 * Nothing here ever invents a location. The old version returned null on a
 * failure and the caller spread `{}` into the payload, which the backend then
 * filled in with a hardcoded Delhi default — so a shop anywhere else was sent
 * transacting from Delhi and the bank rejected it as out of its geo-fence,
 * with nothing on screen saying why.
 */
const CACHE_TTL_MS = 5 * 60_000;
/** A fix looser than this is not worth geo-fencing against; ask again. */
const MAX_ACCURACY_M = 100;
const LOCATION_TIMEOUT_MS = 15_000;

let cached: { coords: Coords; at: number } | null = null;
let inFlight: Promise<Coords> | null = null;

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

/** Whether a fix is tight enough to sit inside a bank's geo-fence. */
export const isPrecise = (fix: { coords: { accuracy?: number | null } } | null): boolean =>
  !!fix && (fix.coords.accuracy ?? Infinity) <= MAX_ACCURACY_M;

/**
 * Which of the two fixes to transact on.
 *
 * A precise live fix always wins. Failing that a precise last-known one beats
 * an imprecise live one — being a few minutes old matters less to a geo-fence
 * than being a kilometre wide. If neither is precise the live fix is still
 * preferred over the stale one, and the caller decides whether to send it.
 */
export const pickFix = <T extends { coords: { accuracy?: number | null } }>(
  live: T | null,
  lastKnown: T | null
): T | null => {
  if (isPrecise(live)) return live;
  if (isPrecise(lastKnown)) return lastKnown;
  return live ?? lastKnown;
};

const toCoords = (position: Location.LocationObject): Coords => ({
  latitude: String(position.coords.latitude),
  longitude: String(position.coords.longitude),
});

/**
 * A real fix, or a LocationError explaining what the retailer has to change.
 *
 * Cached for CACHE_TTL_MS: a shop does not move between transactions, and a
 * GPS lock per keystroke would stall the form. The TTL is short enough that a
 * fix taken in the wrong place cannot follow the device around all day.
 */
export const requireCoords = async (options?: { force?: boolean }): Promise<Coords> => {
  if (!options?.force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.coords;
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<Coords> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new LocationError('denied', MESSAGES.denied);

    // Android leaves getCurrentPositionAsync pending rather than rejecting when
    // Location Services are off, so this is checked before asking for a fix.
    if (!(await Location.hasServicesEnabledAsync())) {
      throw new LocationError('services-off', MESSAGES['services-off']);
    }

    let position: Location.LocationObject | null = null;
    try {
      position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        LOCATION_TIMEOUT_MS
      );
    } catch {
      position = null;
    }

    // A recent last-known fix beats no transaction, but only if it is precise
    // enough to sit inside a geo-fence — a 1km-accurate fix is exactly what
    // gets refused, so it is worth asking for a second opinion.
    let lastKnown: Location.LocationObject | null = null;
    if (!isPrecise(position)) {
      lastKnown = await withTimeout(
        Location.getLastKnownPositionAsync({
          maxAge: CACHE_TTL_MS,
          requiredAccuracy: MAX_ACCURACY_M,
        }),
        3_000
      ).catch(() => null);
    }

    const fix = pickFix(position, lastKnown);
    if (!fix) throw new LocationError('unavailable', MESSAGES.unavailable);

    const coords = toCoords(fix);
    cached = { coords, at: Date.now() };
    return coords;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

/**
 * Spreadable into an API payload: `{...(await coordsPayload())}`.
 *
 * Throws rather than yielding an empty object — a missing coordinate is not a
 * degraded transaction, it is a refused one, and the caller's error banner is
 * where that belongs.
 */
export const coordsPayload = async (): Promise<Coords> => requireCoords();

/** Whether a fix can be taken right now, for screens that warn before a form. */
export const checkLocationReady = async (): Promise<LocationFailure | null> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    if (!(await Location.hasServicesEnabledAsync())) return 'services-off';
    return null;
  } catch {
    return null;
  }
};

/**
 * Opens the place the retailer can actually fix it: the app's own permission
 * screen when the permission was denied, and the system location panel when
 * the radio itself is off. Sending them to the wrong one of those two is how
 * "open settings" becomes a dead end.
 */
export const openLocationSettings = async (reason: LocationFailure) => {
  if (Platform.OS === 'android' && reason === 'services-off') {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
    ).catch(() => Linking.openSettings());
    return;
  }
  await Linking.openSettings().catch(() => undefined);
};

export const clearCoordsCache = () => {
  cached = null;
};
