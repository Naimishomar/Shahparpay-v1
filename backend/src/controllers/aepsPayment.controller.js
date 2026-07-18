import axios from 'axios';
import mongoose from 'mongoose';
import { generatePaySprintToken, encryptPayload } from '../utils/paysprint.util.js';
import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Transaction from "../models/transaction.model.js";
import GlobalSettings from '../models/globalSettings.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import Admin from '../models/users/admin.model.js';

// Helper function to resolve which bank pipe is verified for the merchant
export const getVerifiedPipe = async (merchantcode, mobile) => {
    // Check pipes in order of preference. We prioritize bank1 and bank5
    // because bank2 (older gateway) often rejects L1 scanners providing FIR+FMR data.
    const pipesToCheck = ['bank1', 'bank5', 'bank6', 'bank2'];
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

    for (const pipe of pipesToCheck) {
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
    
    console.log(`[getVerifiedPipe] No verified pipes found, defaulting to bank2`);
    return 'bank2';
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
        is_iris: "No"
    };

    const twfToken = generatePaySprintToken();
    const twfEncrypted = encryptPayload(JSON.stringify(twfPayload));
    const twfHeaders = {
        'Token': twfToken,
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };

    console.log(`[MerchantAuth Request] Payload:`, JSON.stringify(twfPayload, null, 2));

    const twfResponse = await axios.post(
        `${baseUrl}/service/aeps/kyc/Twofactorkyc/authentication`, 
        { body: twfEncrypted }, 
        { headers: twfHeaders, validateStatus: () => true }
    );
    
    console.log(`[MerchantAuth Response]`, JSON.stringify(twfResponse.data, null, 2));
    
    // Check if registration is needed
    if (twfResponse.data && 
        (twfResponse.data.response_code === 2 || 
         twfResponse.data.response_code === 24 || 
         (twfResponse.data.message && twfResponse.data.message.toLowerCase().includes('registration is pending')))) {
        
        console.log(`[MerchantAuth] Registration pending, attempting auto-register...`);
        
        const regPayload = { 
            ...twfPayload, 
            referenceno: `REG${Date.now()}`
        };
        const regEncrypted = encryptPayload(JSON.stringify(regPayload));
        const regToken = generatePaySprintToken();
        const regHeaders = {
            'Token': regToken,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };
        
        const regResponse = await axios.post(
            `${baseUrl}/service/aeps/kyc/Twofactorkyc/registration`,
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
            const secondPayload = { ...twfPayload, referenceno: `AUTH${Date.now()}` };
            const secondEncrypted = encryptPayload(JSON.stringify(secondPayload));
            const secondResponse = await axios.post(
                `${baseUrl}/service/aeps/kyc/Twofactorkyc/authentication`,
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
                message: regResponse.data?.message || "Merchant 2FA Registration Failed",
                needsWebOnboarding: true
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
            ipaddress: req.ip ? (req.ip === '::1' ? '127.0.0.1' : req.ip.replace(/^::ffff:/, '')) : "127.0.0.1",
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            nationalbankidentification: Number(bankIIN),
            requestremarks: "Balance Enquiry",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            transactiontype: "BE",
            submerchantid: String(retailer.retailerId),
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, retailer.contactNumber)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        console.log(`[Balance Enquiry Request] Payload:`, JSON.stringify({ ...payload, data: "HIDDEN_PID_DATA" }, null, 2));

        const response = await axios.post(
            `${baseUrl}/service/aeps/balanceenquiry/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );
        
        console.log(`[Balance Enquiry Response]`, JSON.stringify(response.data, null, 2));

        if (response.data && response.data.status) {
            return res.status(200).json({
                success: true,
                message: "Balance fetched successfully",
                data: response.data
            });
        } else {
            console.error("AEPS Balance Enquiry API Error:", JSON.stringify(response.data, null, 2));
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

        // Fetch retailer for Merchant Auth (no longer strictly required by new Authencity endpoints, but used for fallback contact)
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const referenceNo = `CW${Date.now()}`;

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
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, retailer.contactNumber)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        console.log(`[Cash Withdrawal Request] Payload:`, JSON.stringify({ ...payload, data: "HIDDEN_PID_DATA" }, null, 2));

        const response = await axios.post(
            `${baseUrl}/service/aeps/authcashwithdraw/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );
        
        console.log(`[Cash Withdrawal Response]`, JSON.stringify(response.data, null, 2));

        let txnStatus = (response.data && response.data.status) ? 'SUCCESS' : 'FAILED';
        let paysprintRef = response.data?.data?.ackno || response.data?.data?.rrn || null;
        
        // 3. Atomically update Wallet & Transaction if SUCCESS
        if (txnStatus === 'SUCCESS') {
            session = await mongoose.startSession();
            session.startTransaction();
            
            // Fetch GlobalSettings for Commission Rates
            let settings = await GlobalSettings.findOne({});
            let retailerPct = 0;
            let distributorPct = 0;
            let totalApiPct = 0.45;
            if (settings && settings.aepsCommission) {
                retailerPct = settings.aepsCommission.retailerPercentage || 0;
                distributorPct = settings.aepsCommission.distributorPercentage || 0;
                totalApiPct = settings.aepsCommission.totalApiPercentage || 0.45;
            }

            const numericAmount = Number(amount);
            const totalCommission = numericAmount * (totalApiPct / 100);
            const retailerCommission = numericAmount * (retailerPct / 100);
            const distributorCommission = numericAmount * (distributorPct / 100);
            const adminCommission = totalCommission - retailerCommission - distributorCommission;

            // Fetch Retailer to get distributorId
            const retailer = await Retailer.findById(req.user.id);
            const distId = retailer ? retailer.distributorId : null;

            // Update Retailer AepsWallet (Principal + Retailer Commission)
            await AepsWallet.findOneAndUpdate(
                { userId: req.user.id, userModel: 'Retailer' },
                { $inc: { balance: numericAmount + retailerCommission } },
                { upsert: true, session }
            );

            // Update Distributor AepsWallet
            if (distId && distributorCommission > 0) {
                await AepsWallet.findOneAndUpdate(
                    { userId: distId, userModel: 'Distributor' },
                    { $inc: { balance: distributorCommission } },
                    { upsert: true, session }
                );
            }

            // Update AdminWallet
            const admin = await Admin.findOne({});
            if (admin && adminCommission > 0) {
                await AdminWallet.findOneAndUpdate(
                    { userId: admin._id },
                    { $inc: { balance: adminCommission } },
                    { upsert: true, session }
                );
            }

            // Update Transaction
            newTxn.status = 'SUCCESS';
            newTxn.transactionId = paysprintRef || newTxn.transactionId;
            newTxn.commissions = {
                ...newTxn.commissions,
                retailerEarned: retailerCommission,
                distributorEarned: distributorCommission,
                adminEarned: adminCommission
            };
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

export const aadhaarPay = async (req, res) => {
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
        const referenceNo = `AP${Date.now()}`;

        // 2. Create PENDING Transaction (Idempotency)
        let newTxn = await Transaction.create({
            transactionId: referenceNo,
            userId: req.user.id,
            type: 'AADHAAR_PAY',
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
            requestremarks: "Aadhaar Pay",
            data: pidData,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            transactiontype: "M", // PaySprint standard for Aadhaar Pay
            submerchantid: String(retailer.retailerId),
            amount: Number(amount),
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, retailer.contactNumber)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        console.log(`[Aadhaar Pay Request] Payload:`, JSON.stringify({ ...payload, data: "HIDDEN_PID_DATA" }, null, 2));

        const response = await axios.post(
            `${baseUrl}/service/aadharpay/aadharpay/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );
        
        console.log(`[Aadhaar Pay Response]`, JSON.stringify(response.data, null, 2));

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
                { $inc: { balance: Number(amount) } }, // Crediting the full amount to merchant
                { upsert: true, session }
            );

            // Update Transaction
            newTxn.status = 'SUCCESS';
            newTxn.transactionId = paysprintRef || newTxn.transactionId;
            // The amount is already set in the newTxn creation
            if (paysprintRef) {
                newTxn.metadata = { 
                    ...newTxn.metadata, 
                    paysprintRef
                };
            }
            await newTxn.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: "Aadhaar Pay successful",
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
                message: response.data?.message || "Aadhaar Pay failed",
                data: response.data
            });
        }
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("AEPS Aadhaar Pay Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AEPS Aadhaar Pay request",
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
            transactiontype: "MS",
            submerchantid: String(retailer.retailerId),
            is_iris: "No",
            pipe: pipe || await getVerifiedPipe(retailer.retailerId, retailer.contactNumber)
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
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
            accessmodetype: "SITE",
            adhaarnumber: String(aadhaarNumber),
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            referenceno: referenceNo,
            nationalbankidentification: Number(bankIIN),
            submerchantid: String(retailer.retailerId),
            data: pidData,
            timestamp: Math.floor(Date.now() / 1000),
            amount: Number(amount)
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
            ipaddress: req.ip ? (req.ip === '::1' ? '127.0.0.1' : req.ip.replace(/^::ffff:/, '')) : "127.0.0.1",
            adhaarnumber: aadhaarNumber,
            accessmodetype: "SITE",
            data: pidData,
            submerchantid: merchantcode,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            is_iris: "No"
        };
        
        // Only attach pipe parameter if not using bank3 specific endpoint
        if (pipe !== 'bank3') {
            payload.pipe = pipe;
        }

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
        const authEndpoint = pipe === 'bank3' ? '/service/aeps/kyc/Twofactorkyc/auth_login' : '/service/aeps/kyc/Twofactorkyc/authentication';
        let response = await axios.post(
            `${baseUrl}${authEndpoint}`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

        let resultData = response.data;
        console.log(`[DailyAuth] Auth response code: ${resultData?.response_code}`);
        console.log(`[DailyAuth] Auth response:`, JSON.stringify(resultData, null, 2));

        // Check if the merchant is onboarded but not registered for 2FA
        // Sometimes authentication returns 24 even when onboarded, but registration might work
        const needsRegistration = resultData && (
            resultData.response_code === 2 || 
            resultData.response_code === 24 || 
            (resultData.message && resultData.message.toLowerCase().includes('registration is pending')) ||
            (resultData.message && resultData.message.toLowerCase().includes('not registered')) ||
            (resultData.message && resultData.message.toLowerCase().includes('onboading is pending'))
        );

        if (needsRegistration) {
            console.log(`[DailyAuth] Registration pending detected. Attempting auto-registration...`);
            
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
                const regEndpoint = pipe === 'bank3' ? '/service/aeps/kyc/Twofactorkyc/register_agent' : '/service/aeps/kyc/Twofactorkyc/registration';
                const regResponse = await axios.post(
                    `${baseUrl}${regEndpoint}`, 
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
                    
                    // Use a NEW auth payload (with new AUTH reference, not REG)
                    const secondPayload = { ...payload, referenceno: `AUTH${Date.now()}` };
                    const secondEncrypted = encryptPayload(JSON.stringify(secondPayload));
                    
                    const secondResponse = await axios.post(
                        `${baseUrl}${authEndpoint}`,
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
                        // If second auth fails, the merchant might need to complete web onboarding
                        return res.status(400).json({ 
                            success: false, 
                            message: "Registration successful but login failed. Please complete Web Onboarding first.", 
                            data: secondResult,
                            needsWebOnboarding: true,
                            pipe: pipe
                        });
                    }
                } else if (regData && regData.response_code === 24) {
                    // Registration returned 24 - merchant needs web onboarding
                    return res.status(400).json({ 
                        success: false, 
                        message: "Merchant needs to complete Web Onboarding first.", 
                        data: regData,
                        needsWebOnboarding: true,
                        pipe: pipe
                    });
                } else {
                    // Registration failed for other reasons
                    return res.status(400).json({ 
                        success: false, 
                        message: regData?.message || "2FA Registration Failed. Please complete Web Onboarding.", 
                        data: regData,
                        needsWebOnboarding: true,
                        pipe: pipe
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
            // Check if the merchant needs web onboarding
            const needsWebOnboarding = resultData && (
                resultData.response_code === 24 ||
                (resultData.message && resultData.message.toLowerCase().includes('onboading is pending'))
            );
            
            return res.status(400).json({ 
                success: false, 
                message: resultData?.message || "Daily Auth Failed", 
                data: resultData,
                needsWebOnboarding: needsWebOnboarding,
                pipe: pipe
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

export const syncMerchantPipes = async (merchantcode) => {
    try {
        const retailer = await Retailer.findOne({ retailerId: merchantcode });
        if (!retailer) return [];

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const token = generatePaySprintToken();
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const pipesToCheck = ['bank2', 'bank1', 'bank5', 'bank6', 'bank3'];
        const activePipes = [];
        let isActuallyOnboarded = false;

        const statusPromises = pipesToCheck.map(pipe => {
            return axios.post(
                `${baseUrl}/service/onboard/onboard/getonboardstatus`,
                {
                    merchantcode: merchantcode,
                    mobile: String(retailer.contactNumber),
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
                    responseData.is_approved === 'Accepted') {
                    activePipes.push(pipesToCheck[index]);
                    isActuallyOnboarded = true;
                }
            }
        });
        
        await Retailer.findOneAndUpdate(
            { retailerId: merchantcode },
            { 
                isMerchantKycComplete: isActuallyOnboarded ? true : retailer.isMerchantKycComplete,
                activeAepsPipes: activePipes,
                lastPipeCheckDate: new Date()
            }
        );
        
        return activePipes;
    } catch (err) {
        console.error("Error checking pipe status in background:", err);
        return [];
    }
};

export const getMerchantStatus = async (req, res) => {
    try {
        const { merchantcode, forceRefresh } = req.query;
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

        let activePipes = retailer.activeAepsPipes || [];
        
        // If no pipes are cached, or forceRefresh is true, fetch them now
        if (activePipes.length === 0 || forceRefresh === 'true') {
            activePipes = await syncMerchantPipes(merchantcode);
        }

        return res.status(200).json({
            success: true,
            data: {
                isMerchantKycComplete: retailer.isMerchantKycComplete || false,
                isDailyAuthDoneToday: isDailyAuthDoneToday,
                lastDailyAuthDate: retailer.lastDailyAuthDate,
                activePipes: activePipes
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

export const getPidOptions = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }
        
        const pipe = await getVerifiedPipe(retailer.retailerId, retailer.contactNumber);
        
        let targetWadh = "E0jzJ/P8UopUHAieZn8CKqS4WPMi5ZSYXgfnlfkWjrc="; // Bank 1, 5, 6
        if (pipe === 'bank2') {
            targetWadh = "18f4CEiXeXcfGXvgWA/blxD+w2pw7hfQPY45JMytkPw=";
        }

        return res.status(200).json({ 
            success: true, 
            pipe: pipe,
            wadh: targetWadh 
        });
    } catch (error) {
        console.error("[getPidOptions] Error:", error);
        return res.status(500).json({ success: false, message: "Failed to get PID options" });
    }
};

export const activateMerchant = async (req, res) => {
    try {
        const { merchantcode, aadhaar, dob, pidData, pipe, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaar || !dob || !pidData || !pipe) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing (merchantcode, aadhaar, dob, pidData, pipe)" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const currentToken = generatePaySprintToken();
        const encryptedPidData = encryptPayload(pidData);

        const payload = {
            merchantcode,
            aadhaar,
            piddata: encryptedPidData,
            dob, // YYYY/MM/DD
            is_casa: "0",
            pipe, // bank2, bank5, bank6
            accessmode: "SITE",
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025"
        };

        const headers = {
            'Token': currentToken,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/onboard/onboard/activate_merchant`, payload, { headers });

        if (response.data && response.data.status === true && response.data.response_code == "1") {
            // Check if we should update DB
            return res.status(200).json({
                success: true,
                message: response.data.message || "Merchant Activated Successfully",
                data: response.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || "Activation failed",
                data: response.data
            });
        }
    } catch (error) {
        console.error("Activate Merchant Error:", error?.response?.data || error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Server Error during activation", 
            error: error?.response?.data || error.message 
        });
    }
};

