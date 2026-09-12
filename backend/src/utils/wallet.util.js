import mongoose from 'mongoose';
import axios from 'axios';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import Admin from '../models/users/admin.model.js';
import GlobalSettings from '../models/globalSettings.model.js';
import Retailer from '../models/users/retailer.model.js';
import Transaction from '../models/transaction.model.js';
import { generatePaySprintToken, encryptPayload } from './paysprint.util.js';

/**
 * Rounds a number to 2 decimal places to prevent float precision issues.
 */
const formatAmount = (amount) => {
  return Math.round(Number(amount) * 100) / 100;
};

/**
 * AEPS cash-withdrawal retailer commission (slab based).
 *   ₹300–₹3000    → 0.35% of the amount
 *   ₹3001–₹10000  → flat ₹12
 *   below ₹300    → ₹0 (no commission)
 * Amounts above ₹10000 are not supported (blocked at the controller).
 */
export const getAepsWithdrawalCommission = (amount) => {
  const amt = Number(amount) || 0;
  if (amt < 300) return 0;
  if (amt <= 3000) return Math.round(amt * 0.0035 * 100) / 100;
  if (amt <= 10000) return 12;
  return 12;
};

/**
 * AEPS cash-deposit retailer commission (slab based).
 *   ₹500–₹3000    → flat ₹2
 *   ₹3001–₹10000  → flat ₹5
 *   below ₹500    → ₹0 (no commission)
 * No TDS or GST is deducted from cash-deposit commission.
 */
export const getAepsDepositCommission = (amount) => {
  const amt = Number(amount) || 0;
  if (amt < 500) return 0;
  if (amt <= 3000) return 2;
  if (amt <= 10000) return 5;
  return 5;
};

/**
 * Icchhamati recharge commissions are credited in full to the retailer's
 * MainWallet after a successful recharge. The recharge amount itself remains
 * unchanged: the customer pays the exact amount entered by the retailer.
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
  const type = String(mode || '').trim().toLowerCase();

  if (type === 'dth') {
    if (['airtel', 'airtel dth', 'airtel-dth', 'ad', 'airtel dth'].some((v) => value === normaliseRechargeOperator(v))) return 3.5;
    if (['videocon', 'videocondth', 'd2h', 'vd', 'videocon dth'].some((v) => value === normaliseRechargeOperator(v))) return 3.4;
    if (['dish', 'dishtv', 'dish tv', 'dt'].some((v) => value === normaliseRechargeOperator(v))) return 3.5;
    if (['tata', 'tatasky', 'tata play', 'tatadth', 'ts'].some((v) => value === normaliseRechargeOperator(v))) return 2.7;
    if (['sun', 'sundirect', 'sun direct', 'sd'].some((v) => value === normaliseRechargeOperator(v))) return 2.85;
    return 0;
  }

  if (['airtel', 'at', 'airtelprepaid'].some((v) => value === normaliseRechargeOperator(v))) return 2.2;
  if (['jio', 'ji', 'rj', 'reliancejio', 'jio prepaid'].some((v) => value === normaliseRechargeOperator(v))) return 0.8;
  if (['vi', 'vodafoneidea', 'vodafone', 'idea', 'vi prepaid'].some((v) => value === normaliseRechargeOperator(v))) return 3;
  if (['bsnl', 'bs', 'bsnl prepaid'].some((v) => value === normaliseRechargeOperator(v))) return 4;
  if (['mtnl', 'mt', 'mtnl prepaid'].some((v) => value === normaliseRechargeOperator(v))) return 4;
  return 0;
};

export const getRechargeCommission = (amount, operator, mode) => {
  const rate = getRechargeCommissionRate(operator, mode);
  return formatAmount((Number(amount) || 0) * (rate / 100));
};

/**
 * Icchhamati BBPS commissions. Flat commissions are returned in rupees;
 * percentage commissions are calculated from the bill amount.
 */
export const getBbpsCommissionRule = (service) => {
  const value = String(service || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (value.includes('electric')) return { kind: 'flat', value: 1.8 };
  if (value.includes('water')) return { kind: 'flat', value: 3 };
  if (value.includes('gas') || value.includes('lpg')) return { kind: 'flat', value: 1.8 };
  if (value.includes('creditcard')) return { kind: 'flat', value: 5 };
  if (value.includes('loan') || value.includes('emi')) return { kind: 'flat', value: 3 };
  if (value.includes('insurance')) return { kind: 'flat', value: 3 };
  if (value.includes('fastag')) return { kind: 'percent', value: 0.11 };
  return { kind: 'percent', value: 1 };
};

export const getBbpsCommission = (amount, service) => {
  const rule = getBbpsCommissionRule(service);
  const numericAmount = Number(amount) || 0;
  return formatAmount(
    rule.kind === 'flat' ? rule.value : numericAmount * (rule.value / 100)
  );
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
 * 2%. Cash-deposit commission carries no TDS at all.
 */
export const retailerNetCommission = (txn) => {
  const gross = Number(txn?.commissions?.retailerEarned) || 0;
  if (!gross) return 0;
  if (txn?.type === 'AEPS_DEPOSIT') return formatAmount(gross);
  const stored = txn?.commissions?.retailerTds;
  const tds = stored === undefined || stored === null ? gross * 0.02 : Number(stored) || 0;
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
      await WalletModel.findOneAndUpdate(
        { userId },
        { $inc: { balance: -formattedAmount } }
      );
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
      // Recharge commission must be settled atomically with the one-way
      // PROCESSING -> SUCCESS transition. This makes the immediate response
      // path and the reconciliation worker safe to run concurrently.
      if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT') {
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

          const isRecharge = claimed.type === 'RECHARGE';
          const rate = isRecharge
            ? getRechargeCommissionRate(claimed.metadata?.operator, claimed.metadata?.mode)
            : getBbpsCommissionRule(claimed.metadata?.mode);
          const commission = isRecharge
            ? getRechargeCommission(
                claimed.amount,
                claimed.metadata?.operator,
                claimed.metadata?.mode
              )
            : getBbpsCommission(claimed.amount, claimed.metadata?.mode);

          if (commission > 0) {
            await MainWallet.findOneAndUpdate(
              { userId: claimed.userId, userModel: 'Retailer' },
              { $inc: { balance: commission } },
              { upsert: true, session }
            );
          }

          claimed.commissions = {
            ...claimed.commissions,
            retailerEarned: commission,
            retailerTds: 0,
            retailerCommissionGross: commission,
          };
          claimed.metadata = {
            ...claimed.metadata,
            apiMessage,
            ...(isRecharge
              ? { rechargeCommissionRate: rate }
              : { bbpsCommissionRule: rate }),
          };
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
      await WalletModel.findOneAndUpdate(
        { userId },
        { $inc: { balance: -formattedAmount } }
      );
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

  const FromWalletModel = fromWalletType === 'MAIN' ? MainWallet : AepsWallet;
  const ToWalletModel = toWalletType === 'MAIN' ? MainWallet : AepsWallet;
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

    // Commission rates from GlobalSettings (defaults mirror the legacy path).
    const settings = await GlobalSettings.findOne({}).session(session);
    let distributorPct = 0;
    let totalApiPct = 0.45;
    if (settings && settings.aepsCommission) {
      distributorPct = settings.aepsCommission.distributorPercentage || 0;
      totalApiPct = settings.aepsCommission.totalApiPercentage || 0.45;
    }

    const numericAmount = Number(amount);
    // AEPS cash withdrawal retailer commission is slab-based
    // (₹300–₹3000 → 0.35%, ₹3001–₹10000 → flat ₹12, <₹300 → ₹0).
    // Rule: the retailer's commission is credited to the AEPS wallet only
    // AFTER deducting 2% TDS (configurable via AEPS_COMMISSION_TDS_RATE).
    // GST is no longer charged on commission.
    const retailerGross = getAepsWithdrawalCommission(numericAmount);
    const commissionTdsRate = Number(process.env.AEPS_COMMISSION_TDS_RATE || 2) / 100;
    const retailerTds = Math.round(retailerGross * commissionTdsRate * 100) / 100;
    const retailerCommission = Math.round((retailerGross - retailerTds) * 100) / 100;
    const distributorCommission = numericAmount * (distributorPct / 100);
    const totalCommission = numericAmount * (totalApiPct / 100);
    const adminCommission = Math.max(0, totalCommission - retailerGross - distributorCommission);

    const retailer = await Retailer.findById(userId).session(session);
    const distId = retailer ? retailer.distributorId : null;

    // Retailer AepsWallet (principal + retailer commission net of TDS)
    await AepsWallet.findOneAndUpdate(
      { userId, userModel: 'Retailer' },
      { $inc: { balance: numericAmount + retailerCommission } },
      { upsert: true, session }
    );

    // Distributor AepsWallet
    if (distId && distributorCommission > 0) {
      await AepsWallet.findOneAndUpdate(
        { userId: distId, userModel: 'Distributor' },
        { $inc: { balance: distributorCommission } },
        { upsert: true, session }
      );
    }

    // AdminWallet
    const admin = await Admin.findOne({}).session(session);
    if (admin && adminCommission > 0) {
      await AdminWallet.findOneAndUpdate(
        { userId: admin._id },
        { $inc: { balance: adminCommission } },
        { upsert: true, session }
      );
    }

    claimed.transactionId = paysprintRef || claimed.transactionId;
    claimed.commissions = {
      ...claimed.commissions,
      // retailerEarned stores the GROSS commission; TDS is tracked
      // separately in retailerTds. The wallet itself is credited NET
      // of TDS (retailerCommission).
      retailerEarned: retailerGross,
      retailerTds: retailerTds,
      retailerCommissionGross: retailerGross,
      distributorEarned: distributorCommission,
      adminEarned: adminCommission,
    };
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
 * slab-based commission (₹2 / ₹5) is credited here, in full — no TDS or GST is
 * deducted from cash-deposit commission.
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
    // Cash-deposit commission is slab-based and NOT subject to TDS/GST.
    const retailerCommission = getAepsDepositCommission(numericAmount);

    // Retailer MainWallet gets the full deposit commission (net of nothing).
    if (retailerCommission > 0) {
      await MainWallet.findOneAndUpdate(
        { userId, userModel: 'Retailer' },
        { $inc: { balance: retailerCommission } },
        { upsert: true, session }
      );
    }

    claimed.transactionId = paysprintRef || claimed.transactionId;
    claimed.commissions = {
      ...claimed.commissions,
      retailerEarned: retailerCommission,
      retailerTds: 0,
      retailerCommissionGross: retailerCommission,
      distributorEarned: 0,
      adminEarned: 0,
    };
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
