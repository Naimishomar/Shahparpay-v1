import axios from 'axios';
import mongoose from 'mongoose';
import { generatePaySprintToken, encryptPayload } from '../utils/paysprint.util.js';
import Retailer from "../models/users/retailer.model.js";
import Transaction from "../models/transaction.model.js";

export const balanceEnquiry = async (req, res) => {
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, latitude, longitude } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData) {
            return res.status(400).json({ 
                success: false,
                message: "Aadhaar number, Bank IIN, and Biometric PidData are required." 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const retailer = await Retailer.findById(req.user.id);
        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || "9999999999"),
            referenceno: `REF${Date.now()}`,
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            submerchantid: String(retailer.retailerId)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/balanceenquiry/bank1`, { body: encryptedData }, { headers });

        if (response.data && response.data.status) {
            return res.status(200).json({
                success: true,
                message: "Balance fetched successfully",
                data: response.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || "Failed to fetch balance",
                data: response.data
            });
        }
    } catch (error) {
        console.error("AEPS Balance Enquiry Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AEPS request",
            error: error?.response?.data || error.message
        });
    }
};

let cachedAepsBanks = null;
let lastCacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const getBankList = async (req, res) => {
    try {
        const now = Date.now();
        if (cachedAepsBanks && (now - lastCacheTime < CACHE_TTL)) {
            return res.status(200).json({
                success: true,
                message: "Bank list fetched successfully (Cached)",
                data: cachedAepsBanks
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const token = generatePaySprintToken();
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/banklist/index`, {}, { headers });

        if (response.data && response.data.status) {
            const banksData = response.data.banklist ? response.data.banklist.data : response.data.data;
            cachedAepsBanks = banksData;
            lastCacheTime = now;
            
            return res.status(200).json({
                success: true,
                message: "Bank list fetched successfully",
                data: banksData
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || "Failed to fetch bank list",
                data: response.data
            });
        }
    } catch (error) {
        console.error("Fetch Bank List Error:", error?.response?.data || error.message);
        
        // Return cached banks as fallback if API fails, even if expired
        if (cachedAepsBanks) {
            return res.status(200).json({
                success: true,
                message: "Bank list fetched from fallback cache",
                data: cachedAepsBanks
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal Server Error during fetch bank list request",
            error: error?.response?.data || error.message
        });
    }
};

export const cashWithdrawal = async (req, res) => {
    let session = null;
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, merchantPidData, amount, latitude, longitude, bankName, customerName } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData || !amount) {
            return res.status(400).json({ 
                success: false,
                message: "Aadhaar number, Bank IIN, Biometric PidData, and Amount are required." 
            });
        }

        // Fetch retailer for Merchant Auth
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const referenceNo = `CW${Date.now()}`;

        // 1. Merchant 2FA (Txn Auth)
        if (merchantPidData) {
            const twfPayload = {
                latitude: latitude || "28.7041",
                longitude: longitude || "77.1025",
                mobilenumber: retailer.contactNumber || "9999999999",
                referenceno: `AUTH${Date.now()}`,
                ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
                adhaarnumber: retailer.aadhaarNumber,
                accessmodetype: "SITE",
                data: merchantPidData,
                submerchantid: retailer.retailerId,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
            };

            const twfToken = generatePaySprintToken();
            const twfEncrypted = encryptPayload(JSON.stringify(twfPayload));
            const twfHeaders = {
                'Token': twfToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };

            const twfResponse = await axios.post(`${baseUrl}/service/aeps/v3/twfauth/bank1`, { body: twfEncrypted }, { headers: twfHeaders });
            if (!twfResponse.data || !twfResponse.data.status) {
                return res.status(400).json({ success: false, message: twfResponse.data.message || "Merchant Auth Failed" });
            }
        }

        // 2. Create PENDING Transaction (Idempotency)
        let newTxn = await Transaction.create({
            transactionId: referenceNo,
            userId: req.user.id,
            type: 'AEPS_WITHDRAWAL',
            amount: Number(amount),
            status: 'PENDING',
            metadata: {
                aadhaar: aadhaarNumber,
                bankIIN: bankIIN,
                bankName: bankName,
                name: customerName,
                mobile: mobileNumber
            }
        });

        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || "9999999999"),
            referenceno: referenceNo,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            requestremarks: "Cash Withdrawal",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            transactiontype: "CW",
            submerchantid: String(retailer.retailerId),
            amount: Number(amount),
            is_iris: "No"
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/cashwithdraw/bank1`, { body: encryptedData }, { headers });

        let txnStatus = (response.data && response.data.status) ? 'SUCCESS' : 'FAILED';
        let paysprintRef = response.data?.data?.ackno || response.data?.data?.rrn || null;
        
        // 3. Atomically update Wallet & Transaction if SUCCESS
        if (txnStatus === 'SUCCESS') {
            session = await mongoose.startSession();
            session.startTransaction();
            
            // Update AepsWallet
            const { default: AepsWallet } = await import('../models/aepsWallet.model.js');
            await AepsWallet.findOneAndUpdate(
                { userId: req.user.id, userModel: 'Retailer' },
                { $inc: { balance: Number(amount) } },
                { upsert: true, session }
            );

            // Update Transaction
            newTxn.status = 'SUCCESS';
            newTxn.transactionId = paysprintRef || newTxn.transactionId;
            if (paysprintRef) {
                newTxn.metadata = { ...newTxn.metadata, paysprintRef };
            }
            // Note: Commissions skipped for now as per user request
            await newTxn.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: "Cash withdrawal successful",
                data: response.data
            });
        } else {
            // Update Transaction to FAILED (No session needed as wallet is unaffected)
            newTxn.status = 'FAILED';
            if (paysprintRef) {
                newTxn.metadata = { ...newTxn.metadata, paysprintRef };
            }
            await newTxn.save();

            return res.status(400).json({
                success: false,
                message: response.data.message || "Cash withdrawal failed",
                data: response.data
            });
        }
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("AEPS Cash Withdrawal Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AEPS Cash Withdrawal request",
            error: error?.response?.data || error.message
        });
    }
};

export const miniStatement = async (req, res) => {
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, latitude, longitude } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData) {
            return res.status(400).json({ success: false, message: "Required fields missing." });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const retailer = await Retailer.findById(req.user.id);
        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || "9999999999"),
            referenceno: `MS${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            requestremarks: "Mini Statement",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            submerchantid: String(retailer.retailerId),
            is_iris: "No"
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/ministatement/bank1`, { body: encryptedData }, { headers });

        if (response.data && response.data.status) {
            return res.status(200).json({ success: true, message: "Mini Statement fetched", data: response.data });
        } else {
            return res.status(400).json({ success: false, message: response.data.message || "Failed", data: response.data });
        }
    } catch (error) {
        console.error("Mini Statement Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const cashDeposit = async (req, res) => {
    try {
        const { latitude, longitude, mobileNumber, aadhaarNumber, bankIIN, pidData, merchantPidData, amount, bankName, customerName } = req.body;

        if (!aadhaarNumber || !bankIIN || !pidData || !amount) {
            return res.status(400).json({ success: false, message: "Aadhaar number, bank IIN, PID Data, and amount are required" });
        }

        const Retailer = (await import('../models/retailer.model.js')).default;
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const referenceNo = `CD${Date.now()}`;

        // 1. Merchant 2FA (Txn Auth)
        if (merchantPidData) {
            const twfPayload = {
                latitude: latitude || "28.7041",
                longitude: longitude || "77.1025",
                mobilenumber: retailer.contactNumber || "9999999999",
                referenceno: `AUTH${Date.now()}`,
                ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
                adhaarnumber: retailer.aadhaarNumber,
                accessmodetype: "SITE",
                data: merchantPidData,
                submerchantid: retailer.retailerId,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
            };

            const twfToken = generatePaySprintToken();
            const twfEncrypted = encryptPayload(JSON.stringify(twfPayload));
            const twfHeaders = {
                'Token': twfToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };

            const twfResponse = await axios.post(`${baseUrl}/service/aeps/v3/twfauth/bank1`, { body: twfEncrypted }, { headers: twfHeaders });
            if (!twfResponse.data || !twfResponse.data.status) {
                return res.status(400).json({ success: false, message: twfResponse.data.message || "Merchant Auth Failed" });
            }
        }

        // 2. Deduct from Main Wallet Atomically (Creates PENDING transaction)
        const { updateWalletAtomically } = await import('../utils/wallet.util.js');
        
        let newTxn;
        try {
            newTxn = await updateWalletAtomically(req.user.id, 'MAIN', -Number(amount), {
                transactionId: referenceNo,
                userId: req.user.id,
                type: 'AEPS_DEPOSIT',
                amount: Number(amount),
                status: 'PENDING',
                metadata: {
                    aadhaar: aadhaarNumber,
                    bankIIN: bankIIN,
                    bankName: bankName,
                    name: customerName,
                    mobile: mobileNumber
                }
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message || "Insufficient Main Wallet balance for Cash Deposit" });
        }

        // 3. Make the API Call to PaySprint
        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || "9999999999"),
            referenceno: referenceNo,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            requestremarks: "Cash Deposit",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            transactiontype: "CD",
            submerchantid: String(retailer.retailerId),
            amount: Number(amount),
            is_iris: "No"
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        let txnStatus = 'FAILED';
        let response = null;
        let paysprintRef = null;
        let apiMessage = "Transaction failed";

        try {
            response = await axios.post(`${baseUrl}/service/aeps/v3/cashdeposit/bank1`, { body: encryptedData }, { headers });
            if (response.data && response.data.status) {
                txnStatus = 'SUCCESS';
            }
            paysprintRef = response.data?.data?.ackno || response.data?.data?.rrn || null;
            apiMessage = response.data?.message || "Cash deposit completed";
        } catch (apiError) {
            console.error("Cash Deposit API Error:", apiError?.response?.data || apiError.message);
            apiMessage = apiError?.response?.data?.message || apiError.message;
        }
        
        // 4. Handle Success/Failure
        const Transaction = (await import('../models/transaction.model.js')).default;
        
        if (txnStatus === 'SUCCESS') {
            await Transaction.findOneAndUpdate({ transactionId: referenceNo }, { 
                status: 'SUCCESS',
                'metadata.paysprintRef': paysprintRef,
                'metadata.apiMessage': apiMessage
            });

            return res.status(200).json({
                success: true,
                message: "Cash deposit successful",
                data: response.data
            });
        } else {
            // Refund the deducted amount if it failed
            await updateWalletAtomically(req.user.id, 'MAIN', Number(amount), {
                transactionId: `REF-${referenceNo}`,
                userId: req.user.id,
                type: 'AEPS_DEPOSIT_REFUND',
                amount: Number(amount),
                status: 'SUCCESS',
                metadata: { originalTxn: referenceNo, note: 'Refund for failed Cash Deposit' }
            });

            await Transaction.findOneAndUpdate({ transactionId: referenceNo }, { 
                status: 'FAILED',
                'metadata.apiMessage': apiMessage
            });

            return res.status(400).json({
                success: false,
                message: apiMessage || "Cash deposit failed"
            });
        }
    } catch (error) {
        console.error("Cash Deposit Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error during cash deposit" });
    }
};

export const cashWithdrawalTxnStatus = async (req, res) => {
    try {
        const { reference } = req.body;
        if (!reference) return res.status(400).json({ success: false, message: "reference is required" });

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const payload = { reference };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/aepsquery/bank1`, { body: encryptedData }, { headers });

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("AEPS Txn Status Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const sendMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaar) return res.status(400).json({ success: false, message: "merchantcode and aadhaar required" });

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode,
            accessmode: "SITE",
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            aadhaar
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/merchantkyc/send_otp`, payload, { headers });

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Send OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const resendMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude, stateresp, ekyc_id } = req.body;
        if (!merchantcode || !ekyc_id) return res.status(400).json({ success: false, message: "Required fields missing" });

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const payload = {
            merchantcode,
            aadhaar,
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            stateresp,
            ekyc_id,
            accessmode: "SITE"
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/merchantkyc/resend_otp`, payload, { headers });

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Resend OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const verifyMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude, otp, stateresp, ekyc_id, pidData } = req.body;
        if (!merchantcode || !otp || !pidData) return res.status(400).json({ success: false, message: "Required fields missing" });

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        
        // pidData needs to be AES encrypted for this specific endpoint.
        const encryptedPidData = encryptPayload(pidData);

        const payload = {
            merchantcode,
            aadhaar,
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            otp,
            stateresp,
            ekyc_id,
            piddata: encryptedPidData,
            accessmode: "SITE"
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/merchantkyc/verify_otp`, payload, { headers });

        if (response.data && response.data.status) {
            // Update the Retailer's KYC completion status
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { isMerchantKycComplete: true },
                { returnDocument: 'after' }
            );
        }

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Verify OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const dailyAuth = async (req, res) => {
    try {
        const { merchantcode, aadhaarNumber, mobileNumber, pidData, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaarNumber || !pidData) {
            return res.status(400).json({ success: false, message: "Required fields missing for Daily Auth" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        
        const payload = {
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            mobilenumber: mobileNumber || "9999999999",
            referenceno: `AUTH${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: aadhaarNumber,
            accessmodetype: "SITE",
            data: pidData,
            submerchantid: merchantcode,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/v3/authenticate/bank1`, { body: encryptedData }, { headers });

        if (response.data && response.data.status) {
            // Update the Retailer's last daily auth date tracker
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { lastDailyAuthDate: new Date() },
                { returnDocument: 'after' }
            );
            return res.status(200).json({ success: true, message: "Daily Auth Successful", data: response.data });
        } else {
            return res.status(400).json({ success: false, message: response.data.message || "Daily Auth Failed", data: response.data });
        }
    } catch (error) {
        console.error("Daily Auth Error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};

export const getMerchantStatus = async (req, res) => {
    try {
        const { merchantcode } = req.query;
        if (!merchantcode) {
            return res.status(400).json({ success: false, message: "merchantcode query param is required" });
        }

        const retailer = await Retailer.findOne({ retailerId: merchantcode });
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Check if daily auth was done today
        const today = new Date();
        const lastAuth = retailer.lastDailyAuthDate;
        let isDailyAuthDoneToday = false;
        
        if (lastAuth) {
            isDailyAuthDoneToday = 
                lastAuth.getDate() === today.getDate() &&
                lastAuth.getMonth() === today.getMonth() &&
                lastAuth.getFullYear() === today.getFullYear();
        }

        return res.status(200).json({
            success: true,
            data: {
                isMerchantKycComplete: retailer.isMerchantKycComplete,
                isDailyAuthDoneToday: isDailyAuthDoneToday,
                lastDailyAuthDate: retailer.lastDailyAuthDate
            }
        });
    } catch (error) {
        console.error("Get Merchant Status Error:", error);
        return res.status(500).json({ success: false, message: "Internal Error", error: error.message });
    }
};
