import axios from 'axios';
import mongoose from 'mongoose';
import { generatePaySprintToken, encryptPayload } from '../utils/paysprint.util.js';
import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Transaction from "../models/transaction.model.js";

// Helper function to resolve which bank pipe is verified for the merchant
const getVerifiedPipe = async (merchantcode, mobile) => {
    const pipes = ['bank3', 'bank2', 'bank1', 'bank5'];
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
    
    console.log(`[getVerifiedPipe] Checking pipes for merchant: ${merchantcode}`);

    for (const pipe of pipes) {
        try {
            const currentToken = generatePaySprintToken();
            const headers = {
                'Token': currentToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            };

            const res = await axios.post(`${baseUrl}/service/onboard/onboard/getonboardstatus`, {
                merchantcode: merchantcode,
                mobile: String(mobile),
                pipe: pipe
            }, { headers, validateStatus: () => true });
            
            console.log(`[getVerifiedPipe] Response for ${pipe}:`, JSON.stringify(res.data, null, 2));
            
            // Check if this pipe is approved - must be exactly "Accepted"
            if (res.data && 
                res.data.response_code === 1 && 
                res.data.is_approved === 'Accepted') {
                console.log(`[getVerifiedPipe] ✅ ${pipe} is verified and approved`);
                return pipe;
            } else {
                console.log(`[getVerifiedPipe] ❌ ${pipe} is NOT approved (is_approved: ${res.data?.is_approved})`);
            }
        } catch (e) {
            console.log(`[getVerifiedPipe] ⚠️ Error checking ${pipe}:`, e.message);
        }
    }
    
    console.log(`[getVerifiedPipe] No verified pipes found, defaulting to bank3`);
    return 'bank3';
};

// Helper function for merchant 2FA auth (used in cash withdrawal/deposit)
const performMerchantAuth = async (merchantPidData, retailer, req) => {
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
    
    const twfPayload = {
        latitude: req.body.latitude || "28.7041",
        longitude: req.body.longitude || "77.1025",
        mobilenumber: retailer.contactNumber || "9999999999",
        referenceno: `AUTH${Date.now()}`,
        ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
        adhaarnumber: retailer.aadhaarNumber,
        accessmodetype: "SITE",
        data: merchantPidData,
        submerchantid: retailer.retailerId,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        is_iris: "No",
        pipe: await getVerifiedPipe(retailer.retailerId, retailer.contactNumber)
    };

    const twfToken = generatePaySprintToken();
    const twfEncrypted = encryptPayload(JSON.stringify(twfPayload));
    const twfHeaders = {
        'Token': twfToken,
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };

    const twfResponse = await axios.post(
        `${baseUrl}/service/aeps/kyc/Twofactorkyc/auth_login`, 
        { body: twfEncrypted }, 
        { headers: twfHeaders, validateStatus: () => true }
    );
    
    // Check if registration is needed
    if (twfResponse.data && 
        (twfResponse.data.response_code === 2 || 
         twfResponse.data.response_code === 24 || 
         (twfResponse.data.message && twfResponse.data.message.toLowerCase().includes('registration is pending')))) {
        
        console.log(`[MerchantAuth] Registration pending, attempting auto-register...`);
        
        // Attempt registration 
        const regPayload = { 
            ...twfPayload, 
            referenceno: `REG${Date.now()}`,
            pipe: twfPayload.pipe
        };
        const regEncrypted = encryptPayload(JSON.stringify(regPayload));
        const regToken = generatePaySprintToken();
        const regHeaders = {
            'Token': regToken,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };
        
        const regResponse = await axios.post(
            `${baseUrl}/service/aeps/kyc/Twofactorkyc/register_agent`,
            { body: regEncrypted },
            { headers: regHeaders, validateStatus: () => true }
        );
        
        if (regResponse.data && regResponse.data.response_code === 1) {
            // Registration successful, try auth again with new token
            const secondToken = generatePaySprintToken();
            const secondHeaders = {
                'Token': secondToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };
            const secondEncrypted = encryptPayload(JSON.stringify(twfPayload));
            const secondResponse = await axios.post(
                `${baseUrl}/service/aeps/kyc/Twofactorkyc/auth_login`,
                { body: secondEncrypted },
                { headers: secondHeaders, validateStatus: () => true }
            );
            
            if (secondResponse.data && secondResponse.data.status) {
                return { success: true, data: secondResponse.data };
            } else {
                return { 
                    success: false, 
                    message: "Registration successful but auth failed. Please scan fingerprint again." 
                };
            }
        } else {
            return { 
                success: false, 
                message: regResponse.data?.message || "Merchant 2FA Registration Failed" 
            };
        }
    }
    
    // Check if auth was successful
    if (twfResponse.data && twfResponse.data.status) {
        return { success: true, data: twfResponse.data };
    } else {
        return { 
            success: false, 
            message: twfResponse.data?.message || "Merchant 2FA Auth Failed" 
        };
    }
};

export const balanceEnquiry = async (req, res) => {
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, latitude, longitude, pipe } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData) {
            return res.status(400).json({ 
                success: false,
                message: "Aadhaar number, Bank IIN, and Biometric PidData are required." 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
            referenceno: `REF${Date.now()}`,
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            submerchantid: String(retailer.retailerId),
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, mobileNumber || retailer.contactNumber),
            is_iris: "No"
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/balanceenquiry/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

        if (response.data && response.data.status) {
            return res.status(200).json({
                success: true,
                message: "Balance fetched successfully",
                data: response.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data?.message || "Failed to fetch balance",
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

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const token = generatePaySprintToken();
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/banklist/index`, 
            {}, 
            { headers, validateStatus: () => true }
        );

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
            // Return cached banks as fallback
            if (cachedAepsBanks) {
                return res.status(200).json({
                    success: true,
                    message: "Bank list fetched from fallback cache",
                    data: cachedAepsBanks
                });
            }
            return res.status(400).json({
                success: false,
                message: response.data?.message || "Failed to fetch bank list",
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
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, merchantPidData, amount, latitude, longitude, bankName, customerName, pipe } = req.body;
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

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const referenceNo = `CW${Date.now()}`;

        // 1. Merchant 2FA (Txn Auth) - Using the improved helper function
        if (merchantPidData) {
            const authResult = await performMerchantAuth(merchantPidData, retailer, req);
            if (!authResult.success) {
                return res.status(400).json({ 
                    success: false, 
                    message: authResult.message || "Merchant 2FA Auth Failed" 
                });
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
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
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
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, mobileNumber || retailer.contactNumber)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/authcashwithdraw/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

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
                message: response.data?.message || "Cash withdrawal failed",
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
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, latitude, longitude, pipe } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData) {
            return res.status(400).json({ success: false, message: "Required fields missing." });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
            referenceno: `MS${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            requestremarks: "Mini Statement",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            submerchantid: String(retailer.retailerId),
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, mobileNumber || retailer.contactNumber)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/ministatement/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

        if (response.data && response.data.status) {
            return res.status(200).json({ 
                success: true, 
                message: "Mini Statement fetched", 
                data: response.data 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: response.data?.message || "Failed to fetch mini statement", 
                data: response.data 
            });
        }
    } catch (error) {
        console.error("Mini Statement Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};

export const cashDeposit = async (req, res) => {
    let session = null;
    try {
        const { latitude, longitude, mobileNumber, aadhaarNumber, bankIIN, pidData, merchantPidData, amount, bankName, customerName, pipe } = req.body;

        if (!aadhaarNumber || !bankIIN || !pidData || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: "Aadhaar number, bank IIN, PID Data, and amount are required" 
            });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const referenceNo = `CD${Date.now()}`;

        // 1. Merchant 2FA (Txn Auth) - Using the improved helper function
        if (merchantPidData) {
            const authResult = await performMerchantAuth(merchantPidData, retailer, req);
            if (!authResult.success) {
                return res.status(400).json({ 
                    success: false, 
                    message: authResult.message || "Merchant 2FA Auth Failed" 
                });
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
            return res.status(400).json({ 
                success: false, 
                message: error.message || "Insufficient Main Wallet balance for Cash Deposit" 
            });
        }

        // 3. Make the API Call to PaySprint
        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
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
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, mobileNumber || retailer.contactNumber)
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
            response = await axios.post(
                `${baseUrl}/service/cashdeposit/V3/Cashdeposit/index`, 
                { body: encryptedData }, 
                { headers, validateStatus: () => true }
            );
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
        if (txnStatus === 'SUCCESS') {
            session = await mongoose.startSession();
            session.startTransaction();
            await Transaction.findOneAndUpdate(
                { transactionId: referenceNo }, 
                { 
                    status: 'SUCCESS',
                    'metadata.paysprintRef': paysprintRef,
                    'metadata.apiMessage': apiMessage
                },
                { session }
            );

            await session.commitTransaction();
            session.endSession();

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

            // Use the existing session from the top
            session = await mongoose.startSession();
            session.startTransaction();

            await Transaction.findOneAndUpdate(
                { transactionId: referenceNo }, 
                { 
                    status: 'FAILED',  // <-- Should be FAILED, not SUCCESS
                    'metadata.apiMessage': apiMessage
                },
                { session }
            );

            await session.commitTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: apiMessage || "Cash deposit failed"
            });
        }
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Cash Deposit Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error during cash deposit" 
        });
    }
};

export const cashWithdrawalTxnStatus = async (req, res) => {
    try {
        const { reference } = req.body;
        if (!reference) return res.status(400).json({ 
            success: false, 
            message: "reference is required" 
        });

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const payload = { reference };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
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

        return res.status(200).json({ 
            success: true, 
            data: response.data 
        });
    } catch (error) {
        console.error("AEPS Txn Status Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};

export const sendMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaar) {
            return res.status(400).json({ 
                success: false, 
                message: "merchantcode and aadhaar required" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        let mobile = "9999999999";
        const user = await Retailer.findOne({ retailerId: merchantcode }) || 
                     await Distributor.findOne({ distributorId: merchantcode });
        if (user && user.contactNumber) mobile = user.contactNumber;

        const payload = {
            merchantcode,
            submerchantid: merchantcode,
            mobile,
            mobilenumber: mobile,
            accessmode: "SITE",
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            aadhaar,
            adhaarnumber: aadhaar,
            pipe: await getVerifiedPipe(merchantcode, mobile)
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/v3/merchantkyc/send_otp`, 
            payload, 
            { headers, validateStatus: () => true }
        );

        return res.status(200).json({ 
            success: true, 
            data: response.data 
        });
    } catch (error) {
        console.error("Send OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};

export const resendMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude, stateresp, ekyc_id } = req.body;
        if (!merchantcode || !ekyc_id) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        let mobile = "9999999999";
        const user = await Retailer.findOne({ retailerId: merchantcode }) || 
                     await Distributor.findOne({ distributorId: merchantcode });
        if (user && user.contactNumber) mobile = user.contactNumber;

        const payload = {
            merchantcode,
            submerchantid: merchantcode,
            mobile,
            mobilenumber: mobile,
            aadhaar,
            adhaarnumber: aadhaar,
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            stateresp,
            ekyc_id,
            accessmode: "SITE",
            pipe: await getVerifiedPipe(merchantcode, mobile)
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/v3/merchantkyc/resend_otp`, 
            payload, 
            { headers, validateStatus: () => true }
        );

        return res.status(200).json({ 
            success: true, 
            data: response.data 
        });
    } catch (error) {
        console.error("Resend OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};

export const verifyMerchantOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude, otp, stateresp, ekyc_id, pidData } = req.body;
        if (!merchantcode || !otp || !pidData) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        
        // pidData needs to be AES encrypted for this specific endpoint.
        const encryptedPidData = encryptPayload(pidData);

        let mobile = "9999999999";
        const user = await Retailer.findOne({ retailerId: merchantcode }) || 
                     await Distributor.findOne({ distributorId: merchantcode });
        if (user && user.contactNumber) mobile = user.contactNumber;

        const payload = {
            merchantcode,
            submerchantid: merchantcode,
            mobile,
            mobilenumber: mobile,
            aadhaar,
            adhaarnumber: aadhaar,
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            otp,
            stateresp,
            ekyc_id,
            piddata: encryptedPidData,
            accessmode: "SITE",
            pipe: await getVerifiedPipe(merchantcode, mobile)
        };

        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(
            `${baseUrl}/service/aeps/v3/merchantkyc/verify_otp`, 
            payload, 
            { headers, validateStatus: () => true }
        );

        if (response.data && response.data.status) {
            // Update the Retailer's KYC completion status
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { isMerchantKycComplete: true }
            );
        }

        return res.status(200).json({ 
            success: true, 
            data: response.data 
        });
    } catch (error) {
        console.error("Verify OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};

export const dailyAuth = async (req, res) => {
    try {
        const { merchantcode, aadhaarNumber, mobileNumber, pidData, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaarNumber || !pidData) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing for Daily Auth" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        
        let actualMobile = mobileNumber;
        if (!mobileNumber || mobileNumber === "9999999999") {
            const user = await Retailer.findOne({ retailerId: merchantcode }) || 
                         await Distributor.findOne({ distributorId: merchantcode });
            if (user && user.contactNumber) {
                actualMobile = user.contactNumber;
            }
        }

        // Determine which pipe to use
        const pipe = await getVerifiedPipe(merchantcode, actualMobile);
        console.log(`[DailyAuth] Using pipe: ${pipe}`);

        const payload = {
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            mobilenumber: actualMobile || "9999999999",
            referenceno: `AUTH${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: aadhaarNumber,
            accessmodetype: "SITE",
            data: pidData,
            submerchantid: merchantcode,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            is_iris: "No",
            pipe: pipe
        };

        console.log("========== DAILY AUTH PAYLOAD ==========");
        console.log(JSON.stringify(payload, null, 2));
        console.log("========================================");

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        // First attempt: Try daily auth login
        let response = await axios.post(
            `${baseUrl}/service/aeps/kyc/Twofactorkyc/auth_login`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

        let resultData = response.data;
        console.log(`[DailyAuth] Auth response code: ${resultData?.response_code}`);
        console.log(`[DailyAuth] Auth response:`, JSON.stringify(resultData, null, 2));

        // Check if registration is needed
        const needsRegistration = resultData && (
            resultData.response_code === 2 || 
            resultData.response_code === 24 || 
            (resultData.message && resultData.message.toLowerCase().includes('registration is pending')) ||
            (resultData.message && resultData.message.toLowerCase().includes('not registered'))
        );

        if (needsRegistration) {
            console.log(`[DailyAuth] Registration pending detected. Attempting auto-registration for pipe ${pipe}...`);
            
            // Create registration payload with NEW reference number
            const regPayload = { 
                ...payload, 
                referenceno: `REG${Date.now()}` 
            };
            
            const regEncryptedData = encryptPayload(JSON.stringify(regPayload));
            
            // Generate a NEW JWT token for registration
            const regToken = generatePaySprintToken();
            const regHeaders = {
                'Token': regToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };
            
            console.log(`[DailyAuth] Registration payload:`, JSON.stringify(regPayload, null, 2));
            
            try {
                const regResponse = await axios.post(
                    `${baseUrl}/service/aeps/kyc/Twofactorkyc/register_agent`, 
                    { body: regEncryptedData }, 
                    { headers: regHeaders, validateStatus: () => true }
                );
                
                console.log(`[DailyAuth] Registration response:`, JSON.stringify(regResponse.data, null, 2));
                
                const regData = regResponse.data;
                
                // Check if registration was successful (response_code 1)
                if (regData && regData.response_code === 1) {
                    // Registration successful! Now try the login again
                    console.log(`[DailyAuth] Registration successful! Attempting login again...`);
                    
                    // Re-generate token for the second auth attempt
                    const secondToken = generatePaySprintToken();
                    const secondHeaders = {
                        'Token': secondToken,
                        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                        'Content-Type': 'application/json'
                    };
                    
                    // Use the ORIGINAL auth payload (with AUTH reference, not REG)
                    const secondEncrypted = encryptPayload(JSON.stringify(payload));
                    
                    const secondResponse = await axios.post(
                        `${baseUrl}/service/aeps/kyc/Twofactorkyc/auth_login`,
                        { body: secondEncrypted },
                        { headers: secondHeaders, validateStatus: () => true }
                    );
                    
                    const secondResult = secondResponse.data;
                    console.log(`[DailyAuth] Second auth attempt response:`, JSON.stringify(secondResult, null, 2));
                    
                    if (secondResult && secondResult.status) {
                        // Update merchant's daily auth date
                        await Retailer.findOneAndUpdate(
                            { retailerId: merchantcode },
                            { lastDailyAuthDate: new Date() }
                        );
                        
                        return res.status(200).json({ 
                            success: true, 
                            message: "Registration and Daily Auth Successful!", 
                            data: secondResult 
                        });
                    } else {
                        return res.status(400).json({ 
                            success: false, 
                            message: "Registration successful but login failed. Please scan your fingerprint ONE MORE TIME.", 
                            data: secondResult 
                        });
                    }
                } else {
                    // Registration failed
                    return res.status(400).json({ 
                        success: false, 
                        message: regData?.message || "2FA Registration Failed. Please contact support.", 
                        data: regData 
                    });
                }
            } catch (regError) {
                console.error(`[DailyAuth] Registration API error:`, regError?.response?.data || regError.message);
                return res.status(500).json({ 
                    success: false, 
                    message: "Registration API error: " + (regError?.response?.data?.message || regError.message),
                    error: regError?.response?.data || regError.message
                });
            }
        }

        // Handle successful login (no registration needed)
        if (resultData && resultData.status) {
            // Update the Retailer's last daily auth date tracker
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { lastDailyAuthDate: new Date() }
            );
            return res.status(200).json({ 
                success: true, 
                message: "Daily Auth Successful", 
                data: resultData 
            });
        } else {
            // Login failed for other reasons
            return res.status(400).json({ 
                success: false, 
                message: resultData?.message || "Daily Auth Failed", 
                data: resultData 
            });
        }
    } catch (error) {
        console.error("Daily Auth Error:", error?.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error during Daily Auth", 
            error: error?.response?.data || error.message 
        });
    }
};

export const getMerchantStatus = async (req, res) => {
    try {
        const { merchantcode } = req.query;
        if (!merchantcode) {
            return res.status(400).json({ 
                success: false, 
                message: "merchantcode query param is required" 
            });
        }

        const retailer = await Retailer.findOne({ retailerId: merchantcode });
        if (!retailer) {
            return res.status(404).json({ 
                success: false, 
                message: "Retailer not found" 
            });
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

        // Check PaySprint Onboard Status for pipes
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const pipesToCheck = ['bank3', 'bank2', 'bank1', 'bank5'];
        const activePipes = [];

        try {
            const statusPromises = pipesToCheck.map(pipe => {
                return axios.post(
                    `${baseUrl}/service/onboard/onboard/getonboardstatus`,
                    {
                        merchantcode: merchantcode,
                        mobile: String(retailer.contactNumber || retailer.phone), // Try both fields
                        pipe: pipe
                    },
                    { headers, validateStatus: () => true }
                );
            });

            const results = await Promise.allSettled(statusPromises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const responseData = result.value.data;
                    if (responseData && 
                        responseData.response_code === 1 && 
                        (responseData.is_approved === 'Accepted')) {
                        activePipes.push(pipesToCheck[index]);
                    }
                }
            });
            
            // Fallback just in case the API fails but they have completed KYC locally
            if (activePipes.length === 0 && retailer.isMerchantKycComplete) {
                activePipes.push('bank3');
            }
        } catch (err) {
            console.error("Error checking pipe status:", err);
            if (retailer.isMerchantKycComplete) activePipes.push('bank3');
        }

        return res.status(200).json({
            success: true,
            data: {
                isMerchantKycComplete: retailer.isMerchantKycComplete || false,
                isDailyAuthDoneToday: isDailyAuthDoneToday,
                lastDailyAuthDate: retailer.lastDailyAuthDate,
                activePipes: activePipes.length > 0 ? activePipes : ['bank3']
            }
        });
    } catch (error) {
        console.error("Get Merchant Status Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Error", 
            error: error.message 
        });
    }
};
