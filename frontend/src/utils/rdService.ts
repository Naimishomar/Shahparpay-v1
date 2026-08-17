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

export interface CaptureOptions {
  // Optional per-pipe WADH (eKYC capture flows). Omit for AEPS/DMT
  // transaction captures where PaySprint expects an empty wadh.
  wadh?: string;
  // Optional AEPS transaction OTP, bound into the captured PID block.
  otp?: string;
}

/**
 * Discovers the active RD Service by probing /rd/info on every standard port
 * (http + https, 127.0.0.1 + localhost). Returns the base URL or null.
 */
export const discoverRdServiceUrl = async (): Promise<string | null> => {
  const protocols =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? ['https', 'http']
      : ['http', 'https'];

  for (const host of RD_HOSTS) {
    for (const protocol of protocols) {
      for (const port of RD_PORTS) {
        try {
          const testUrl = `${protocol}://${host}:${port}`;
          const response = await fetch(`${testUrl}/rd/info`, {
            method: 'RDSERVICE',
            headers: { 'Accept': 'text/xml' },
            signal: AbortSignal.timeout(500),
          });
          if (response.ok) {
            const text = await response.text();
            // Accept both the strict UIDAI readiness marker and any RD info
            // response (some vendors omit status="READY").
            if (text && (text.includes('status="READY"') || text.includes('Resp'))) {
              return testUrl;
            }
          }
        } catch {
          // ignore and try next port
        }
      }
    }
  }
  return null;
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
  const activeUrl = await discoverRdServiceUrl();
  if (!activeUrl) {
    throw new Error(
      'RD Service not found on ports 11100-11120. Please ensure the Mantra/Morpho/Startek RD Service is installed, running, and the device is connected.'
    );
  }

  const captureResponse = await fetch(`${activeUrl}/rd/capture`, {
    method: 'CAPTURE',
    body: buildCaptureXml(options),
    headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml' },
  });
  const capturedData = await captureResponse.text();
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