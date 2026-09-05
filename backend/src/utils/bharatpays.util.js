import axios from 'axios';

/**
 * BharatPays recharge API.
 *
 * Everything lives on api.bharatpays.in under /api, the same host and prefix the
 * PSA endpoints in pan.controller.js already use. The published documentation
 * says https://bharatpays.in/api_user/... instead; that host answers every
 * request with "Invalid Api Token." no matter which token is sent, so the docs
 * are simply wrong. Verified against the live API: /api/recharge_get,
 * /api/recharge_get/status_check and /api/balance_get all resolve there.
 *
 * Every parameter goes on the query string, with the token repeated as a bearer
 * header. Calls are only accepted from an IP registered in the BharatPays API
 * settings panel — from anywhere else the reply is "Invalid Ip Address - <ip>".
 */
const getBase = () => process.env.BHARATPAYS_RECHARGE_BASE_URL || 'https://api.bharatpays.in';

export const bharatPaysGet = async (path, params = {}) => {
  const token = process.env.BHARATPAYS_TOKEN;
  if (!token) throw new Error('BHARATPAYS_TOKEN is not configured');

  const query = new URLSearchParams({ token, ...params });
  const response = await axios.get(`${getBase()}${path}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    timeout: 60000,
  });
  return response.data;
};

/**
 * BharatPays returns validation failures as HTML — "<p> The Reference Id field
 * must contain only numbers </p>" — and that string reaches the retailer as a
 * toast, tags and all. Strip the markup and collapse the padding it leaves.
 */
export const cleanProviderMessage = (raw) => {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Types BharatPays can actually recharge. Everything else stays on Paysprint
 * BBPS, which is the only rail that can fetch a bill before debiting. FASTag and
 * Google Play qualify because they are top-ups with no bill to show.
 */
export const BHARATPAYS_TYPES = new Set([
  'prepaid',
  'postpaid',
  'dth',
  'fastag',
  'googleplay',
]);

/** The `type` a screen sends, to the category on the operator table above. */
export const BHARATPAYS_CATEGORY = {
  prepaid: 'Prepaid',
  postpaid: 'Postpaid',
  dth: 'DTH',
  fastag: 'Fastag',
  googleplay: 'GooglePlay',
};

/**
 * BharatPays publishes its operator codes as a static table, not an API, so the
 * list is kept here in the same shape the Paysprint branch returns. Duplicate
 * codes for one brand are the provider's own routing lanes (a lane can be down
 * on its own), so they are all listed rather than collapsed.
 */
export const BHARATPAYS_OPERATORS = [
  // Prepaid mobile
  { id: 170, name: 'Airtel', category: 'Prepaid', plan: 'Airtel' },
  { id: 1, name: 'Vodafone Idea (Vi)', category: 'Prepaid', plan: 'Vodafone' },
  { id: 368, name: 'Vi', category: 'Prepaid', plan: 'Vodafone' },
  { id: 184, name: 'Vodafone Office', category: 'Prepaid', plan: 'Vodafone' },
  { id: 3, name: 'Idea', category: 'Prepaid', plan: 'Idea' },
  { id: 365, name: 'Idea 2', category: 'Prepaid', plan: 'Idea' },
  { id: 366, name: 'Jio', category: 'Prepaid', plan: 'Jio' },
  { id: 2, name: 'Jio Office', category: 'Prepaid', plan: 'Jio' },
  { id: 14, name: 'Jio Office 2', category: 'Prepaid', plan: 'Jio' },
  { id: 367, name: 'Jio Office 3', category: 'Prepaid', plan: 'Jio' },
  { id: 15, name: 'Jio Standard', category: 'Prepaid', plan: 'Jio' },
  { id: 13, name: 'BSNL', category: 'Prepaid', plan: 'BSNL' },
  { id: 361, name: 'BSNL 2', category: 'Prepaid', plan: 'BSNL' },
  { id: 138, name: 'BSNL Recharge/Validity (RCV)', category: 'Prepaid', plan: 'BSNL' },
  { id: 362, name: 'BSNL STV', category: 'Prepaid', plan: 'BSNL' },
  { id: 363, name: 'BSNL Topup', category: 'Prepaid', plan: 'BSNL' },

  // Postpaid mobile
  { id: 353, name: 'Airtel Postpaid', category: 'Postpaid' },
  { id: 359, name: 'Vodafone Postpaid', category: 'Postpaid' },
  { id: 139, name: 'Vodafone', category: 'Postpaid' },
  { id: 141, name: 'Idea Postpaid', category: 'Postpaid' },
  { id: 188, name: 'Jio Postpaid', category: 'Postpaid' },
  { id: 355, name: 'Jio Postpaid 2', category: 'Postpaid' },
  { id: 356, name: 'Reliance Jio Postpaid', category: 'Postpaid' },
  { id: 357, name: 'Reliance Postpaid (CDMA)', category: 'Postpaid' },
  { id: 354, name: 'BSNL Cellone', category: 'Postpaid' },
  { id: 142, name: 'BSNL Mobile', category: 'Postpaid' },
  { id: 358, name: 'Tikona Infinet', category: 'Postpaid' },

  // DTH
  { id: 12, name: 'Airtel DTH', category: 'DTH', plan: 'Airteldth' },
  { id: 185, name: 'Airtel DTH Office', category: 'DTH', plan: 'Airteldth' },
  { id: 7, name: 'Dish TV', category: 'DTH', plan: 'Dishtv' },
  { id: 378, name: 'Dish TV Official', category: 'DTH', plan: 'Dishtv' },
  { id: 8, name: 'Tata Play (Tata Sky)', category: 'DTH', plan: 'TataSky' },
  { id: 10, name: 'Videocon D2H', category: 'DTH', plan: 'Videocon' },
  { id: 11, name: 'Sun Direct', category: 'DTH', plan: 'Sundirect' },
  { id: 186, name: 'Sun Direct Official', category: 'DTH', plan: 'Sundirect' },
  { id: 9, name: 'Big TV', category: 'DTH' },
  { id: 371, name: 'Zing TV DTH', category: 'DTH' },

  // FASTag and Google Play are top-ups, not bills: there is no bill to fetch
  // before paying, which is the only reason the other BBPS categories stayed on
  // Paysprint. Where BharatPays publishes two codes for one bank they are
  // separate lanes, so both are kept and the display name carries the code.
  { id: 370, name: 'Airtel Payments Bank FASTag', category: 'Fastag' },
  { id: 174, name: 'Axis Bank FASTag', category: 'Fastag' },
  { id: 283, name: 'Axis Bank FASTag (283)', category: 'Fastag' },
  { id: 181, name: 'Bank of Baroda FASTag', category: 'Fastag' },
  { id: 284, name: 'Bank of Baroda FASTag (284)', category: 'Fastag' },
  { id: 180, name: 'Equitas FASTag', category: 'Fastag' },
  { id: 285, name: 'Equitas FASTag (285)', category: 'Fastag' },
  { id: 183, name: 'Federal Bank FASTag', category: 'Fastag' },
  { id: 286, name: 'Federal Bank FASTag (286)', category: 'Fastag' },
  { id: 176, name: 'HDFC Bank FASTag', category: 'Fastag' },
  { id: 287, name: 'HDFC Bank FASTag (287)', category: 'Fastag' },
  { id: 178, name: 'ICICI Bank FASTag', category: 'Fastag' },
  { id: 289, name: 'IDBI Bank FASTag', category: 'Fastag' },
  { id: 177, name: 'IDFC FIRST Bank FASTag', category: 'Fastag' },
  { id: 290, name: 'IDFC FIRST Bank FASTag (290)', category: 'Fastag' },
  { id: 179, name: 'Indian Highways Management (IHMCL) FASTag', category: 'Fastag' },
  { id: 291, name: 'IHMCL IndusInd FASTag', category: 'Fastag' },
  { id: 292, name: 'IndusInd Bank FASTag', category: 'Fastag' },
  { id: 293, name: 'Indian Overseas Bank FASTag', category: 'Fastag' },
  { id: 294, name: 'Jammu and Kashmir Bank FASTag', category: 'Fastag' },
  { id: 295, name: 'Karnataka Bank FASTag', category: 'Fastag' },
  { id: 173, name: 'Kotak Mahindra Bank FASTag', category: 'Fastag' },
  { id: 175, name: 'Kotak Mahindra Bank FASTag (175)', category: 'Fastag' },
  { id: 369, name: 'Kotak Mahindra Bank FASTag (369)', category: 'Fastag' },
  { id: 182, name: 'Paul Merchants FASTag', category: 'Fastag' },
  { id: 297, name: 'Paul Merchants FASTag (297)', category: 'Fastag' },
  { id: 172, name: 'Paytm Payments Bank FASTag', category: 'Fastag' },
  { id: 300, name: 'State Bank of India FASTag', category: 'Fastag' },
  { id: 301, name: 'Transaction Analyst FASTag', category: 'Fastag' },
  { id: 302, name: 'Transcorp International FASTag', category: 'Fastag' },
  { id: 303, name: 'UCO Bank FASTag', category: 'Fastag' },

  { id: 171, name: 'Google Play', category: 'GooglePlay' },
  { id: 364, name: 'Google Play (364)', category: 'GooglePlay' },
];

/**
 * Plan browsing and DTH info have no BharatPays equivalent, so those two lookups
 * still go to Paysprint. This turns the BharatPays code the UI now sends back
 * into the operator name Paysprint expects.
 */
export const paysprintPlanOperator = (operatorCode) =>
  BHARATPAYS_OPERATORS.find((op) => op.id === Number(operatorCode))?.plan || null;

/**
 * BharatPays reports REFUNDED for a recharge it reversed at its own end. For our
 * wallet that is the same event as a failure: the retailer gets the money back.
 */
export const normaliseStatus = (status) => {
  const value = String(status || '').toUpperCase();
  if (value === 'SUCCESS') return 'SUCCESS';
  if (value === 'FAILED' || value === 'FAILURE' || value === 'REFUNDED') return 'FAILED';
  return 'PENDING';
};

/**
 * Asks BharatPays where a recharge ended up.
 *
 * Returns PROCESSING for anything that is not a definite answer — still pending,
 * provider said `success: 0`, network down. Refunding on a non-answer would hand
 * the money back for a recharge that may still be delivered, so an unanswered
 * check always leaves the funds locked for the next run instead.
 */
export const fetchBharatPaysStatus = async (orderId) => {
  try {
    const data = await bharatPaysGet('/api/recharge_get/status_check', {
      order_id: orderId,
    });
    if (Number(data?.success) !== 1) return { finalStatus: 'PROCESSING', data };

    const status = normaliseStatus(data?.data?.status);
    return { finalStatus: status === 'PENDING' ? 'PROCESSING' : status, data };
  } catch (error) {
    console.error(`BharatPays status check failed for order ${orderId}:`, error.message);
    return { finalStatus: 'PROCESSING', data: null };
  }
};
