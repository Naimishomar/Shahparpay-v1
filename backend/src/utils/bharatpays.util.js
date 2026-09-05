import axios from 'axios';

/**
 * BharatPays recharge API.
 *
 * The PSA endpoints in pan.controller.js talk to api.bharatpays.in; the recharge
 * endpoints live on the main host under /api_user. Both take every parameter on
 * the query string and repeat the token as a bearer header.
 */
const getBase = () => process.env.BHARATPAYS_RECHARGE_BASE_URL || 'https://bharatpays.in';

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

/** Types BharatPays can actually recharge. Everything else stays on Paysprint BBPS. */
export const BHARATPAYS_TYPES = new Set(['prepaid', 'postpaid', 'dth']);

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
    const data = await bharatPaysGet('/api_user/recharge_get/status_check', {
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
