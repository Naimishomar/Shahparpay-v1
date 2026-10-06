import mongoose from 'mongoose';
import axios from 'axios';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import Admin from '../models/users/admin.model.js';
import Retailer from '../models/users/retailer.model.js';
import Transaction from '../models/transaction.model.js';
import { generatePaySprintToken, encryptPayload } from './paysprint.util.js';

/**
 * Rounds a number to 2 decimal places to prevent float precision issues.
 */
const formatAmount = (amount) => {
  return Math.round(Number(amount) * 100) / 100;
};

/*
 * Commission rate card — "Proposal all service Final 6-10-2026".
 *
 * Every service pays three parties:
 *   merchant (retailer)   — the MARCHENT column
 *   partner (distributor) — the PARTNER column, paid to the retailer's distributor
 *   admin                 — whatever is left of the provider's API commission
 * Every commission is credited net of 2% TDS (AEPS_COMMISSION_TDS_RATE).
 */

/**
 * AEPS cash-withdrawal retailer commission.
 *   below ₹300     → ₹0
 *   ₹300–₹2,999    → 0.30%
 *   ₹3,000–₹10,000 → flat ₹12
 */
export const getAepsWithdrawalCommission = (amount) => {
  const amt = Number(amount) || 0;
  if (amt < 300) return 0;
  if (amt < 3000) return formatAmount(amt * 0.003);
  return 12;
};

/**
 * AEPS cash-deposit retailer commission.
 *   below ₹500     → ₹0
 *   ₹500–₹2,999    → flat ₹2
 *   ₹3,000–₹10,000 → flat ₹5
 */
export const getAepsDepositCommission = (amount) => {
  const amt = Number(amount) || 0;
  if (amt < 500) return 0;
  if (amt < 3000) return 2;
  return 5;
};

/**
 * Micro ATM cash-withdrawal retailer commission.
 *   below ₹500     → ₹0
 *   ₹500–₹2,999    → 0.30%
 *   ₹3,000–₹10,000 → flat ₹11
 */
export const getMatmCommission = (amount) => {
  const amt = Number(amount) || 0;
  if (amt < 500) return 0;
  if (amt < 3000) return formatAmount(amt * 0.003);
  return 11;
};

/**
 * Icchhamati recharge commissions are credited to the retailer's MainWallet
 * after a successful recharge. The recharge amount itself remains unchanged:
 * the customer pays the exact amount entered by the retailer.
 *
 * Operator values can be provider codes or display names, depending on which
 * client created the transaction, so both forms are supported here.
 */
const normaliseRechargeOperator = (operator) =>
  String(operator || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const getRechargeCommissionRate = (operator, mode) => {
  const value = normaliseRechargeOperator(operator);
  const type = String(mode || '')
    .trim()
    .toLowerCase();
  // The provider's operator list uses full names ("BSNL TOPUP", "Reliance
  // Jio"), so a brand is matched anywhere in the label, not only as the whole
  // label. A bare provider code ("2") carries no brand and earns nothing until
  // the operator name is resolved.
  const has = (...brands) =>
    brands.some((brand) => value.includes(normaliseRechargeOperator(brand)));

  if (type === 'dth') {
    if (has('airtel')) return 3;
    if (has('videocon', 'd2h')) return 3;
    if (has('dish')) return 3;
    if (has('tatasky', 'tataplay', 'tata')) return 2;
    if (has('sundirect', 'sun')) return 3;
    return 0;
  }

  if (has('airtel')) return 1;
  if (has('jio')) return 0.5;
  if (has('vodafone', 'idea', 'vi')) return 2;
  if (has('bsnl')) return 3;
  // Not on the rate card; keeps its previous rate.
  if (has('mtnl')) return 4;
  return 0;
};

export const getRechargeCommission = (amount, operator, mode) => {
  const rate = getRechargeCommissionRate(operator, mode);
  return formatAmount((Number(amount) || 0) * (rate / 100));
};

const normaliseService = (service) =>
  String(service || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Icchhamati BBPS commissions. Flat commissions are returned in rupees;
 * percentage commissions are calculated from the bill amount.
 */
export const getBbpsCommissionRule = (service) => {
  const value = normaliseService(service);
  if (value.includes('electric')) return { kind: 'flat', value: 1 };
  if (value.includes('water')) return { kind: 'flat', value: 2 };
  // Gas and "other" billers are not on the rate card; they keep their previous rate.
  if (value.includes('gas') || value.includes('lpg')) return { kind: 'flat', value: 1.8 };
  // Credit-card bills earn nothing; the retailer pays getBbpsCharge instead.
  if (value.includes('creditcard')) return { kind: 'flat', value: 0 };
  if (value.includes('loan') || value.includes('emi')) return { kind: 'flat', value: 2 };
  if (value.includes('insurance')) return { kind: 'flat', value: 2 };
  if (value.includes('fastag')) return { kind: 'percent', value: 0.05 };
  return { kind: 'percent', value: 1 };
};

export const getBbpsCommission = (amount, service) => {
  const rule = getBbpsCommissionRule(service);
  const numericAmount = Number(amount) || 0;
  return formatAmount(rule.kind === 'flat' ? rule.value : numericAmount * (rule.value / 100));
};

/** Charge debited from the retailer on top of the bill amount. */
export const getBbpsCharge = (service) =>
  normaliseService(service).includes('creditcard') ? 10 : 0;

/**
 * DMT charge debited from the retailer on top of the transfer, plus 18% GST.
 * ponytail: the card stops at ₹5,000; larger transfers pay the top slab.
 */
export const getDmtCharge = (amount) => {
  const amt = Number(amount) || 0;
  const fee = amt <= 1000 ? 5 : amt <= 2000 ? 6 : amt <= 3000 ? 7 : amt <= 4000 ? 8 : 8.5;
  const gst = formatAmount(fee * 0.18);
  return { fee, gst, total: formatAmount(fee + gst) };
};

/** PAN card (per application / coupon): retailer pays ₹107, the API costs ₹95. */
export const PAN_RATES = { fee: 107, apiCost: 95, retailer: 5, distributor: 1 };

/**
 * Lead generation, paid once per approved lead. `pool` is what the lender pays.
 * SA pays the zero-balance account rate and CC the credit-card rate; the lead
 * carries no bank or card variant to pick the Kotak811 / Bajaj EMI rows.
 * ponytail: PL/BL pay 0.70% (partner 0.10%) of the disbursed amount, which the lead callback
 * does not carry; add them once PaySprint sends it.
 */
export const LEAD_RATES = {
  SA: { retailer: 100, distributor: 10, pool: 150 },
  CC: { retailer: 500, distributor: 20, pool: 1200 },
  IL: { retailer: 100, distributor: 20, pool: 350 },
};

/**
 * Distributor (partner) commission, gross, for one successful transaction.
 * `service` is the BBPS category for bills.
 */
export const getDistributorCommission = (type, amount, service) => {
  const amt = Number(amount) || 0;
  switch (type) {
    case 'AEPS_WITHDRAWAL':
      if (amt < 300) return 0;
      return amt < 3000 ? formatAmount(amt * 0.001) : 0.5;
    case 'MATM':
      if (amt < 500) return 0;
      return amt < 3000 ? formatAmount(amt * 0.001) : 0.5;
    case 'AEPS_DEPOSIT':
      if (amt < 500) return 0;
      return amt < 3000 ? 0.25 : 0.5;
    case 'RECHARGE':
      return 0.2;
    case 'BILL_PAYMENT': {
      const value = normaliseService(service);
      return ['electric', 'water', 'loan', 'emi', 'insurance'].some((s) => value.includes(s))
        ? 0.25
        : 0;
    }
    case 'DMT':
      return 0.25;
    case 'PAN_SERVICE':
    case 'PAN_COUPON':
      return PAN_RATES.distributor;
    case 'ITR':
      return 25;
    default:
      return 0;
  }
};

/**
 * What the provider pays the platform on AEPS / Micro ATM. The admin keeps
 * this minus the retailer's and distributor's share.
 */
export const getApiCommission = (type, amount) => {
  const amt = Number(amount) || 0;
  if (type === 'AEPS_WITHDRAWAL' || type === 'MATM') {
    return amt < 3000 ? formatAmount(amt * 0.0045) : 13.5;
  }
  if (type === 'AEPS_DEPOSIT') return amt < 3000 ? formatAmount(amt * 0.0042) : 12.75;
  return 0;
};

export const commissionTdsRate = () => Number(process.env.AEPS_COMMISSION_TDS_RATE || 2) / 100;
const tdsOn = (gross) => formatAmount(gross * commissionTdsRate());

/**
 * Credits the three commission shares and returns the `commissions` fields
 * to store on the transaction.
 *
 *   retailerGross    → retailer's wallet (net of TDS)
 *   distributorGross → the retailer's distributor (net of TDS); skipped when
 *                      the retailer has none, and then kept by the admin
 *   pool             → what the platform earned; the admin is credited
 *                      pool - retailerGross - distributorGross paid
 *
 * `session` is optional so callers outside a Mongo transaction can use it.
 */
export const settleCommissions = async ({
  session = null,
  retailerId,
  retailerGross = 0,
  distributorGross = 0,
  pool = 0,
  retailerWallet = MainWallet,
  distributorWallet = MainWallet,
}) => {
  const opts = { upsert: true, session };
  const retailerTds = tdsOn(retailerGross);
  const retailerNet = formatAmount(retailerGross - retailerTds);
  if (retailerNet > 0) {
    await retailerWallet.findOneAndUpdate(
      { userId: retailerId, userModel: 'Retailer' },
      { $inc: { balance: retailerNet } },
      opts
    );
  }

  let distributorPaid = 0;
  let distributorTds = 0;
  let distributorNet = 0;
  if (distributorGross > 0) {
    const retailer = await Retailer.findById(retailerId, 'distributorId', { session });
    if (retailer?.distributorId) {
      distributorPaid = distributorGross;
      distributorTds = tdsOn(distributorGross);
      distributorNet = formatAmount(distributorGross - distributorTds);
      await distributorWallet.findOneAndUpdate(
        { userId: retailer.distributorId, userModel: 'Distributor' },
        { $inc: { balance: distributorNet } },
        opts
      );
    }
  }

  const adminEarned = formatAmount(Math.max(0, pool - retailerGross - distributorPaid));
  if (adminEarned > 0) {
    const admin = await Admin.findOne({}, '_id', { session });
    if (admin) {
      await AdminWallet.findOneAndUpdate(
        { userId: admin._id },
        { $inc: { balance: adminEarned } },
        opts
      );
    }
  }

  return {
    // retailerEarned is GROSS; the wallet got retailerEarned - retailerTds.
    retailerEarned: retailerGross,
    retailerTds,
    // distributorEarned is what the distributor's wallet actually received.
    distributorEarned: distributorNet,
    distributorTds,
    adminEarned,
  };
};

/** Writes a settleCommissions result onto a transaction, keeping chargeDeducted. */
export const setCommissions = (txn, split) => {
  for (const [key, value] of Object.entries(split)) txn.set(`commissions.${key}`, value);
};

/**
 * What the retailer actually earned on a transaction.
 *
 * `commissions.retailerEarned` is the GROSS commission; the wallet is credited
 * net of 2% TDS (applyAepsWithdrawalSuccess). Showing the gross figure as
 * earnings overstates every AEPS withdrawal by that 2%, so anything that
 * reports earnings has to net it off — the same rule the wallet ledger applies.
 *
 * The stored TDS is preferred over recomputing it: the rate is configurable
 * (AEPS_COMMISSION_TDS_RATE), so a row booked at a different rate must report
 * what was actually deducted. Rows from before that field existed fall back to
 * 2%, except cash deposits, which carried no TDS back then.
 */
export const retailerNetCommission = (txn) => {
  const gross = Number(txn?.commissions?.retailerEarned) || 0;
  if (!gross) return 0;
  const stored = txn?.commissions?.retailerTds;
  const fallback = txn?.type === 'AEPS_DEPOSIT' ? 0 : gross * 0.02;
  const tds = stored === undefined || stored === null ? fallback : Number(stored) || 0;
  return formatAmount(gross - tds);
};

/**
 * PHASE 1: PRE-FLIGHT LOCK
 * Atomically deducts funds and creates a PROCESSING transaction.
 * Safe from double-spend since it checks balance atomically.
 */
export const lockFundsForTransaction = async (userId, walletType, amount, transactionDetails) => {
  const formattedAmount = formatAmount(amount); // Typically a negative number (e.g. -103)

  // Check if deduction is valid
  let condition = { userId };
  if (formattedAmount < 0) {
    condition.balance = { $gte: Math.abs(formattedAmount) };
  }

  const WalletModel = walletType === 'MAIN' ? MainWallet : AepsWallet;

  try {
    // 1. Atomically deduct the balance
    const updatedWallet = await WalletModel.findOneAndUpdate(
      condition,
      { $inc: { balance: formattedAmount } },
      { returnDocument: 'after' } // No upsert on deduction
    );

    if (!updatedWallet) {
      throw new Error(`Insufficient funds or wallet not found for ${walletType} wallet.`);
    }

    // 2. Create the Transaction Log as PROCESSING
    let transactionLogs;
    try {
      transactionLogs = await Transaction.create([
        {
          ...transactionDetails,
          status: 'PROCESSING',
          metadata: { ...transactionDetails.metadata, walletType },
        },
      ]);
    } catch (transactionError) {
      // Never leave wallet funds deducted when the audit row cannot be created.
      await WalletModel.findOneAndUpdate({ userId }, { $inc: { balance: -formattedAmount } });
      throw transactionError;
    }

    return transactionLogs[0];
  } catch (error) {
    throw error;
  }
};

/**
 * PHASE 2: RESOLVE
 * Resolves a PROCESSING transaction based on the API response.
 * If failed, it securely refunds the locked funds.
 */
export const resolveTransaction = async (
  transactionId,
  finalStatus,
  apiMessage,
  walletType = 'MAIN'
) => {
  try {
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) throw new Error('Transaction not found for resolution.');

    // Prevent double-resolving
    if (txn.status !== 'PROCESSING') {
      return txn; // Already resolved
    }

    const resolvedWalletType = txn.metadata?.walletType || walletType;

    if (finalStatus === 'SUCCESS') {
      // Commission must be settled atomically with the one-way
      // PROCESSING -> SUCCESS transition. This makes the immediate response
      // path and the reconciliation worker safe to run concurrently.
      if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT' || txn.type === 'DMT') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const claimed = await Transaction.findOneAndUpdate(
            { transactionId, status: 'PROCESSING' },
            { $set: { status: 'SUCCESS' } },
            { session, new: true }
          );
          if (!claimed) {
            await session.commitTransaction();
            session.endSession();
            return Transaction.findOne({ transactionId });
          }

          // `amount` is everything that left the wallet; a DMT or credit-card
          // bill charge rides on top of the principal the commission is paid on.
          const charge = Number(claimed.commissions?.chargeDeducted) || 0;
          const principal = formatAmount(claimed.amount - charge);
          const mode = claimed.metadata?.mode;
          const isRecharge = claimed.type === 'RECHARGE';
          // The commission slab is keyed on the operator brand, and
          // `metadata.operator` holds the provider's own code ("2"), which
          // names no brand. The resolved operator name is what the slab reads.
          const operatorLabel = claimed.metadata?.operatorName || claimed.metadata?.operator;
          let retailerGross = 0;
          let rateMeta = {};
          if (isRecharge) {
            const rate = getRechargeCommissionRate(operatorLabel, mode);
            retailerGross = getRechargeCommission(principal, operatorLabel, mode);
            rateMeta = { rechargeCommissionRate: rate };
          } else if (claimed.type === 'BILL_PAYMENT') {
            retailerGross = getBbpsCommission(principal, mode);
            rateMeta = { bbpsCommissionRule: getBbpsCommissionRule(mode) };
          }
          // An unrecognised operator earns the retailer nothing; the partner
          // share follows it rather than being paid on a recharge with no rate.
          const distributorGross =
            isRecharge && retailerGross <= 0
              ? 0
              : getDistributorCommission(claimed.type, principal, mode);

          const split = await settleCommissions({
            session,
            retailerId: claimed.userId,
            retailerGross,
            distributorGross,
            // The DMT fee (excluding GST, which is owed to the government) is
            // the platform's; recharge/BBPS API margins are not on the card.
            pool: claimed.type === 'DMT' ? Number(claimed.metadata?.dmtFee) || 0 : 0,
          });

          setCommissions(claimed, split);
          claimed.metadata = { ...claimed.metadata, apiMessage, ...rateMeta };
          await claimed.save({ session });
          await session.commitTransaction();
          session.endSession();
          return claimed;
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
          throw error;
        }
      }

      // Non-recharge transactions retain the existing resolution behavior.
      txn.status = 'SUCCESS';
      txn.metadata = { ...txn.metadata, apiMessage };
      await txn.save();
      return txn;
    } else if (finalStatus === 'FAILED') {
      // Must refund the deducted amount
      const refundAmount = Math.abs(txn.amount); // Always positive

      const WalletModel = resolvedWalletType === 'MAIN' ? MainWallet : AepsWallet;
      await WalletModel.findOneAndUpdate(
        { userId: txn.userId },
        { $inc: { balance: refundAmount } }
      );

      // Update transaction to FAILED (or REFUNDED)
      txn.status = 'FAILED';
      txn.metadata = { ...txn.metadata, apiMessage, refundStatus: 'COMPLETED' };
      await txn.save();
      return txn;
    }
  } catch (error) {
    console.error('Error resolving transaction:', error);
    throw error;
  }
};

/**
 * Legacy update function (used for non-API dependent instant transactions)
 */
export const updateWalletAtomically = async (userId, walletType, amount, transactionDetails) => {
  const formattedAmount = formatAmount(amount);

  let condition = { userId };
  if (formattedAmount < 0) {
    condition.balance = { $gte: Math.abs(formattedAmount) };
  }

  const WalletModel = walletType === 'MAIN' ? MainWallet : AepsWallet;

  try {
    const updatedWallet = await WalletModel.findOneAndUpdate(
      condition,
      { $inc: { balance: formattedAmount } },
      { returnDocument: 'after', upsert: formattedAmount >= 0, setDefaultsOnInsert: true }
    );

    if (!updatedWallet) {
      throw new Error(`Insufficient funds or wallet not found for ${walletType} wallet.`);
    }

    let transactionLogs;
    try {
      transactionLogs = await Transaction.create([
        { ...transactionDetails, metadata: { ...transactionDetails.metadata, walletType } },
      ]);
    } catch (transactionError) {
      await WalletModel.findOneAndUpdate({ userId }, { $inc: { balance: -formattedAmount } });
      throw transactionError;
    }
    return transactionLogs[0];
  } catch (error) {
    throw error;
  }
};

/**
 * Atomically transfers funds between two wallets
 */
export const transferBetweenWallets = async (
  userId,
  fromWalletType,
  toWalletType,
  amount,
  transactionDetails
) => {
  const formattedAmount = formatAmount(Math.abs(amount));

  const walletModels = { MAIN: MainWallet, AEPS: AepsWallet };
  const FromWalletModel = walletModels[fromWalletType];
  const ToWalletModel = walletModels[toWalletType];
  if (!FromWalletModel || !ToWalletModel) {
    throw new Error(`Unsupported wallet transfer: ${fromWalletType} -> ${toWalletType}`);
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deductedWallet = await FromWalletModel.findOneAndUpdate(
      { userId, balance: { $gte: formattedAmount } },
      { $inc: { balance: -formattedAmount } },
      { returnDocument: 'after', session }
    );

    if (!deductedWallet) {
      throw new Error(`Insufficient funds in ${fromWalletType} wallet.`);
    }

    const creditedWallet = await ToWalletModel.findOneAndUpdate(
      { userId },
      { $inc: { balance: formattedAmount } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, session }
    );

    if (!creditedWallet) {
      throw new Error(`Destination ${toWalletType} wallet not found.`);
    }

    const transactionLogs = await Transaction.create([transactionDetails], { session });
    await session.commitTransaction();
    session.endSession();
    return transactionLogs[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Queries the PaySprint AEPS transaction-status endpoint and maps the response
 * to a normalized status: 'SUCCESS' | 'FAILED' | 'PROCESSING'.
 *
 * PaySprint txnstatus codes (per docs):
 *   1 = SUCCESS, 2 = IN PROCESS, 3 = FAILED (all with status=true)
 * response_code 0 = failed, 2 = in process. Any other code (auth/validation
 * errors) or an API error is ambiguous -> 'PROCESSING' so it is re-queried
 * later rather than finalized on an inconclusive answer.
 */
export const queryAepsTransactionStatus = async (reference) => {
  const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
  const token = generatePaySprintToken();
  const encryptedData = encryptPayload(JSON.stringify({ reference }));

  const headers = {
    Token: token,
    Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
    'Content-Type': 'application/json',
  };

  const response = await axios.post(
    `${baseUrl}/service/aeps/aepsquery/query`,
    { body: encryptedData },
    { headers, validateStatus: () => true }
  );

  const data = response.data || {};
  const txnstatus = String(data?.txnstatus ?? data?.data?.txnstatus ?? '').trim();
  const responseCode = String(data?.response_code ?? data?.data?.response_code ?? '').trim();
  const status = data?.status;

  if (txnstatus === '1' || responseCode === '1') return { status: 'SUCCESS', data };
  if (txnstatus === '3' || responseCode === '0') return { status: 'FAILED', data };
  if (txnstatus === '2' || responseCode === '2') return { status: 'PROCESSING', data };

  // Fallbacks when txnstatus is absent
  if (status === true) return { status: 'SUCCESS', data };
  if (status === false) return { status: 'FAILED', data };

  // Inconclusive (auth/validation errors, txn not found) — keep reconciling.
  return { status: 'PROCESSING', data };
};

/**
 * Queries the PaySprint NSDL Cash Deposit status endpoint and maps the response
 * to a normalized status: 'SUCCESS' | 'FAILED' | 'PROCESSING'.
 *
 * Per the PaySprint NSDL Cash Deposit Status Query docs this uses a DIFFERENT
 * endpoint and status mapping than the generic AEPS query:
 *   SUCCESS -> txnstatus 1 (and status true)
 *   FAILED  -> txnstatus 2 (and status true)
 */
export const queryAepsDepositStatus = async (reference) => {
  const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
  const token = generatePaySprintToken();
  const encryptedData = encryptPayload(JSON.stringify({ reference }));

  const headers = {
    Token: token,
    Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
    'Content-Type': 'application/json',
  };

  const response = await axios.post(
    `${baseUrl}/service/cashdeposit/V3/Cashdeposit/query`,
    { body: encryptedData },
    { headers, validateStatus: () => true }
  );

  const data = response.data || {};
  const txnstatus = String(data?.txnstatus ?? data?.data?.txnstatus ?? '').trim();

  if (txnstatus === '1') return { status: 'SUCCESS', data };
  if (txnstatus === '2') return { status: 'FAILED', data };

  if (data?.status === true && data?.response_code === 1) return { status: 'SUCCESS', data };
  if (data?.status === false && data?.response_code === 0) return { status: 'FAILED', data };

  return { status: 'PROCESSING', data };
};

/**
 * Atomically credits wallets and finalizes an AEPS withdrawal that the bank has
 * confirmed as successful. Idempotent: only a PENDING or PROCESSING transaction
 * may transition to SUCCESS, so concurrent reconciliation cannot double-credit.
 *
 * Returns the finalized Transaction, or null if the transaction was already
 * resolved (someone else credited it first).
 */
export const applyAepsWithdrawalSuccess = async ({
  transactionId,
  userId,
  amount,
  paysprintRef,
  message,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic claim — this is the idempotency guard.
    const claimed = await Transaction.findOneAndUpdate(
      { _id: transactionId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'SUCCESS' } },
      { session, new: true }
    );
    if (!claimed) {
      await session.commitTransaction();
      session.endSession();
      return null;
    }

    const numericAmount = Number(amount);

    // Principal back to the retailer's AEPS wallet; the commission split
    // (retailer net of TDS, distributor, admin) follows the rate card.
    await AepsWallet.findOneAndUpdate(
      { userId, userModel: 'Retailer' },
      { $inc: { balance: numericAmount } },
      { upsert: true, session }
    );
    const split = await settleCommissions({
      session,
      retailerId: userId,
      retailerGross: getAepsWithdrawalCommission(numericAmount),
      distributorGross: getDistributorCommission('AEPS_WITHDRAWAL', numericAmount),
      pool: getApiCommission('AEPS_WITHDRAWAL', numericAmount),
      retailerWallet: AepsWallet,
      distributorWallet: AepsWallet,
    });

    claimed.transactionId = paysprintRef || claimed.transactionId;
    setCommissions(claimed, split);
    if (paysprintRef) {
      claimed.metadata = { ...claimed.metadata, paysprintRef };
    }
    if (message) {
      claimed.metadata = { ...claimed.metadata, gatewayMessage: message };
    }
    await claimed.save({ session });

    await session.commitTransaction();
    session.endSession();
    return claimed;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Atomically credits the retailer's cash-deposit commission and finalizes an
 * AEPS deposit that the bank has confirmed as successful. Idempotent: only a
 * PENDING or PROCESSING transaction may transition to SUCCESS, so concurrent
 * reconciliation cannot double-credit.
 *
 * The deposit principal was debited from the Main wallet at lock time; only the
 * rate-card commission is credited here, net of TDS.
 *
 * Returns the finalized Transaction, or null if already resolved.
 */
export const applyAepsDepositSuccess = async ({
  transactionId,
  userId,
  amount,
  paysprintRef,
  message,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic claim — this is the idempotency guard.
    const claimed = await Transaction.findOneAndUpdate(
      { _id: transactionId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'SUCCESS' } },
      { session, new: true }
    );
    if (!claimed) {
      await session.commitTransaction();
      session.endSession();
      return null;
    }

    const numericAmount = Number(amount);
    // Deposit principal was debited from MAIN at lock time; only the
    // commission split is credited here.
    const split = await settleCommissions({
      session,
      retailerId: userId,
      retailerGross: getAepsDepositCommission(numericAmount),
      distributorGross: getDistributorCommission('AEPS_DEPOSIT', numericAmount),
      pool: getApiCommission('AEPS_DEPOSIT', numericAmount),
    });

    claimed.transactionId = paysprintRef || claimed.transactionId;
    setCommissions(claimed, split);
    if (paysprintRef) {
      claimed.metadata = { ...claimed.metadata, paysprintRef };
    }
    if (message) {
      claimed.metadata = { ...claimed.metadata, gatewayMessage: message };
    }
    await claimed.save({ session });

    await session.commitTransaction();
    session.endSession();
    return claimed;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
