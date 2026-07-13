import mongoose from 'mongoose';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';

/**
 * Rounds a number to 2 decimal places to prevent float precision issues.
 */
const formatAmount = (amount) => {
    return Math.round(Number(amount) * 100) / 100;
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
