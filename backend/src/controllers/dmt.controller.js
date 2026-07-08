import axios from 'axios';
import { generatePaySprintToken, encryptPayload } from '../utils/paysprint.util.js';
import DmtTransaction from '../models/dmtTransaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Transaction from '../models/transaction.model.js';
import bcrypt from 'bcrypt';

const getPaySprintHeaders = () => {
    return {
        'Token': generatePaySprintToken(),
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };
};

const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

export const queryRemitter = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return res.status(400).json({ success: false, message: "Mobile number required" });

        const payload = { 
            mobile: mobile,
            bank3_flag: "NO",
            bank4_flag: "NO"
        };
        const response = await axios.post(`${baseUrl}/service/dmt/remitter/queryremitter`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to query remitter", error: error?.response?.data });
    }
};

export const registerRemitter = async (req, res) => {
    try {
        const { mobile, firstName, lastName, pincode } = req.body;
        const payload = { mobile, firstname: firstName, lastname: lastName, pincode };
        const response = await axios.post(`${baseUrl}/service/dmt/remitter/registerremitter`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to register remitter" });
    }
};

export const verifyRemitter = async (req, res) => {
    try {
        const { mobile, otp, stateresp } = req.body;
        const payload = { mobile, otp, stateresp };
        const response = await axios.post(`${baseUrl}/service/dmt/remitter/verifyremitter`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to verify remitter" });
    }
};

export const fetchBeneficiaries = async (req, res) => {
    try {
        const { mobile } = req.body;
        const payload = { mobile };
        const response = await axios.post(`${baseUrl}/service/dmt/beneficiary/registerbeneficiary/fetchbeneficiary`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to fetch beneficiaries", error: error?.response?.data });
    }
};

export const addBeneficiary = async (req, res) => {
    try {
        const { mobile, bankid, benename, beneaccount, ifsc, pincode } = req.body;
        const payload = { mobile, bankid, benename, accno: beneaccount, ifsc, pincode };
        const response = await axios.post(`${baseUrl}/service/dmt/beneficiary/registerbeneficiary`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to add beneficiary", error: error?.response?.data });
    }
};

export const deleteBeneficiary = async (req, res) => {
    try {
        const { mobile, beneid } = req.body;
        const payload = { mobile, beneid };
        const response = await axios.post(`${baseUrl}/service/dmt/beneficiary/deletebeneficiary`, 
            payload, 
            { headers: getPaySprintHeaders() }
        );

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.response?.data?.message || "Failed to delete beneficiary" });
    }
};

export const initiateTransfer = async (req, res) => {
    try {
        const retailerId = req.user.id;
        const { mobile, beneid, amount, beneaccount, ifsc, pin } = req.body;

        if (!amount || amount <= 0 || !pin) {
            return res.status(400).json({ success: false, message: "Valid amount and PIN are required" });
        }

        const mainWallet = await MainWallet.findOne({ userId: retailerId });
        if (!mainWallet || mainWallet.balance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient Main Wallet balance for DMT" });
        }

        // We use AepsWallet to verify PIN since PIN is stored there
        const AepsWallet = (await import('../models/aepsWallet.model.js')).default;
        const aepsWallet = await AepsWallet.findOne({ userId: retailerId });
        
        if (!aepsWallet || !aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "Please set your wallet PIN first." });
        }

        const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
        if (!isPinValid) {
            return res.status(401).json({ success: false, message: "Incorrect PIN" });
        }

        const transactionId = `DMT${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Deduct from Main Wallet atomically (Creates PENDING transaction)
        const { updateWalletAtomically } = await import('../utils/wallet.util.js');
        await updateWalletAtomically(retailerId, 'MAIN', -amount, {
            transactionId,
            userId: retailerId,
            type: 'DMT',
            amount: amount,
            status: 'PENDING',
            metadata: { beneficiaryAccount: beneaccount }
        });

        const payload = {
            mobile,
            referenceid: transactionId,
            pipe: "bank1",
            pincode: "110001",
            address: "Retailer Address",
            dob: "01-01-1990",
            gst_state: "07",
            beneid,
            txntype: "IMPS",
            amount: amount.toString()
        };

        let response;
        let status = 'FAILED';
        
        try {
            response = await axios.post(`${baseUrl}/service/dmt/transact/transact`, 
                payload, 
                { headers: getPaySprintHeaders() }
            );
            status = response.data?.status ? 'SUCCESS' : 'FAILED';
        } catch (apiError) {
            console.error("DMT API request failed:", apiError?.response?.data || apiError.message);
            response = { data: apiError?.response?.data || { message: apiError.message } };
        }

        // Refund if failed
        if (status === 'FAILED') {
            await updateWalletAtomically(retailerId, 'MAIN', amount, {
                transactionId: `REF-${transactionId}`,
                userId: retailerId,
                type: 'DMT',
                amount: amount,
                status: 'SUCCESS',
                metadata: { note: 'Refund for failed DMT transaction', originalTxn: transactionId }
            });
        }

        // Update the original Transaction status
        await Transaction.findOneAndUpdate({ transactionId }, { 
            status, 
            'metadata.apiMessage': response.data?.message 
        });

        // Log DMT specific Transaction
        const dmtTxn = await DmtTransaction.create({
            transactionId,
            retailerId,
            remitterMobile: mobile,
            beneficiaryAccount: beneaccount,
            beneficiaryIfsc: ifsc,
            amount,
            status,
            apiReference: response.data?.ackno || null,
            apiResponse: response.data
        });

        return res.status(200).json({ 
            success: status === 'SUCCESS', 
            message: response.data?.message || "Transaction processed",
            data: response.data,
            transaction: dmtTxn
        });

    } catch (error) {
        console.error("DMT Transfer Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getDmtHistory = async (req, res) => {
    try {
        const history = await DmtTransaction.find({ retailerId: req.user.id }).sort({ createdAt: -1 }).limit(50);
        return res.status(200).json({ success: true, data: history });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

import fs from 'fs';
import path from 'path';

export const fetchBankList = async (req, res) => {
    try {
        const banksFilePath = path.join(process.cwd(), 'src/data/dmt_banks.json');
        
        // Read the local JSON file containing PaySprint banks
        if (fs.existsSync(banksFilePath)) {
            const fileData = fs.readFileSync(banksFilePath, 'utf-8');
            const banks = JSON.parse(fileData);
            
            // Map the data to the format expected by the frontend
            const formattedBanks = banks.map(bank => ({
                bankid: bank.BankId.toString(),
                bankname: bank.BankName,
                ifsc: "" // Partner provides IFSC themselves
            }));

            return res.status(200).json({ 
                success: true, 
                data: {
                    status: true,
                    message: "Banks fetched successfully",
                    data: formattedBanks
                } 
            });
        } else {
            return res.status(500).json({ success: false, message: "Bank list data not found on server" });
        }
    } catch (error) {
        console.error("Failed to load bank list from file:", error);
        return res.status(500).json({ success: false, message: "Internal server error while loading bank list" });
    }
};
