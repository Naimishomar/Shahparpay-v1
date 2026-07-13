import axios from 'axios';
import bcrypt from 'bcrypt';
import BankAccount from '../models/bankAccount.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';
import { generatePaySprintToken } from '../utils/paysprint.util.js';

const getPaySprintHeaders = () => {
    return {
        'Token': generatePaySprintToken(),
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };
};

const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';

export const getSavedBanks = async (req, res) => {
    try {
        const banks = await BankAccount.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: banks });
    } catch (error) {
        console.error("Error fetching saved banks:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addSettlementBank = async (req, res) => {
    try {
        const { accountNumber, ifscCode, bankName } = req.body;

        if (!accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({ success: false, message: "Account number, IFSC, and Bank Name are required" });
        }

        // Fetch User to get merchant code
        let user;
        if (req.user.role === 'distributor') {
            user = await Distributor.findById(req.user.id);
        } else {
            user = await Retailer.findById(req.user.id);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const merchantCode = user.distributorId || user.retailerId;
        
        // Enforce strict AEPS Rule: Account Holder Name MUST be the KYC Name
        const kycName = `${user.firstName} ${user.lastName}`.trim();

        // Call PaySprint ADD ACCOUNT API
        const payload = {
            bankid: "1177",
            merchant_code: merchantCode,
            merchant_type: "1", // 1 or 2 as per PaySprint undocumented requirement
            account: accountNumber,
            ifsc: ifscCode,
            name: kycName,
            account_type: "PRIMARY",
            pipe: "bank2"
        };

        try {
            const apiResponse = await axios.post(`${baseUrl}/service/payout/payout/add`, payload, {
                headers: getPaySprintHeaders()
            });

            if (apiResponse.data?.status === false) {
                return res.status(400).json({ success: false, message: apiResponse.data.message || "Failed to add account at PaySprint" });
            }

            // Extract bene_id from response (usually in data.bene_id)
            const beneId = apiResponse.data?.data?.bene_id || apiResponse.data?.bene_id || accountNumber;

            const newBank = await BankAccount.create({
                userId: req.user.id,
                userModel: req.user.role === 'distributor' ? 'Distributor' : 'Retailer',
                accountHolderName: kycName,
                accountNumber,
                ifscCode,
                bankName,
                beneId,
                status: 'VERIFIED' 
            });

            return res.status(201).json({ success: true, message: "Bank account added successfully", data: newBank });
        } catch (apiError) {
            console.error("PaySprint Add Account Error:", apiError?.response?.data || apiError.message);
            return res.status(500).json({ success: false, message: "Failed to integrate with Payout provider" });
        }
    } catch (error) {
        console.error("Error adding bank:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const initiateSettlement = async (req, res) => {
    try {
        const { bankId, amount, pin, mode } = req.body;

        if (!bankId || !amount || amount <= 0 || !pin) {
            return res.status(400).json({ success: false, message: "Invalid parameters" });
        }

        const bank = await BankAccount.findOne({ _id: bankId, userId: req.user.id });
        if (!bank) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }

        const aepsWallet = await AepsWallet.findOne({ userId: req.user.id });
        if (!aepsWallet || !aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "Please set your wallet PIN first." });
        }

        const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
        if (!isPinValid) {
            return res.status(401).json({ success: false, message: "Incorrect PIN" });
        }

        // Calculate Fee based on typical IMPS slab
        let fee = 0;
        if (mode === 'IMPS') {
            if (amount >= 100 && amount <= 10000) fee = 3.00;
            else if (amount > 10000 && amount <= 25000) fee = 5.00;
            else if (amount > 25000) fee = 8.00;
        }

        const totalDeduction = Number(amount) + fee;

        if (aepsWallet.balance < totalDeduction) {
            return res.status(400).json({ success: false, message: `Insufficient AEPS Wallet balance. (Amount: ₹${amount} + Fee: ₹${fee})` });
        }

        const transactionId = `SETTLE${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Deduct balance atomically (Creates PENDING transaction)
        const { updateWalletAtomically } = await import('../utils/wallet.util.js');
        await updateWalletAtomically(req.user.id, 'AEPS', -totalDeduction, {
            transactionId,
            userId: req.user.id,
            type: 'AEPS_SETTLEMENT',
            amount: totalDeduction,
            status: 'PENDING',
            metadata: {
                bankAccount: bank.accountNumber,
                bankName: bank.bankName,
                mode,
                fee
            }
        });

        const payload = {
            accno: bank.accountNumber,
            bankname: bank.bankName,
            ifsc: bank.ifscCode,
            name: bank.accountHolderName,
            amount: amount.toString(),
            mode: mode || "IMPS",
            reference_id: transactionId,
            beneficiary_id: bank.beneId,
            latitude: "28.6139",
            longitude: "77.2090"
        };

        let apiResponse;
        let status = 'FAILED';
        try {
            // NOTE: Fixed PaySprint Payout URL based on latest documentation
            apiResponse = await axios.post(`${baseUrl}/service/payout/payout/dotransaction`, 
                payload, 
                { headers: getPaySprintHeaders() }
            );
            status = apiResponse.data?.status ? 'SUCCESS' : 'FAILED';
        } catch (apiError) {
            console.error("Payout API Error:", apiError?.response?.data || apiError.message);
            
            let errorData = apiError?.response?.data;
            let errorMessage = apiError.message;
            
            // Prevent returning bulky raw HTML to the frontend if PaySprint returns a 404 page
            if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')) {
                errorMessage = "PaySprint Payout API is currently unavailable or the endpoint URL is incorrect (404 Not Found).";
                errorData = null; 
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            }

            apiResponse = { data: { status: false, message: errorMessage, error: errorData } };
        }

        if (status === 'FAILED') {
            await updateWalletAtomically(req.user.id, 'AEPS', totalDeduction, {
                transactionId: `REF-${transactionId}`,
                userId: req.user.id,
                type: 'AEPS_SETTLEMENT',
                amount: totalDeduction,
                status: 'SUCCESS',
                metadata: { note: 'Refund for failed settlement', originalTxn: transactionId }
            });
        }

        // Update the original Transaction status
        const Transaction = (await import('../models/transaction.model.js')).default;
        await Transaction.findOneAndUpdate({ transactionId }, { 
            status, 
            'metadata.apiMessage': apiResponse.data?.message 
        });

        return res.status(200).json({ 
            success: status === 'SUCCESS', 
            message: apiResponse.data?.message || (status === 'SUCCESS' ? "Settlement successful" : "Settlement failed"),
            data: apiResponse.data
        });

    } catch (error) {
        console.error("Settlement Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const initiateDirectPayout = async (req, res) => {
    try {
        const { accountNumber, ifscCode, accountHolderName, bankName, amount, pin, mode } = req.body;

        if (!accountNumber || !ifscCode || !accountHolderName || !amount || amount <= 0 || !pin) {
            return res.status(400).json({ success: false, message: "Invalid parameters for Direct Payout" });
        }

        const aepsWallet = await AepsWallet.findOne({ userId: req.user.id });
        if (!aepsWallet || !aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "Please set your wallet PIN first." });
        }

        const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
        if (!isPinValid) {
            return res.status(401).json({ success: false, message: "Incorrect PIN" });
        }

        // Calculate Fee based on typical IMPS slab
        let fee = 0;
        if (mode === 'IMPS') {
            if (amount >= 100 && amount <= 10000) fee = 3.00;
            else if (amount > 10000 && amount <= 25000) fee = 5.00;
            else if (amount > 25000) fee = 8.00;
        }

        const totalDeduction = Number(amount) + fee;

        const transactionId = `PAYOUT${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Deduct balance atomically from MAIN Wallet
        const { lockFundsForTransaction, resolveTransaction } = await import('../utils/wallet.util.js');
        
        try {
            await lockFundsForTransaction(req.user.id, 'MAIN', -totalDeduction, {
                transactionId,
                userId: req.user.id,
                type: 'DIRECT_PAYOUT',
                amount: totalDeduction,
                status: 'PROCESSING',
                metadata: {
                    bankAccount: accountNumber,
                    bankName: bankName || 'Bank Account',
                    beneficiaryName: accountHolderName,
                    mode: mode || 'IMPS',
                    fee
                }
            });
        } catch (walletError) {
            return res.status(400).json({ success: false, message: `Insufficient Main Wallet balance. (Amount: ₹${amount} + Fee: ₹${fee})` });
        }

        const payload = {
            accno: accountNumber,
            bankname: bankName || 'Bank',
            ifsc: ifscCode,
            name: accountHolderName,
            amount: amount.toString(),
            mode: mode || "IMPS",
            reference_id: transactionId,
            beneficiary_id: "MANUAL",
            latitude: "28.6139",
            longitude: "77.2090"
        };

        let apiResponse;
        let status = 'FAILED';
        try {
            apiResponse = await axios.post(`${baseUrl}/service/payout/payout/dotransaction`, 
                payload, 
                { headers: getPaySprintHeaders() }
            );
            status = apiResponse.data?.status ? 'SUCCESS' : 'FAILED';
        } catch (apiError) {
            console.error("Payout API Error:", apiError?.response?.data || apiError.message);
            
            let errorData = apiError?.response?.data;
            let errorMessage = apiError.message;
            
            if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')) {
                errorMessage = "PaySprint Payout API is currently unavailable or the endpoint URL is incorrect (404 Not Found).";
                errorData = null; 
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            }

            apiResponse = { data: { status: false, message: errorMessage, error: errorData } };
        }

        // RESOLVE Phase: Update status and securely refund if FAILED
        await resolveTransaction(
            transactionId, 
            status, 
            apiResponse.data?.message || (status === 'SUCCESS' ? "Direct payout successful" : "Direct payout failed"),
            'MAIN'
        );

        return res.status(200).json({ 
            success: status === 'SUCCESS', 
            message: apiResponse.data?.message || (status === 'SUCCESS' ? "Direct payout successful" : "Direct payout failed"),
            data: apiResponse.data
        });

    } catch (error) {
        console.error("Direct Payout Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSettlementHistory = async (req, res) => {
    try {
        const history = await Transaction.find({ 
            userId: req.user.id, 
            type: 'AEPS_SETTLEMENT' 
        }).sort({ createdAt: -1 }).limit(50);
        return res.status(200).json({ success: true, data: history });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
