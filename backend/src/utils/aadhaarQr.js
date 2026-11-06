import zlib from 'zlib';
import sharp from 'sharp';
import jsQR from 'jsqr';

const text = (v) => (v == null ? '' : String(v).trim());

/** The address parts as the onboarding form takes them; parts the QR lacks stay ''. */
const toAddress = ({ house, street, landmark, location, po, vtc, district, state, pincode }) => {
  const line = [...new Set([house, street, location, po].map(text).filter(Boolean))].join(', ');
  const pin = text(pincode).replace(/\D/g, '');
  return {
    businessAddress: [line, /^\d{6}$/.test(pin) ? pin : ''].filter(Boolean).join(' - '),
    city: text(vtc),
    district: text(district),
    state: text(state),
    landmark: text(landmark),
    pincode: /^\d{6}$/.test(pin) ? pin : '',
  };
};

/**
 * UIDAI Secure QR: a decimal number whose bytes are gzip, holding fields split
 * by byte 255. V2 cards open with a "V2" field, which shifts the rest by one.
 * Order: indicator, reference id, name, dob, gender, care of, district,
 * landmark, house, location, pincode, post office, state, street, sub-district, vtc.
 */
const parseSecureQr = (digits) => {
  let hex = BigInt(digits).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const bytes = zlib.gunzipSync(Buffer.from(hex, 'hex'));
  const fields = [];
  let start = 0;
  for (let i = 0; i < bytes.length && fields.length < 17; i += 1) {
    if (bytes[i] !== 255) continue;
    fields.push(bytes.subarray(start, i).toString('utf8'));
    start = i + 1;
  }
  const f = /^V\d/.test(fields[0] || '') ? fields.slice(1) : fields;
  if (f.length < 16) return null;
  return toAddress({
    district: f[6], landmark: f[7], house: f[8], location: f[9], pincode: f[10],
    po: f[11], state: f[12], street: f[13], vtc: f[15],
  });
};

/** Older cards: <PrintLetterBarcodeData house=".." street=".." ... /> */
const parseXmlQr = (xml) => {
  const attr = (name) => xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '';
  return toAddress({
    house: attr('house'), street: attr('street'), landmark: attr('lm'), location: attr('loc'),
    po: attr('po'), vtc: attr('vtc'), district: attr('dist'), state: attr('state'), pincode: attr('pc'),
  });
};

/** The address in an Aadhaar QR payload, or null when it is not one. */
export const parseAadhaarQr = (payload) => {
  const data = text(payload);
  try {
    if (/^\d{100,}$/.test(data)) return parseSecureQr(data);
    if (data.includes('PrintLetterBarcodeData')) return parseXmlQr(data);
  } catch {
    // Not gzip or not a number: some other QR.
  }
  return null;
};

/**
 * Reads the QR on the back of an Aadhaar photo. The Secure QR is dense: full
 * resolution reads best (shrinking merges its modules), so it goes first, then
 * smaller sizes for blurry photos. Returns the address or null.
 */
export const readAadhaarQr = async (filePath) => {
  for (const width of [4000, 2400, 1600, 1100]) {
    const { data, info } = await sharp(filePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .normalise()
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: 'attemptBoth' });
    const address = code && parseAadhaarQr(code.data);
    if (address?.businessAddress) return address;
  }
  return null;
};
