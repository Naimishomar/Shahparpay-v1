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
 * Executes an atomic wallet update wrapped in a MongoDB Session.
 * 
 * @param {string} userId - Retailer ID
 * @param {string} walletType - 'MAIN' or 'AEPS'
 * @param {number} amount - Amount to add (positive) or deduct (negative)
 * @param {object} transactionDetails - Details to create the Transaction log
 * @returns {object} The created transaction log
 */
export const updateWalletAtomically = async (userId, walletType, amount, transactionDetails) => {
    const formattedAmount = formatAmount(amount);
    
    // Check if deduction is valid (cannot go below 0)
    let condition = { userId };
    if (formattedAmount < 0) {
        condition.balance = { $gte: Math.abs(formattedAmount) }; // Ensures sufficient balance
    }

    const WalletModel = walletType === 'MAIN' ? MainWallet : AepsWallet;
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Atomically update the wallet balance
        const updatedWallet = await WalletModel.findOneAndUpdate(
            condition,
            { $inc: { balance: formattedAmount } },
            { returnDocument: 'after', session, upsert: formattedAmount >= 0, setDefaultsOnInsert: true }
        );

        if (!updatedWallet) {
            throw new Error(`Insufficient funds or wallet not found for ${walletType} wallet.`);
        }

        // 2. Create the Transaction Log inside the same session
        const transactionLogs = await Transaction.create([transactionDetails], { session });

        // 3. Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return transactionLogs[0];
    } catch (error) {
        // If anything fails, abort the transaction completely
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Atomically transfers funds between two wallets (AEPS to Main, or vice versa)
 * 
 * @param {string} userId - Retailer ID
 * @param {string} fromWalletType - 'MAIN' or 'AEPS'
 * @param {string} toWalletType - 'MAIN' or 'AEPS'
 * @param {number} amount - Positive amount to transfer
 * @param {object} transactionDetails - Details to create the Transaction log
 */
export const transferBetweenWallets = async (userId, fromWalletType, toWalletType, amount, transactionDetails) => {
    const formattedAmount = formatAmount(Math.abs(amount));
    
    const FromWalletModel = fromWalletType === 'MAIN' ? MainWallet : AepsWallet;
    const ToWalletModel = toWalletType === 'MAIN' ? MainWallet : AepsWallet;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Deduct from Source Wallet (atomic check for sufficient balance)
        const deductedWallet = await FromWalletModel.findOneAndUpdate(
            { userId, balance: { $gte: formattedAmount } },
            { $inc: { balance: -formattedAmount } },
            { returnDocument: 'after', session }
        );

        if (!deductedWallet) {
            throw new Error(`Insufficient funds in ${fromWalletType} wallet.`);
        }

        // 2. Add to Destination Wallet
        const creditedWallet = await ToWalletModel.findOneAndUpdate(
            { userId },
            { $inc: { balance: formattedAmount } },
            { returnDocument: 'after', session }
        );

        if (!creditedWallet) {
            throw new Error(`Destination ${toWalletType} wallet not found.`);
        }

        // 3. Create the Transaction Log
        const transactionLogs = await Transaction.create([transactionDetails], { session });

        // 4. Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return transactionLogs[0];
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
