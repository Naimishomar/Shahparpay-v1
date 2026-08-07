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
        const transactionLogs = await Transaction.create([{
            ...transactionDetails,
            status: 'PROCESSING'
        }]);

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
export const resolveTransaction = async (transactionId, finalStatus, apiMessage, walletType = 'MAIN') => {
    try {
        const txn = await Transaction.findOne({ transactionId });
        if (!txn) throw new Error("Transaction not found for resolution.");
        
        // Prevent double-resolving
        if (txn.status !== 'PROCESSING') {
            return txn; // Already resolved
        }

        if (finalStatus === 'SUCCESS') {
            // Funds are already deducted, just update status
            txn.status = 'SUCCESS';
            txn.metadata = { ...txn.metadata, apiMessage };
            await txn.save();
            return txn;
        } else if (finalStatus === 'FAILED') {
            // Must refund the deducted amount
            const refundAmount = Math.abs(txn.amount); // Always positive

            const WalletModel = walletType === 'MAIN' ? MainWallet : AepsWallet;
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
        console.error("Error resolving transaction:", error);
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

        const transactionLogs = await Transaction.create([transactionDetails]);
        return transactionLogs[0];
    } catch (error) {
        throw error;
    }
};

/**
 * Atomically transfers funds between two wallets
 */
export const transferBetweenWallets = async (userId, fromWalletType, toWalletType, amount, transactionDetails) => {
    const formattedAmount = formatAmount(Math.abs(amount));
    
    const FromWalletModel = fromWalletType === 'MAIN' ? MainWallet : AepsWallet;
    const ToWalletModel = toWalletType === 'MAIN' ? MainWallet : AepsWallet;

    try {
        const deductedWallet = await FromWalletModel.findOneAndUpdate(
            { userId, balance: { $gte: formattedAmount } },
            { $inc: { balance: -formattedAmount } },
            { returnDocument: 'after' }
        );

        if (!deductedWallet) {
            throw new Error(`Insufficient funds in ${fromWalletType} wallet.`);
        }

        const creditedWallet = await ToWalletModel.findOneAndUpdate(
            { userId },
            { $inc: { balance: formattedAmount } },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );

        if (!creditedWallet) {
            throw new Error(`Destination ${toWalletType} wallet not found.`);
        }

        const transactionLogs = await Transaction.create([transactionDetails]);
        return transactionLogs[0];
    } catch (error) {
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
        'Token': token,
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
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
 * Atomically credits wallets and finalizes an AEPS withdrawal that the bank has
 * confirmed as successful. Idempotent: only a PENDING or PROCESSING transaction
 * may transition to SUCCESS, so concurrent reconciliation cannot double-credit.
 *
 * Returns the finalized Transaction, or null if the transaction was already
 * resolved (someone else credited it first).
 */
export const applyAepsWithdrawalSuccess = async ({ transactionId, userId, amount, paysprintRef, message }) => {
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
        const retailerCommission = getAepsWithdrawalCommission(numericAmount);
        const distributorCommission = numericAmount * (distributorPct / 100);
        const totalCommission = numericAmount * (totalApiPct / 100);
        const adminCommission = Math.max(0, totalCommission - retailerCommission - distributorCommission);

        const retailer = await Retailer.findById(userId).session(session);
        const distId = retailer ? retailer.distributorId : null;

        // Retailer AepsWallet (principal + retailer commission)
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
            retailerEarned: retailerCommission,
            distributorEarned: distributorCommission,
            adminEarned: adminCommission
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
