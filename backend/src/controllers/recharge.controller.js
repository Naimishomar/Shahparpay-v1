import axios from 'axios';
import bcrypt from 'bcrypt';
import { generatePaySprintToken } from '../utils/paysprint.util.js';
import {
  icchhamatiGet,
  icchhamatiPost,
  isOk,
  normaliseStatus,
  providerMessage,
  fetchRechargeStatus,
  makeReferenceId,
  rechargeTypeCode,
  isBillType,
  OPERATOR_CATEGORY,
  BILLER_CATEGORY,
  dedupeBillCategories,
} from '../utils/icchhamati.util.js';
import { lockFundsForTransaction, resolveTransaction } from '../utils/wallet.util.js';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';

/**
 * Recharge and bill payment, both on Icchhamati.
 *
 * Prepaid and DTH are recharges (`type` 1 and 2) and go to /mobile-recharge.
 * Everything else — postpaid, electricity, gas, water, broadband, FASTag — is a
 * bill (`type` 3) and goes to /bill-payment, which is the only path that can
 * fetch a bill before the wallet is debited.
 */

/**
 * The operator list a category is drawn from.
 *
 * Prepaid, postpaid and DTH have their own operator registry. Every other
 * service is a BBPS biller and comes out of the biller registry instead, keyed
 * by the biller category name.
 */
const operatorSource = (type) => {
  const key = String(type || '').toLowerCase();
  if (OPERATOR_CATEGORY[key]) return { kind: 'operator', category: OPERATOR_CATEGORY[key] };
  const providerOperatorCategory = Object.values(OPERATOR_CATEGORY).find(
    (category) => String(category).toLowerCase() === key
  );
  if (providerOperatorCategory) return { kind: 'operator', category: providerOperatorCategory };
  // BILLER_CATEGORY only names the categories our own screens hardcode. Anything
  // else is passed through as-is, so a category taken straight off
  // /bill-categories works without this map having to know about it first.
  return { kind: 'biller', category: BILLER_CATEGORY[key] || String(type || '').trim() || null };
};

/**
 * Both registries into the one shape the recharge and BBPS screens already
 * read. `id` carries the provider's operator/biller code, which is what every
 * later call — fetch bill, pay — sends back to identify the biller.
 */
const toOperator = (row, type) => ({
  id: String(row.code ?? row.id ?? ''),
  name: row.name,
  displayname: row.name,
  category: row.category || null,
  icon: row.biller_icon || row.icon || null,
  // Whether there is a bill to fetch before paying, which is what the screens
  // use to decide whether to offer "Fetch Bill". It follows the service, not the
  // registry the row came from: postpaid mobile is listed with the operators but
  // is billed like any other utility.
  viewbill: isBillType(type) ? 'true' : 'false',
  // The biller's own label for the consumer identifier ("Consumer Number",
  // "CA Number", "Number"), so the field is named the way the biller names it.
  label: row.label || null,
});

export const getOperators = async (req, res) => {
  try {
    const { type } = req.params; // 'prepaid', 'dth', 'electricity', ...
    const { kind, category } = operatorSource(type);

    if (!category) {
      return res
        .status(400)
        .json({ success: false, message: `No operators are available for "${type}".` });
    }

    const data =
      kind === 'operator'
        ? await icchhamatiPost('/api/v2/getOperator', { category })
        : await icchhamatiPost('/api/v2/billers-by-category', { category });

    if (!isOk(data)) {
      return res.status(502).json({
        success: false,
        message: providerMessage(data, 'The operator list is unavailable right now.'),
      });
    }

    const rows = data.operators || data.billers || data.data || [];
    const seen = new Set();
    const uniqueRows = rows.filter((row) => {
      const key = String(row.code ?? row.id ?? row.name ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return res.status(200).json({
      success: true,
      data: uniqueRows.filter((row) => row.is_active !== false).map((row) => toOperator(row, type)),
    });
  } catch (error) {
    console.error('Fetch Operators Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch operators' });
  }
};

/**
 * Telecom circles. A prepaid recharge needs one; DTH and bills do not.
 */
export const getCircles = async (req, res) => {
  try {
    const data = await icchhamatiGet('/api/v2/getCircles');
    if (!isOk(data)) {
      return res.status(502).json({
        success: false,
        message: providerMessage(data, 'The circle list is unavailable right now.'),
      });
    }
    const circles = (data.circles || data.data || []).map((row) => ({
      id: String(row.code ?? row.id ?? ''),
      name: row.name,
    }));
    return res.status(200).json({ success: true, data: circles });
  } catch (error) {
    console.error('Fetch Circles Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch circles' });
  }
};

/**
 * BBPS bill categories, as the provider publishes them. The BBPS screen keeps
 * its own tile list, so this is here for a client that would rather render
 * whatever the provider currently offers than a hardcoded set.
 */
export const getBillCategories = async (req, res) => {
  try {
    const data = await icchhamatiGet('/api/v2/bill-categories');
    if (!isOk(data)) {
      return res.status(502).json({
        success: false,
        message: providerMessage(data, 'Bill categories are unavailable right now.'),
      });
    }
    return res.status(200).json({
      success: true,
      data: dedupeBillCategories(data.categories || data.data || []),
    });
  } catch (error) {
    console.error('Fetch Bill Categories Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch bill categories' });
  }
};

/**
 * Prepaid plans for a number. The provider derives the operator and circle from
 * the number itself, so nothing else is sent.
 *
 * Plans come back either as a flat array or as an object keyed by plan category
 * ("TOPUP", "3G/4G", ...). The screens render the grouped form, so a flat list
 * is put under one heading rather than handled as a second shape everywhere.
 */
export const browsePlans = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    const number = String(mobileNumber || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(number)) {
      return res.status(400).json({
        success: false,
        message: 'A valid 10-digit mobile number is required',
      });
    }

    const data = await icchhamatiPost('/api/v2/mobile-plan', { number });
    if (!isOk(data)) {
      return res.status(400).json({
        success: false,
        message: providerMessage(
          data,
          'The plan list is unavailable right now. You can still enter the amount manually.'
        ),
        data: null,
      });
    }

    const raw = data.data?.plan ?? data.plans ?? data.data ?? {};
    const normalise = (plan) => ({
      rs: plan.rs ?? plan.amount ?? plan.price ?? 0,
      desc: plan.desc ?? plan.description ?? plan.details ?? '',
      validity: plan.validity ?? 'NA',
      planstatus: plan.planstatus ?? plan.status ?? 'Active',
    });
    const isActivePlan = (plan) => {
      const status = String(plan.planstatus || '').trim().toLowerCase();
      return !['inactive', 'in-active', '0', 'false', 'disabled'].includes(status);
    };

    const grouped = Array.isArray(raw)
      ? { Plans: raw.map(normalise).filter(isActivePlan) }
      : Object.fromEntries(
          Object.entries(raw)
            .filter(([, plans]) => Array.isArray(plans))
            .map(([category, plans]) => [category, plans.map(normalise).filter(isActivePlan)])
        );

    const providerData = data.data || {};
    return res.status(200).json({
      success: true,
      data: grouped,
      meta: {
        operator: providerData.operator ?? null,
        operatorName: providerData.operatorname ?? providerData.operatorName ?? null,
        circle: providerData.circal ?? providerData.circle ?? null,
        circleName: providerData.circalname ?? providerData.circleName ?? null,
      },
    });
  } catch (error) {
    console.error('Browse Plans Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to browse plans' });
  }
};

/**
 * DTH customer details — subscriber name, balance, next recharge date.
 *
 * Icchhamati publishes no endpoint for this: neither their documentation nor
 * their own retailer portal has one, and their DTH screen simply asks for the
 * amount. Paysprint's HLR API does have it, and Paysprint is still a live
 * integration here (AEPS runs on it), so this one lookup stays there. It is a
 * read: no money moves, and nothing about the recharge itself depends on it.
 */
const PAYSPRINT_DTH_OPERATOR = {
  ATDTH: 'Airteldth',
  DISHTV: 'Dishtv',
  SUNDTH: 'Sundirect',
  TATASKY: 'TataSky',
  VDDTH: 'Videocon',
};

/**
 * Paysprint refuses an HLR lookup in its own operational wording, and whatever
 * it says reaches a retailer's screen verbatim. Both known refusals read like a
 * fault in our app rather than a provider being briefly unavailable, and
 * neither tells a retailer the one thing that helps: the amount can still be
 * typed by hand, because the recharge itself does not run on this API.
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

export const fetchDthInfo = async (req, res) => {
  try {
    const { dthNumber, operator } = req.body;
    if (!dthNumber || !operator) {
      return res
        .status(400)
        .json({ success: false, message: 'DTH number and operator are required' });
    }

    // The UI sends an Icchhamati operator code, which means nothing to
    // Paysprint. Asking with an unmapped code would look up an unrelated
    // subscriber, so refuse rather than show the retailer someone else's details.
    const opName = PAYSPRINT_DTH_OPERATOR[String(operator).toUpperCase()];
    if (!opName) {
      return res
        .status(400)
        .json({ success: false, message: 'Customer details are not available for this operator.' });
    }

    const baseUrl =
      process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';
    const response = await axios.post(
      `${baseUrl}/service/recharge/hlrapi/dthinfo`,
      { RAW_BODY: JSON.stringify({ op: opName, canumber: dthNumber }) },
      {
        headers: {
          Token: generatePaySprintToken(),
          Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
        timeout: 30000,
      }
    );

    const info = response.data?.info?.[0];
    if (!response.data?.status || !info) {
      return res.status(400).json({
        success: false,
        message: hlrMessage(response.data?.message, 'Customer details') || 'DTH info not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        customerName: info.customerName,
        status: info.status,
        balance: info.Balance,
        nextRechargeDate: info.NextRechargeDate,
        monthlyRecharge: info.MonthlyRecharge,
        planName: info.planname,
      },
    });
  } catch (error) {
    console.error('DTH Info Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch DTH info' });
  }
};

export const fetchBill = async (req, res) => {
  try {
    const { caNumber, operator, type } = req.body;
    if (!caNumber || !operator) {
      return res
        .status(400)
        .json({ success: false, message: 'CA number (Consumer Number) and operator are required' });
    }

    // A prepaid or DTH top-up has no bill behind it, and asking the biller
    // registry for one would look up an unrelated biller by the same code.
    if (!isBillType(type)) {
      return res.status(400).json({
        success: false,
        message: 'This service is a top-up — there is no bill to fetch. Enter the amount directly.',
      });
    }

    // The published field docs and the published example disagree on the names
    // (biller_code/customer_id versus billerId/customerKey). Both are sent;
    // whichever pair the gateway reads, it gets the same values.
    const data = await icchhamatiPost('/api/v2/fetch-bill', {
      biller_code: String(operator),
      customer_id: String(caNumber),
      billerId: String(operator),
      customerKey: String(caNumber),
    });

    if (!isOk(data)) {
      return res.status(400).json({
        success: false,
        message: providerMessage(
          data,
          'Failed to fetch bill. Please verify the consumer number.'
        ),
      });
    }

    const bill = data.billDetails || data.data || {};
    return res.status(200).json({
      success: true,
      data: {
        ...bill,
        amount: bill.amount ?? bill.billAmount ?? bill.due_amount ?? null,
        customerName: bill.customerName ?? bill.customer_name ?? null,
        dueDate: bill.dueDate ?? bill.due_date ?? null,
      },
      message: 'Bill fetched successfully',
    });
  } catch (error) {
    console.error('Fetch Bill Error:', error?.response?.data || error?.message);
    return res
      .status(500)
      .json({ success: false, message: 'An error occurred while fetching the bill.' });
  }
};

export const doRecharge = async (req, res) => {
  try {
    const { mobileNumber, dthNumber, number, operator, amount, pin, type, circle } = req.body;

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
    if (totalAmount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum recharge amount is ₹10.' });
    }

    const typeCode = rechargeTypeCode(type);
    const bill = isBillType(type);

    // A prepaid recharge is routed by circle as well as operator, so a missing
    // one would either be refused or routed to the wrong lane.
    if (typeCode === 1 && !circle) {
      return res
        .status(400)
        .json({ success: false, message: 'Please select the customer circle.' });
    }

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

    const referenceId = makeReferenceId('REC');

    // Lock the funds as PROCESSING. A recharge can come back pending, and a
    // pending recharge must neither be refunded nor marked successful yet, so
    // the money stays held until the provider gives a final answer.
    try {
      await lockFundsForTransaction(userId, 'MAIN', -totalAmount, {
        transactionId: referenceId,
        userId,
        type: bill ? 'BILL_PAYMENT' : 'RECHARGE',
        amount: totalAmount,
        metadata: {
          caNumber,
          operator,
          mode: type,
          provider: 'ICCHHAMATI',
        },
      });
    } catch (walletError) {
      return res.status(400).json({
        success: false,
        message: walletError.message || 'Insufficient balance for recharge.',
      });
    }

    // `circle` is the documented field name; the provider's own client sends it
    // as `circal`. Both are sent — one of them is the one the gateway reads.
    const payload = {
      number: String(caNumber),
      operator: String(operator),
      amount: Math.round(totalAmount),
      type: typeCode,
      transaction_id: referenceId,
      details: `${bill ? 'Bill payment' : 'Recharge'} for ${caNumber}`,
      ...(typeCode === 1 ? { circle: String(circle), circal: String(circle) } : {}),
    };

    let providerResponse;
    try {
      providerResponse = await icchhamatiPost(
        bill ? '/api/v2/bill-payment' : '/api/v2/mobile-recharge',
        payload
      );
    } catch (providerError) {
      // A timeout does not prove that the provider rejected the request. Keep
      // the debit locked and let reconciliation query the provider later.
      return res.status(202).json({
        success: true,
        pending: true,
        message: 'Transaction submitted; provider status is being confirmed.',
        data: { transactionId: referenceId, status: 'PENDING' },
      });
    }

    // The envelope status means the request was accepted. The nested status is
    // the actual recharge/bill outcome and may still be Pending.
    const status = normaliseStatus(providerResponse?.data?.status ?? providerResponse?.status);
    const message = providerMessage(
      providerResponse,
      status === 'FAILED' ? 'The provider could not complete this transaction.' : ''
    );

    await Transaction.findOneAndUpdate(
      { transactionId: referenceId },
      {
        $set: {
          'metadata.orderId': providerResponse?.data?.orderId || providerResponse?.data?.txnid || null,
          'metadata.operatorTxnId': providerResponse?.data?.txnId || null,
          'metadata.apiResponse': providerResponse,
        },
      }
    );

    if (status === 'PENDING') {
      // Left PROCESSING on purpose: the reconciliation cron settles it once the
      // provider knows the outcome.
      return res.status(200).json({
        success: true,
        pending: true,
        message: message || 'Recharge submitted and is being processed.',
        data: { ...providerResponse?.data, transactionId: referenceId },
      });
    }

    // resolveTransaction refunds the locked funds when the status is FAILED.
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
      data: providerResponse?.data || null,
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

    if (txn.status !== 'PROCESSING') {
      return res.status(200).json({ success: true, data: { status: txn.status } });
    }

    const providerTxnId = txn.metadata?.orderId || txn.metadata?.operatorTxnId || txn.transactionId;
    const { finalStatus, data } = await fetchRechargeStatus(providerTxnId, txn.metadata?.mode);
    if (finalStatus !== 'PROCESSING') {
      await resolveTransaction(txn.transactionId, finalStatus, providerMessage(data, ''), 'MAIN');
    }

    return res.status(200).json({
      success: true,
      data: {
        ...(data?.data || {}),
        status: finalStatus === 'PROCESSING' ? 'PENDING' : finalStatus,
      },
    });
  } catch (error) {
    console.error('Check Status Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to check status' });
  }
};

export const getHistory = async (req, res) => {
  try {
    // Scoped to the caller: this used to return every user's transactions.
    const history = await Transaction.find({
      userId: req.user.id,
      type: { $in: ['RECHARGE', 'BILL_PAYMENT'] },
    })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Get History Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};
