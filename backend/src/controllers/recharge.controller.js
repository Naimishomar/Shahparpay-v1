import axios from 'axios';
import bcrypt from 'bcrypt';
import { generatePaySprintToken } from '../utils/paysprint.util.js';
import {
  bharatPaysGet,
  fetchBharatPaysStatus,
  normaliseStatus,
  paysprintPlanOperator,
  BHARATPAYS_OPERATORS,
  BHARATPAYS_TYPES,
  BHARATPAYS_CATEGORY,
  cleanProviderMessage,
  isOperatorForType,
} from '../utils/bharatpays.util.js';
import { lockFundsForTransaction, resolveTransaction } from '../utils/wallet.util.js';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';

const getPaysprintHeaders = () => {
  return {
    Token: generatePaySprintToken(),
    Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
    'Content-Type': 'application/json',
  };
};

const getPaysprintBase = () =>
  process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';

/**
 * Paysprint answers an operational refusal — add-on disabled, nightly
 * maintenance window, bad operator — with a non-2xx status and a message that
 * explains it. Left to axios that throws, the message is lost in a catch and the
 * retailer gets a generic 500, so every call reads the body instead.
 */
const paysprintPost = (url, payload) =>
  axios.post(url, payload, { headers: getPaysprintHeaders(), validateStatus: () => true });

/**
 * Mobile and DTH recharges run on BharatPays. Bill payments (electricity, gas,
 * fastag, ...) stay on Paysprint: BharatPays exposes no bill-fetch endpoint, so
 * a BBPS payment there could not show the customer a bill before debiting.
 */
const usesBharatPays = (type) => BHARATPAYS_TYPES.has(String(type || '').toLowerCase());

/**
 * Plans and DTH info both come from Paysprint's HLR API, which refuses in its
 * own operational wording: the add-on switched off, or its nightly maintenance
 * window. Neither tells a retailer anything useful. What they need to know is
 * that the lookup is down and the amount can still be typed by hand — a
 * recharge itself runs on BharatPays and is unaffected either way.
 */
export const hlrMessage = (raw, fallback) => {
  const text = String(raw || '');

  if (/hlr api service is disabled/i.test(text)) {
    return `${fallback} is unavailable right now. You can still enter the amount manually.`;
  }

  // "Service is down between 23:00 Hours to 05:30 Hours."
  const window = text.match(/service is down between\s*(.+?)\.?\s*$/i);
  if (window) {
    return `${fallback} is unavailable between ${window[1]}. You can still enter the amount manually.`;
  }

  return raw;
};

const isBBPS = (type) => !['prepaid', 'postpaid', 'dth', 'datacard'].includes(
  String(type || '').toLowerCase()
);

/**
 * BharatPays rejects any reference id that is not purely numeric — "The
 * Reference Id field must contain only numbers" — whatever its documentation
 * says about alphanumeric ids. pan.controller.js already carries the same
 * constraint for PSA. Paysprint keeps the readable PAY prefix it has always had,
 * so existing bill-payment records stay recognisable.
 *
 * Millisecond plus six random digits: transactionId is unique, so two recharges
 * landing in the same millisecond must not also draw the same suffix.
 */
export const makeReferenceId = (viaBharatPays) => {
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  return viaBharatPays ? `${Date.now()}${suffix}` : `PAY${Date.now()}${suffix}`;
};

export const getOperators = async (req, res) => {
  try {
    const { type } = req.params; // e.g. 'prepaid', 'dth', 'electricity'

    if (usesBharatPays(type)) {
      const category = BHARATPAYS_CATEGORY[type.toLowerCase()];
      const data = BHARATPAYS_OPERATORS.filter((op) => op.category === category).map((op) => ({
        id: op.id,
        name: op.name,
        displayname: op.name,
        category: op.category,
      }));
      return res.status(200).json({ success: true, data });
    }

    const basePath = isBBPS(type) ? '/service/bill-payment/bill' : '/service/recharge/recharge';
    const url = `${getPaysprintBase()}${basePath}/getoperator`;

    const payload = isBBPS(type) ? { mode: 'online' } : {};
    const response = await paysprintPost(url, payload);

    if (response.data && response.data.status) {
      const allOperators = response.data.data || [];

      // Map frontend type to Paysprint category
      const typeMap = {
        prepaid: 'Prepaid',
        postpaid: 'Postpaid',
        dth: 'DTH',
        electricity: 'Electricity',
        gas: 'GAS',
        lpg: 'LPG Gas',
        water: 'Water',
        broadband: 'Broadband',
        insurance: 'Insurance',
        loan: 'Loan Repayment',
        fastag: 'Fastag',
        cable: 'Cable TV',
      };

      const targetCategory = (typeMap[type.toLowerCase()] || 'Prepaid').toLowerCase();

      const filteredOps = allOperators.filter(
        (op) => op.category && op.category.toLowerCase() === targetCategory
      );

      const formattedData = filteredOps.map((op) => ({
        id: op.id,
        name: op.name,
        category: op.category,
        viewbill: op.viewbill,
        displayname: op.displayname,
        ad1_name: op.ad1_name || op.ad1_d_name,
        ad2_name: op.ad2_name || op.ad2_d_name,
        ad3_name: op.ad3_name || op.ad3_d_name,
      }));

      return res.status(200).json({ success: true, data: formattedData });
    } else {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to fetch operators from Paysprint' });
    }
  } catch (error) {
    console.error('Fetch Operators Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch operators' });
  }
};

export const browsePlans = async (req, res) => {
  try {
    const { mobileNumber, operator, circle = 'Delhi NCR' } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    // BharatPays has no plan API, so plans still come from Paysprint. The UI now
    // sends a BharatPays operator code, which has to be named back to Paysprint's.
    const opName = paysprintPlanOperator(operator);
    if (!opName) {
      return res
        .status(400)
        .json({ success: false, message: 'Plans are not available for this operator' });
    }

    const planUrl = `${getPaysprintBase()}/service/recharge/hlrapi/browseplan`;
    const payload = {
      circle: circle === 1 ? 'Delhi NCR' : circle, // fallback for legacy circle=1
      op: opName,
    };

    const planResponse = await paysprintPost(planUrl, payload);

    if (planResponse.data && planResponse.data.status && planResponse.data.info) {
      const info = planResponse.data.info;
      const groupedPlans = {};

      // info contains categories like "TOPUP", "3G/4G", "Romaing", etc.
      for (const [category, plans] of Object.entries(info)) {
        if (Array.isArray(plans)) {
          groupedPlans[category] = plans.map((p) => ({
            rs: p.rs,
            desc: p.desc,
            validity: p.validity,
          }));
        }
      }

      return res.status(200).json({ success: true, data: groupedPlans });
    } else {
      const raw = planResponse.data?.message;
      console.error('Browse Plans rejected by Paysprint:', raw);
      return res.status(400).json({
        success: false,
        message: hlrMessage(raw, 'The plan list') || 'No plans found',
        data: null,
      });
    }
  } catch (error) {
    console.error('Browse Plans Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to browse plans' });
  }
};

export const fetchDthInfo = async (req, res) => {
  try {
    const { dthNumber, operator } = req.body;
    if (!dthNumber || !operator) {
      return res
        .status(400)
        .json({ success: false, message: 'DTH number and operator are required' });
    }

    // Same as plans: BharatPays has no DTH-info endpoint, so this stays Paysprint.
    const opName = paysprintPlanOperator(operator);
    if (!opName) {
      return res
        .status(400)
        .json({ success: false, message: 'Customer info is not available for this operator' });
    }

    const url = `${getPaysprintBase()}/service/recharge/hlrapi/dthinfo`;

    const payload = {
      RAW_BODY: JSON.stringify({ op: opName, canumber: dthNumber }),
    };

    const response = await paysprintPost(url, payload);

    if (
      response.data &&
      response.data.status &&
      response.data.info &&
      response.data.info.length > 0
    ) {
      const info = response.data.info[0];
      const mappedInfo = {
        customerName: info.customerName,
        status: info.status,
        balance: info.Balance,
        nextRechargeDate: info.NextRechargeDate,
        monthlyRecharge: info.MonthlyRecharge,
        planName: info.planname,
      };
      return res.status(200).json({ success: true, data: mappedInfo });
    } else {
      const raw = response.data?.message;
      console.error('DTH info rejected by Paysprint:', raw);
      return res.status(400).json({
        success: false,
        message: hlrMessage(raw, 'Customer details') || 'DTH info not found',
      });
    }
  } catch (error) {
    console.error('DTH Info Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch DTH info' });
  }
};

export const fetchBill = async (req, res) => {
  try {
    const { caNumber, operator, type, ad1, ad2, ad3 } = req.body;
    if (!caNumber || !operator) {
      return res
        .status(400)
        .json({ success: false, message: 'CA number (Consumer Number) and operator are required' });
    }

    // These categories are paid through BharatPays, whose operator codes mean
    // nothing to Paysprint's biller registry. Asking Paysprint to fetch a bill
    // for BharatPays code 172 would look up an unrelated biller, so refuse
    // rather than show the retailer someone else's bill.
    if (usesBharatPays(type)) {
      return res.status(400).json({
        success: false,
        message: 'This service is a top-up — there is no bill to fetch. Enter the amount directly.',
      });
    }

    const url = `${getPaysprintBase()}/service/bill-payment/bill/fetchbill`;

    const payload = {
      operator: Number(operator),
      canumber: caNumber,
    };
    if (ad1) payload.ad1 = ad1;
    if (ad2) payload.ad2 = ad2;
    if (ad3) payload.ad3 = ad3;

    const response = await paysprintPost(url, payload);

    if (response.data && response.data.status) {
      return res.status(200).json({
        success: true,
        data: response.data.data,
        message: 'Bill fetched successfully',
      });
    } else {
      return res.status(400).json({
        success: false,
        message:
          response.data?.message || 'Failed to fetch bill. Please verify the consumer number.',
      });
    }
  } catch (error) {
    console.error('Fetch Bill Error:', error?.response?.data || error?.message);
    return res
      .status(500)
      .json({ success: false, message: 'An error occurred while fetching the bill.' });
  }
};

export const doRecharge = async (req, res) => {
  try {
    const { mobileNumber, dthNumber, number, operator, amount, pin, type, ad1, ad2, ad3 } =
      req.body;

    // The wallet to debit comes from the access token, never from the body:
    // a caller must not be able to spend someone else's balance.
    const userId = req.user.id;

    const caNumber = mobileNumber || dthNumber || number;
    const totalAmount = Number(amount);

    if (!caNumber || !operator || !totalAmount) {
      return res
        .status(400)
        .json({ success: false, message: 'Number, operator and amount are required.' });
    }

    // The id has to suit whichever provider will receive it, so it cannot be
    // built before the rail is known.
    const viaBharatPays = usesBharatPays(type);

    // BharatPays decides who gets paid from the operator code alone, and accepts
    // codes from every category on the same endpoint. A client holding a stale
    // operator list would not fail here, it would pay the wrong biller, so
    // refuse a code this service does not offer before any money moves.
    if (viaBharatPays && !isOperatorForType(operator, type)) {
      console.error(`Rejected operator ${operator} for type ${type}: not in this category.`);
      return res.status(400).json({
        success: false,
        message: 'That operator is not available for this service. Pull to refresh the operator list and try again.',
      });
    }
    const referenceId = makeReferenceId(viaBharatPays);
    if (viaBharatPays && totalAmount < 10) {
      return res
        .status(400)
        .json({ success: false, message: 'Minimum recharge amount is ₹10.' });
    }

    // Verify PIN
    if (!pin) {
      return res.status(400).json({ success: false, message: 'Transaction PIN is required.' });
    }
    const aepsWallet = await AepsWallet.findOne({ userId });
    if (!aepsWallet || !aepsWallet.pin) {
      return res.status(400).json({ success: false, message: 'Please set your wallet PIN first.' });
    }
    const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
    if (!isPinValid) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN' });
    }

    // Lock the funds as PROCESSING. A recharge can come back PENDING, and a
    // PENDING recharge must neither be refunded nor marked successful yet, so
    // the money stays held until the provider gives a final answer.
    try {
      await lockFundsForTransaction(userId, 'MAIN', -totalAmount, {
        transactionId: referenceId,
        userId,
        type: 'RECHARGE',
        amount: totalAmount,
        metadata: {
          caNumber,
          operator,
          mode: type,
          provider: viaBharatPays ? 'BHARATPAYS' : 'PAYSPRINT',
        },
      });
    } catch (walletError) {
      return res.status(400).json({
        success: false,
        message: walletError.message || 'Insufficient balance for recharge.',
      });
    }

    let providerResponse;
    let status;

    if (viaBharatPays) {
      providerResponse = await bharatPaysGet('/api/recharge_get', {
        opr_code: Number(operator),
        mobile: caNumber,
        amount: Math.round(totalAmount),
        reference_id: referenceId,
      });

      status =
        Number(providerResponse?.success) === 1
          ? normaliseStatus(providerResponse?.data?.status)
          : 'FAILED';

      // The order id is what status checks and the callback key off, so it has
      // to be persisted before the transaction is resolved either way.
      await Transaction.findOneAndUpdate(
        { transactionId: referenceId },
        {
          $set: {
            'metadata.orderId': providerResponse?.data?.order_id || null,
            'metadata.operatorTxnId': providerResponse?.data?.opr_txn_id || null,
            'metadata.apiResponse': providerResponse,
          },
        }
      );
    } else {
      // Data cards are still a plain recharge, not a bill payment, so the
      // endpoint is chosen the same way it always was.
      const bill = isBBPS(type);
      const payload = {
        operator: Number(operator),
        canumber: caNumber,
        amount: totalAmount,
        referenceid: referenceId,
      };
      if (bill) {
        payload.latitude = '27.2046';
        payload.longitude = '77.4977';
        payload.mode = 'online';
      }
      if (ad1) payload.ad1 = ad1;
      if (ad2) payload.ad2 = ad2;
      if (ad3) payload.ad3 = ad3;

      const url = bill
        ? `${getPaysprintBase()}/service/bill-payment/bill/paybill`
        : `${getPaysprintBase()}/service/recharge/recharge/dorecharge`;
      const response = await paysprintPost(url, payload);
      providerResponse = response.data;
      status = providerResponse?.status ? 'SUCCESS' : 'FAILED';

      await Transaction.findOneAndUpdate(
        { transactionId: referenceId },
        { $set: { 'metadata.apiResponse': providerResponse } }
      );
    }

    // BharatPays wraps validation failures in HTML; nothing downstream should
    // have to know that, least of all the retailer reading the toast.
    const message = cleanProviderMessage(providerResponse?.message);

    if (status === 'PENDING') {
      // Left PROCESSING on purpose: the callback or the reconciliation cron
      // settles it once BharatPays knows the outcome.
      return res.status(200).json({
        success: true,
        pending: true,
        message: message || 'Recharge submitted and is being processed.',
        data: { ...providerResponse?.data, transactionId: referenceId },
      });
    }

    // resolveTransaction refunds the locked funds when the status is FAILED, and
    // is a no-op if this transaction was already settled by the callback.
    await resolveTransaction(referenceId, status, message, 'MAIN');

    if (status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        message: message || 'Recharge successful',
        data: { ...providerResponse?.data, transactionId: referenceId },
      });
    }

    return res.status(400).json({
      success: false,
      message: message || 'Recharge failed',
      data: providerResponse,
    });
  } catch (error) {
    console.error('Do Recharge Error:', error?.response?.data || error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Recharge error occurred',
      error: error.message || String(error),
    });
  }
};

export const checkStatus = async (req, res) => {
  try {
    // Scoped to the caller: a retailer must not be able to read someone else's
    // transaction by guessing a reference id.
    const txn = await Transaction.findOne({
      transactionId: req.params.transid,
      userId: req.user.id,
    });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const orderId = txn.metadata?.orderId;
    if (!orderId) {
      return res.status(200).json({ success: true, data: { status: txn.status } });
    }

    const { finalStatus, data } = await fetchBharatPaysStatus(orderId);
    if (finalStatus !== 'PROCESSING') {
      await resolveTransaction(txn.transactionId, finalStatus, data?.message || '', 'MAIN');
    }

    return res.status(200).json({
      success: true,
      data: { ...(data?.data || {}), status: finalStatus === 'PROCESSING' ? 'PENDING' : finalStatus },
    });
  } catch (error) {
    console.error('Check Status Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to check status' });
  }
};

/**
 * BharatPays callback. Fires only when a recharge settles as SUCCESS or FAILED.
 * Unauthenticated by design (the provider posts it), so the shared secret in the
 * Authorization header is the only thing standing between a stranger and the
 * ability to mark recharges settled — reject anything that does not match.
 */
export const bharatPaysCallback = async (req, res) => {
  try {
    const expected = process.env.BHARATPAYS_TOKEN;
    const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!expected || supplied !== expected) {
      return res.status(401).json({ success: false, message: 'Unauthorized callback' });
    }

    const referenceId = req.body?.data?.reference_id;
    if (!referenceId) {
      return res.status(400).json({ success: false, message: 'reference_id missing' });
    }

    const status = normaliseStatus(req.body?.data?.status);
    if (status === 'PENDING') {
      // Nothing to settle yet; acknowledge so the provider stops retrying.
      return res.status(200).json({ success: true, message: 'Acknowledged' });
    }

    await Transaction.findOneAndUpdate(
      { transactionId: referenceId },
      {
        $set: {
          'metadata.operatorTxnId': req.body?.data?.opr_txn_id || null,
          'metadata.callback': req.body,
        },
      }
    );

    // No-op when the recharge was already settled by the API response or the cron.
    await resolveTransaction(referenceId, status, req.body?.message || '', 'MAIN');

    return res.status(200).json({ success: true, message: 'Acknowledged' });
  } catch (error) {
    console.error('BharatPays Callback Error:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Callback handling failed' });
  }
};

export const getHistory = async (req, res) => {
  try {
    // Scoped to the caller: this used to return every user's transactions.
    const history = await Transaction.find({ userId: req.user.id, type: 'RECHARGE' })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Get History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};

export const checkBalance = async (req, res) => {
  try {
    const data = await bharatPaysGet('/api/balance_get');
    if (Number(data?.success) !== 1) {
      return res
        .status(502)
        .json({ success: false, message: data?.message || 'Failed to fetch provider balance' });
    }
    return res.status(200).json({
      success: true,
      balance: data.data?.wallet_balance ?? 'NA',
      data: data.data,
      message: 'BharatPays wallet balance',
    });
  } catch (error) {
    console.error('Check Balance Error:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to check balance' });
  }
};
