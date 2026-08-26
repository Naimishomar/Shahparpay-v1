import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * UIDAI RD Service bridge — the native counterpart of the web app's
 * `frontend/src/utils/rdService.ts`.
 *
 * The capture protocol is identical across every certified scanner brand; only
 * the transport differs by platform:
 *
 *   Android — the RD Service ships as an APK that exposes two exported
 *             activities, `in.gov.uidai.rdservice.fp.INFO` and `.CAPTURE`.
 *             CAPTURE takes the PidOptions XML in the `PID_OPTIONS` extra and
 *             returns the signed PID block in the `PID_DATA` extra.
 *   Web     — the RD Service runs as a localhost HTTP daemon on 11100-11120
 *             and answers the custom `RDSERVICE` / `CAPTURE` methods.
 *   iOS     — UIDAI certifies no iOS RD Service. Capture is impossible there.
 */

export type DeviceBrand = 'mantra' | 'morpho' | 'startek' | 'secugen' | 'evolute';

export const DEVICE_BRANDS: DeviceBrand[] = [
  'mantra',
  'morpho',
  'startek',
  'secugen',
  'evolute',
];

export const DEVICE_LABELS: Record<DeviceBrand, string> = {
  mantra: 'Mantra (MFS100 / MFS110)',
  morpho: 'Morpho (IDEMIA E2 / E3 / MSO)',
  startek: 'Startek (FM220 / FM300)',
  secugen: 'SecuGen (Hamster Pro 20)',
  evolute: 'Evolute (Nano / Winbio)',
};

/**
 * RD Service APK package names. Setting the package pins the intent to the
 * brand the retailer picked — without it Android shows a chooser (or silently
 * routes to whichever RD Service registered last) and the selected scanner
 * never lights up.
 */
const RD_PACKAGES: Record<DeviceBrand, string> = {
  mantra: 'com.mantra.rdservice',
  morpho: 'com.scl.rdservice',
  startek: 'com.acpl.registersdk',
  secugen: 'com.secugen.rdservice',
  evolute: 'com.evolute.rdservice',
};

const INFO_ACTION = 'in.gov.uidai.rdservice.fp.INFO';
const CAPTURE_ACTION = 'in.gov.uidai.rdservice.fp.CAPTURE';

export interface CaptureOptions {
  /** Per-pipe WADH for eKYC captures. Omitted for AEPS/DMT transactions. */
  wadh?: string;
  /** AEPS transaction OTP, bound into the PID block by the RD Service. */
  otp?: string;
  device?: DeviceBrand;
}

/**
 * PidOptions capture XML. fType="2" (FMR+FIR) is the L1 option every certified
 * brand supports.
 *
 * RD Services validate against the UIDAI spec and reject anything else with
 * errCode 100 ("XML should strictly adhere to spec"), so this stays a single
 * line with no XML declaration and no <CustOpts> block — the format proven
 * across Mantra/Morpho/Startek on the web build.
 */
export const buildCaptureXml = (options: CaptureOptions = {}): string => {
  const wadhAttr = options.wadh ? ` wadh="${options.wadh}"` : '';
  const otpAttr = options.otp ? ` otp="${options.otp}"` : '';
  return `<PidOptions ver="1.0"><Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="P"${otpAttr}${wadhAttr} /></PidOptions>`;
};

export interface RdCaptureResult {
  pidData: string;
}

/** Raised so callers can offer "install the RD Service" instead of a retry. */
export class RdServiceMissingError extends Error {
  constructor(public device?: DeviceBrand) {
    super(
      device
        ? `${DEVICE_LABELS[device]} RD Service is not installed on this device. Install it from the Play Store, register the scanner, then try again.`
        : 'No UIDAI RD Service found on this device. Install your scanner\'s RD Service app from the Play Store and register the device.'
    );
    this.name = 'RdServiceMissingError';
  }
}

/** Pulls the first matching attribute out of an RD Service XML response. */
const attr = (xml: string, name: string) =>
  xml.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

/** Turns an errCode/errInfo pair into something a retailer can act on. */
const captureError = (xml: string) => {
  const errCode = attr(xml, 'errCode');
  const errInfo = attr(xml, 'errInfo');
  if (errCode && errCode !== '0') {
    return new Error(`RD Service error ${errCode}: ${errInfo || 'capture failed'}`);
  }
  if (xml.includes('init')) {
    return new Error(
      'RD Service could not initialise the scanner. Unplug and reconnect it, then try again.'
    );
  }
  return new Error('Fingerprint capture failed. Clean the sensor and try again.');
};

/** True when the response carries a usable signed PID block. */
const isSuccessfulPid = (xml: string) =>
  attr(xml, 'errCode') === '0' && xml.includes('PidData');

// ------------------------------------------------------------------ Android

const captureAndroid = async (options: CaptureOptions): Promise<RdCaptureResult> => {
  const packageName = options.device ? RD_PACKAGES[options.device] : undefined;

  let result: IntentLauncher.IntentLauncherResult;
  try {
    result = await IntentLauncher.startActivityAsync(CAPTURE_ACTION, {
      packageName,
      extra: { PID_OPTIONS: buildCaptureXml(options) },
    });
  } catch (error: any) {
    // No activity resolved the intent — the RD Service APK is not installed,
    // or Android 11+ package visibility is blocking it.
    if (/no activity|resolve|not found/i.test(String(error?.message))) {
      throw new RdServiceMissingError(options.device);
    }
    throw error;
  }

  if (result.resultCode !== IntentLauncher.ResultCode.Success) {
    throw new Error('Fingerprint capture was cancelled on the scanner app.');
  }

  const pidData = (result.extra as Record<string, any> | undefined)?.PID_DATA;
  if (typeof pidData !== 'string' || !pidData) {
    throw new Error('The RD Service returned no PID data. Try the capture again.');
  }
  if (!isSuccessfulPid(pidData)) throw captureError(pidData);
  return { pidData };
};

/** Whether the brand's RD Service responds to the INFO intent at all. */
export const probeRdService = async (device?: DeviceBrand): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await IntentLauncher.startActivityAsync(INFO_ACTION, {
      packageName: device ? RD_PACKAGES[device] : undefined,
    });
    return result.resultCode === IntentLauncher.ResultCode.Success;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------- Web

// Standard UIDAI daemon ports. Any vendor may pick a different one in the
// block, so the whole range is probed, brand-preferred ports first.
const RD_PORTS = Array.from({ length: 21 }, (_, i) => 11100 + i);
const BRAND_PORTS: Record<DeviceBrand, number[]> = {
  mantra: [11100, 11101],
  morpho: [11101, 11100],
  startek: [11100, 11101],
  secugen: [11100, 11101],
  evolute: [11100, 11101],
};

const discoverWebRdUrl = async (device?: DeviceBrand): Promise<string | null> => {
  const preferred = device ? BRAND_PORTS[device] : [];
  const ports = [...preferred, ...RD_PORTS.filter((p) => !preferred.includes(p))];
  for (const host of ['127.0.0.1', 'localhost']) {
    for (const port of ports) {
      const base = `http://${host}:${port}`;
      // A closed port can hang; 500ms is generous for a localhost daemon.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 500);
      try {
        const response = await fetch(`${base}/rd/info`, {
          method: 'RDSERVICE',
          headers: { Accept: 'text/xml' },
          signal: abort.signal,
        });
        if (!response.ok) continue;
        const text = await response.text();
        if (text.includes('status="READY"') || text.includes('Resp')) return base;
      } catch {
        // Port closed or blocked — keep probing.
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
};

const captureWeb = async (options: CaptureOptions): Promise<RdCaptureResult> => {
  const base = await discoverWebRdUrl(options.device);
  if (!base) throw new RdServiceMissingError(options.device);
  const response = await fetch(`${base}/rd/capture`, {
    method: 'CAPTURE',
    body: buildCaptureXml(options),
    headers: { 'Content-Type': 'text/xml', Accept: 'text/xml' },
  });
  const pidData = await response.text();
  if (!isSuccessfulPid(pidData)) throw captureError(pidData);
  return { pidData };
};

/**
 * Captures one fingerprint and returns the signed PID block.
 * Throws a message that is safe to show the retailer verbatim.
 */
export const captureBiometric = async (
  options: CaptureOptions = {}
): Promise<RdCaptureResult> => {
  if (Platform.OS === 'android') return captureAndroid(options);
  if (Platform.OS === 'web') return captureWeb(options);
  throw new Error(
    'UIDAI does not certify a fingerprint RD Service for iOS. Use the Android app or the web portal with a connected scanner.'
  );
};

export const isCaptureSupported = Platform.OS === 'android' || Platform.OS === 'web';

export default captureBiometric;
