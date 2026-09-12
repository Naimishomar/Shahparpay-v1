// Shared UIDAI RD Service helper used by AEPS, DMT, Merchant eKYC and Pipe
// onboarding. All three supported scanner brands (Mantra, Morpho, Startek)
// expose the SAME UIDAI RD Service HTTP API — the brand only changes which
// vendor RD Service software is installed, never the capture protocol.

export type DeviceBrand = 'mantra' | 'morpho' | 'startek';

export const DEVICE_BRANDS: DeviceBrand[] = ['mantra', 'morpho', 'startek'];

export const DEVICE_LABELS: Record<DeviceBrand, string> = {
  mantra: 'Mantra (MFS100 / MFS110)',
  morpho: 'Morpho (IDEMIA E2 / E3 / MSO)',
  startek: 'Startek (FM220 / FM300)',
};

// Standard UIDAI RD Service ports. Mantra typically binds 11100, Morpho 11101,
// Startek 11100/11101 — but any vendor may use a different one in this range,
// so we probe the whole 11100–11120 block.
const RD_PORTS = Array.from({ length: 21 }, (_, i) => 11100 + i);
const RD_HOSTS = ['127.0.0.1', 'localhost'];
const RD_PROBE_TIMEOUT_MS = 900;

// Preferred probe order per brand. When the user selects a specific scanner
// brand we probe its known ports first so the capture always reaches the
// matching RD Service — otherwise (with multiple RD Services installed) the
// ascending port probe can land on a different brand's service and the
// selected scanner never receives the capture command (its LED never glows).
const BRAND_PREFERRED_PORTS: Record<DeviceBrand, number[]> = {
  mantra: [11100, 11101],
  morpho: [11101, 11100],
  startek: [11100, 11101],
};

export interface CaptureOptions {
  // Optional per-pipe WADH (eKYC capture flows). Omit for AEPS/DMT
  // transaction captures where PaySprint expects an empty wadh.
  wadh?: string;
  // Optional AEPS transaction OTP, bound into the captured PID block.
  otp?: string;
  // The scanner brand the user selected. Drives RD Service discovery so the
  // capture is sent to the brand's RD Service and its LED lights up.
  device?: DeviceBrand;
}

/**
 * Discovers the active RD Service by probing /rd/info on every standard port
 * (http + https, 127.0.0.1 + localhost). The selected device brand's known
 * ports are probed first so the capture reaches the matching RD Service.
 * Returns the base URL or null.
 */
export const discoverRdServiceUrl = async (
  device?: DeviceBrand
): Promise<string | null> => {
  // Probe the selected brand's ports first, then fall back to the rest.
  const preferred = device ? BRAND_PREFERRED_PORTS[device] : [];
  const orderedPorts = [
    ...preferred,
    ...RD_PORTS.filter((p) => !preferred.includes(p)),
  ];

  // Mantra's Windows RD Service normally exposes HTTP on 11100. Probe all
  // candidates concurrently: a sequential scan can take 20–40 seconds and
  // makes a healthy local service look unavailable to the retailer.
  const candidates = [
    ...orderedPorts.flatMap((port) =>
      RD_HOSTS.map((host) => `http://${host}:${port}`)
    ),
    ...orderedPorts.flatMap((port) =>
      RD_HOSTS.map((host) => `https://${host}:${port}`)
    ),
  ];

  const probe = async (baseUrl: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RD_PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/rd/info`, {
        method: 'RDSERVICE',
        headers: { Accept: 'text/xml' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const text = await response.text();
      // Accept both the strict UIDAI readiness marker and vendors that omit
      // status="READY" but still return a valid RD service response.
      return text && (/status\s*=\s*["']READY["']/i.test(text) || /<Resp\b/i.test(text))
        ? baseUrl
        : null;
    } catch {
      // Closed ports, mixed-content blocking, CORS and untrusted local TLS
      // certificates are all expected failures while probing candidates.
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const results = await Promise.all(candidates.map(probe));
  return results.find((url): url is string => Boolean(url)) ?? null;
};

/**
 * Builds the UIDAI PidOptions capture XML. fType="2" (FMR+FIR) is the
 * high-security L1 option supported by all three scanner brands.
 *
 * RD Services validate the XML against the UIDAI spec and reject non-spec
 * input with errCode 100 ("Invalid PidOptions input. XML should strictly
 * adhere to spec"). The proven cross-vendor (Morpho/Mantra/Startek) format is
 * a single-line <PidOptions> with NO XML declaration and NO <CustOpts> block.
 */
export const buildCaptureXml = (options: CaptureOptions = {}): string => {
  const wadhAttr = options.wadh ? ` wadh="${options.wadh}"` : '';
  const otpAttr = options.otp ? ` otp="${options.otp}"` : '';
  return `<PidOptions ver="1.0"><Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="P"${otpAttr}${wadhAttr} /></PidOptions>`;
};

export interface RdCaptureResult {
  pidData: string;
  activeUrl: string;
}

/**
 * Captures a fingerprint via the discovered RD Service.
 * Throws a descriptive Error on failure (no service found, RD error, init).
 */
export const captureBiometric = async (
  options: CaptureOptions = {}
): Promise<RdCaptureResult> => {
  const activeUrl = await discoverRdServiceUrl(options.device);
  const deviceLabel = options.device ? DEVICE_LABELS[options.device] : 'biometric device';
  if (!activeUrl) {
    throw new Error(
      `${deviceLabel} RD Service could not be reached from this browser. Start the RD Service, connect the scanner, allow browser access to localhost, and retry. If this portal is HTTPS, use the approved RD Service certificate or the provider-supported browser setup.`
    );
  }

  let capturedData: string;
  try {
    const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
      method: 'CAPTURE',
      body: buildCaptureXml(options),
      headers: { 'Content-Type': 'text/xml', Accept: 'text/xml' },
      cache: 'no-store',
    });
    capturedData = await captureResponse.text();
  } catch {
    throw new Error(
      `${deviceLabel} RD Service was detected, but the browser could not start capture. Check the scanner connection and allow localhost access, then retry.`
    );
  }
  console.log('RD Capture Response:', capturedData);

  const errCodeMatch = capturedData.match(/errCode="([^"]*)"/);
  const errInfoMatch = capturedData.match(/errInfo="([^"]*)"/);
  const errCode = errCodeMatch ? errCodeMatch[1] : null;
  const errInfo = errInfoMatch ? errInfoMatch[1] : null;

  if (errCode === '0' && capturedData.includes('PidData')) {
    return { pidData: capturedData, activeUrl };
  }

  let errorMsg = 'Biometric capture failed. Please clean the scanner and try again.';
  if (errCode && errInfo) {
    errorMsg = `RD Service Error (${errCode}): ${errInfo}`;
  } else if (capturedData.includes('init')) {
    errorMsg =
      'RD Service initialization error. Please restart the RD Service (Mantra/Morpho/Startek) and try again.';
  }
  throw new Error(errorMsg);
};
