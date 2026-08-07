import axios from 'axios';
import mongoose from 'mongoose';
import { generatePaySprintToken, encryptPayload, getOnboardStatusEndpoint } from '../utils/paysprint.util.js';
import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Transaction from "../models/transaction.model.js";
import { applyAepsWithdrawalSuccess, queryAepsTransactionStatus } from '../utils/wallet.util.js';

// AEPS transaction OTP is required when the withdrawal amount is greater
// than this threshold (PaySprint rule). At or below it, no OTP is needed.
export const AEPS_OTP_THRESHOLD = 5000;

// Helper function to resolve which bank pipe is verified for the merchant
export const getVerifiedPipe = async (merchantcode, mobile) => {
    // Check pipes in order of preference. We prioritize bank1 and bank5
    // because bank2 (older gateway) often rejects L1 scanners providing FIR+FMR data.
    // Note: bank1 is UAT-only and intentionally excluded.
    const pipesToCheck = ['bank2', 'bank3', 'bank4', 'bank5', 'bank6'];

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

            const res = await axios.post(getOnboardStatusEndpoint(pipe), {
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
            `${baseUrl}/service/aeps/v3/balanceenquiry/index`, 
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

// Initiates the AEPS transaction OTP (AePS Transaction Initiate OTP API).
// Required for AEPS cash withdrawals above ₹5000 (see AEPS_OTP_THRESHOLD).
// The OTP is delivered to the customer's registered mobile number. The SAME
// referenceNo must be reused in the subsequent cash-withdrawal call so
// PaySprint can match the otp_refid.
export const initiateAepsTxnOtp = async (req, res) => {
    try {
        const { aadhaarNumber, bankIIN, mobileNumber, amount, latitude, longitude, pipe, transactiontype, referenceNo: txnReferenceNo } = req.body;
        if (!aadhaarNumber || !bankIIN || !mobileNumber || !amount) {
            return res.status(400).json({
                success: false,
                message: "Aadhaar number, Bank IIN, Mobile number, and Amount are required."
            });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const txnType = transactiontype || 'CW';
        const referenceNo = txnReferenceNo || `${txnType}${Date.now()}`;

        // Reserve/reuse the PENDING transaction with the same reference used by the withdrawal,
        // so OTP retries (resend) don't leave orphaned PENDING transactions behind.
        let newTxn = null;
        if (txnReferenceNo) {
            newTxn = await Transaction.findOne({ transactionId: txnReferenceNo, userId: req.user.id });
        }
        if (!newTxn) {
            newTxn = await Transaction.create({
                transactionId: referenceNo,
                userId: req.user.id,
                type: txnType === 'AP' ? 'AADHAAR_PAY' : 'AEPS_WITHDRAWAL',
                amount: Number(amount),
                status: 'PENDING',
                metadata: {
                    aadhaar: aadhaarNumber,
                    bankIIN: bankIIN,
                    mobile: mobileNumber,
                    otpInitiated: true
                }
            });
        } else {
            newTxn.status = 'PENDING';
            newTxn.amount = Number(amount);
            newTxn.metadata = {
                ...newTxn.metadata,
                aadhaar: aadhaarNumber,
                bankIIN: bankIIN,
                mobile: mobileNumber,
                otpInitiated: true
            };
            await newTxn.save();
        }

        const resolvedPipe = pipe || await getVerifiedPipe(retailer.retailerId, retailer.contactNumber);

        const payload = {
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(mobileNumber || retailer.contactNumber || "9999999999"),
            referenceno: referenceNo,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: String(aadhaarNumber),
            nationalbankidentification: Number(bankIIN),
            pipe: resolvedPipe,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            transactiontype: txnType,
            submerchantid: String(retailer.retailerId),
            amount: Number(amount)
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));

        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        console.log(`[AePS Transaction OTP Request] Payload:`, JSON.stringify(payload, null, 2));

        const response = await axios.post(
            `${baseUrl}/service/aeps/txnotp/index`,
            { body: encryptedData },
            { headers, validateStatus: () => true }
        );

        console.log(`[AePS Transaction OTP Response]`, JSON.stringify(response.data, null, 2));

        const otpRefId = response.data?.otp_refid || response.data?.data?.otp_refid;

        // PaySprint may report success via `status: true` or `response_code: 1`
        const isOtpSuccess = response.data && (
            response.data.status === true ||
            response.data.response_code === 1 ||
            response.data.response_code === "1"
        );

        if (isOtpSuccess && otpRefId) {
            newTxn.metadata = { ...newTxn.metadata, otpRefId, otpInitiatedAt: new Date().toISOString() };
            await newTxn.save();

            return res.status(200).json({
                success: true,
                message: response.data.message || "OTP sent successfully",
                data: {
                    otpRefId,
                    referenceNo
                }
            });
        }

        // OTP initiation failed - don't leave a dangling PENDING transaction
        newTxn.status = 'FAILED';
        await newTxn.save();

        return res.status(400).json({
            success: false,
            message: response.data?.message || "Failed to initiate AEPS transaction OTP",
            data: response.data
        });
    } catch (error) {
        console.error("AEPS Transaction OTP Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AEPS OTP initiation",
            error: error?.response?.data || error.message
        });
    }
};

export const cashWithdrawal = async (req, res) => {
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, merchantPidData, amount, latitude, longitude, bankName, customerName, pipe, referenceNo: txnReferenceNo, otpRefId } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData || !amount) {
            return res.status(400).json({ 
                success: false,
                message: "Aadhaar number, Bank IIN, Biometric PidData, and Amount are required." 
            });
        }

        // AEPS transaction OTP is mandatory only for withdrawals above ₹5000.
        // Enforce it server-side so the OTP flow can't be bypassed.
        if (Number(amount) > AEPS_OTP_THRESHOLD && !otpRefId) {
            return res.status(400).json({
                success: false,
                message: `AEPS transaction OTP is mandatory for withdrawals above ₹${AEPS_OTP_THRESHOLD}. Please send the OTP and try again.`
            });
        }

        // Fetch retailer for Merchant Auth (no longer strictly required by new Authencity endpoints, but used for fallback contact)
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        const referenceNo = txnReferenceNo || `CW${Date.now()}`;

        // 2. Create/Reuse PENDING Transaction (Idempotency). When initiated via the AEPS OTP flow,
        // the SAME referenceNo is reused so PaySprint's otp_refid matches this transaction.
        let newTxn = null;
        if (txnReferenceNo) {
            newTxn = await Transaction.findOne({ transactionId: txnReferenceNo, userId: req.user.id });
        }
        if (!newTxn) {
            newTxn = await Transaction.create({
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
        } else {
            newTxn.amount = Number(amount);
            newTxn.metadata = {
                ...newTxn.metadata,
                aadhaar: aadhaarNumber,
                bankIIN: bankIIN,
                bankName: bankName,
                name: customerName,
                mobile: mobileNumber
            };
            // Persist immediately. Without this save, the customer name/bank
            // merged above stays in memory only and is dropped on the SUCCESS
            // path, where applyAepsWithdrawalSuccess re-reads the transaction
            // from the DB (via findOneAndUpdate) before saving.
            await newTxn.save();
        }

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
            otp_refid: otpRefId || undefined,
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

        const responseData = response.data || {};
        const gatewayOk = responseData.status === true ||
            responseData.response_code === 1 ||
            responseData.response_code === "1";
        const paysprintRef = responseData?.data?.ackno || responseData?.data?.rrn || null;
        // Bank-level acknowledgement means the request reached the bank, so a
        // gateway failure is ambiguous (the debit may still have happened).
        const bankTouched = Boolean(responseData.ackno || responseData.bankrrn ||
            responseData.data?.ackno || responseData.data?.rrn);

        // 3a. Gateway confirmed SUCCESS — atomically credit wallets & finalize.
        if (gatewayOk) {
            const credited = await applyAepsWithdrawalSuccess({
                transactionId: newTxn._id,
                userId: req.user.id,
                amount,
                paysprintRef: paysprintRef || undefined,
                message: responseData.message || "Cash withdrawal successful"
            });

            if (!credited) {
                // Already resolved elsewhere — never double-credit.
                return res.status(409).json({
                    success: false,
                    message: "Transaction was already resolved.",
                    data: responseData
                });
            }

            return res.status(200).json({
                success: true,
                message: "Cash withdrawal successful",
                data: responseData
            });
        }

        // 3b. Gateway reported a failure. AEPS is asynchronous at the bank
        // level: a `status:false` response that still carries a bank
        // acknowledgement (ackno/bankrrn) does NOT prove the debit didn't
        // happen. Reconcile against the transaction-status API instead of
        // finalizing as FAILED.
        if (bankTouched) {
            newTxn.status = 'PROCESSING';
            newTxn.metadata = {
                ...newTxn.metadata,
                needsReconciliation: true,
                gatewayMessage: responseData.message || 'Gateway reported failure, bank acknowledgement received',
                ackno: responseData.ackno,
                bankrrn: responseData.bankrrn
            };
            if (paysprintRef) {
                newTxn.metadata.paysprintRef = paysprintRef;
            }
            await newTxn.save();

            let reconciled;
            try {
                reconciled = await queryAepsTransactionStatus(newTxn.transactionId);
            } catch (reconErr) {
                console.error("AEPS Cash Withdrawal status query error:", reconErr.message);
                reconciled = { status: 'PROCESSING' };
            }

            if (reconciled.status === 'SUCCESS') {
                const credited = await applyAepsWithdrawalSuccess({
                    transactionId: newTxn._id,
                    userId: req.user.id,
                    amount,
                    paysprintRef: paysprintRef || undefined,
                    message: reconciled.data?.message || responseData.message || "Cash withdrawal successful"
                });

                if (credited) {
                    return res.status(200).json({
                        success: true,
                        message: "Cash withdrawal successful",
                        data: responseData
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: "Transaction was already resolved.",
                    data: responseData
                });
            }

            if (reconciled.status === 'FAILED') {
                newTxn.status = 'FAILED';
                newTxn.metadata = {
                    ...newTxn.metadata,
                    gatewayMessage: reconciled.data?.message || responseData.message || "Cash withdrawal failed"
                };
                if (paysprintRef) {
                    newTxn.metadata = { ...newTxn.metadata, paysprintRef };
                }
                await newTxn.save();

                return res.status(400).json({
                    success: false,
                    message: responseData.message || "Cash withdrawal failed",
                    data: responseData
                });
            }

            // Still in process at the bank or status query was inconclusive —
            // keep PROCESSING for the reconciliation cron and tell the client
            // the outcome is being verified, not that it failed.
            return res.status(200).json({
                success: false,
                message: "Transaction is being verified. It may have been processed by the bank — status will be updated shortly.",
                data: {
                    ...responseData,
                    verification: 'PENDING',
                    referenceNo: newTxn.transactionId
                }
            });
        }

        // 3c. Clean failure (no bank acknowledgement — validation/auth errors):
        // finalize as FAILED.
        newTxn.status = 'FAILED';
        newTxn.metadata = {
            ...newTxn.metadata,
            gatewayMessage: responseData.message || "Cash withdrawal failed"
        };
        if (paysprintRef) {
            newTxn.metadata = { ...newTxn.metadata, paysprintRef };
        }
        await newTxn.save();

        return res.status(400).json({
            success: false,
            message: responseData.message || "Cash withdrawal failed",
            data: responseData
        });
    } catch (error) {
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
            newTxn.metadata = {
                ...newTxn.metadata,
                gatewayMessage: response.data?.message || "Aadhaar Pay failed"
            };
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
            `${baseUrl}/service/aeps/v3/ministatement/index`, 
            { body: encryptedData }, 
            { headers, validateStatus: () => true }
        );

        if (response.data && response.data.status) {
            // Normalize mini statement entries - PaySprint returns inconsistent field names
            // across pipes. Some return narration in 'date' field and date in 'narration'.
            let ministatement = response.data.ministatement || response.data.data?.ministatement || [];
            if (Array.isArray(ministatement)) {
                ministatement = ministatement.map(entry => {
                    let dateVal = entry.date || entry.txnDate || '';
                    let narration = entry.narration || entry.description || '';
                    const txnType = entry.txnType || entry.type || '';
                    const amount = entry.amount || entry.txnAmount || '0';

                    // Detect if 'date' contains narration text (e.g., 'RS CW 61...')
                    // A valid date usually contains '/' or '-' with digits
                    const looksLikeDate = /^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/.test(dateVal);
                    if (!looksLikeDate && dateVal) {
                        // The 'date' field actually has narration, swap them
                        const temp = narration;
                        narration = dateVal;
                        dateVal = temp || 'N/A';
                    }
                    if (!dateVal) dateVal = 'N/A';

                    return { date: dateVal, narration, txnType, amount };
                });
            }
            response.data.ministatement = ministatement;

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
        const { merchantcode, aadhaar, latitude, longitude, pipe } = req.body;
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
        
        const selectedPipe = pipe || "bank3";

        // ──────────────────────────────────────────────────────────────────────
        // STEP 1: Check if merchant is already onboarded on this pipe.
        //         Bank3 uses Web Onboarding (getonboardurl) — there is NO direct
        //         API endpoint to auto-onboard. If not onboarded or rejected,
        //         we must return an error.
        // ──────────────────────────────────────────────────────────────────────
        try {
            const checkToken = generatePaySprintToken();
            const checkHeaders = {
                'Token': checkToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };
            const statusRes = await axios.post(
                getOnboardStatusEndpoint(selectedPipe),
                { merchantcode, mobile, pipe: selectedPipe },
                { headers: checkHeaders, validateStatus: () => true }
            );
            const statusData = statusRes.data;
            console.log(`[SendOTP] Onboard status for pipe ${selectedPipe}:`, JSON.stringify(statusData));

            const approvalStatus = statusData?.is_approved;

            if (approvalStatus === 'Rejected') {
                return res.status(400).json({
                    success: false,
                    message: `Onboarding has been rejected by the bank for ${selectedPipe}. Please contact the service provider.`,
                    data: statusData
                });
            }

            if (approvalStatus === 'Not-Onboarded' || statusData?.response_code === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Merchant is not onboarded on ${selectedPipe}. Please complete Web KYC first.`,
                    data: statusData
                });
            }

            if (approvalStatus !== 'Accepted' && approvalStatus !== 'Pending' && approvalStatus !== 'In-Process' && approvalStatus !== 'Verification-Pending') {
                console.log(`[SendOTP] Unexpected onboarding status for ${selectedPipe}: ${approvalStatus}. Proceeding anyway.`);
            }
        } catch (onboardErr) {
            console.warn(`[SendOTP] Warning: Could not check onboarding status:`, onboardErr.message);
            // Non-fatal — proceed with OTP attempt
        }

        // ──────────────────────────────────────────────────────────────────────
        // STEP 2: Send OTP for KYC
        // Endpoint + payload match PaySprint /aeps/v3/merchantkyc/send_otp docs.
        // ──────────────────────────────────────────────────────────────────────
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

        console.log("=== SEND OTP DEBUG ===");
        console.log("URL:", `${baseUrl}/service/aeps/v3/merchantkyc/send_otp`);
        console.log("Payload:", JSON.stringify(payload, null, 2));
        console.log("Headers:", JSON.stringify(headers, null, 2));

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
        const { merchantcode, aadhaar, latitude, longitude, stateresp, ekyc_id, pipe } = req.body;
        if (!merchantcode || !ekyc_id) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

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
        const { merchantcode, aadhaar, latitude, longitude, otp, stateresp, ekyc_id, pidData, pipe } = req.body;
        if (!merchantcode || !otp || !pidData) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing" 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
        
        // pidData needs to be AES encrypted for this specific endpoint.
        const encryptedPidData = encryptPayload(pidData);

        // Endpoint + payload match PaySprint /aeps/v3/merchantkyc/verify_otp docs.
        const payload = {
            merchantcode,
            aadhaar,
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            otp,
            stateresp,
            ekyc_id,
            accessmode: "SITE",
            piddata: encryptedPidData
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
            // Update the Retailer's KYC completion status and add to activeAepsPipes
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { 
                    isMerchantKycComplete: true,
                    $addToSet: { activeAepsPipes: pipe }
                }
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

// Charges ₹1 (configurable via DAILY_AUTH_CHARGE_AMOUNT env) from the merchant's
// MAIN wallet once per day after a successful daily 2FA auth. Set amount to 0 to disable.
const deductDailyAuthCharge = async (merchantcode, pipe) => {
    const amount = Number(process.env.DAILY_AUTH_CHARGE_AMOUNT || 1);
    if (!amount || amount <= 0) return { status: 'DISABLED', amount: 0 };

    const retailer = await Retailer.findOne({ retailerId: merchantcode });
    if (!retailer) return { status: 'SKIPPED', amount, message: 'Retailer not found' };

    // Idempotency: only charge once per day (regardless of pipe re-auth)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyCharged = await Transaction.findOne({
        userId: retailer._id,
        type: 'DAILY_AUTH_CHARGE',
        createdAt: { $gte: todayStart }
    });
    if (alreadyCharged) return { status: 'SKIPPED', amount, message: 'Already charged today' };

    const { updateWalletAtomically } = await import('../utils/wallet.util.js');
    const chargeTxnId = `AUTHCHG${Date.now()}${Math.floor(Math.random() * 1000)}`;
    try {
        await updateWalletAtomically(retailer._id, 'MAIN', -amount, {
            transactionId: chargeTxnId,
            userId: retailer._id,
            type: 'DAILY_AUTH_CHARGE',
            amount,
            status: 'SUCCESS',
            metadata: { pipe, note: `Daily 2FA auth charge (₹${amount})` }
        });
        return { status: 'SUCCESS', amount, transactionId: chargeTxnId };
    } catch (err) {
        console.warn(`[DailyAuth] ₹${amount} charge failed for ${merchantcode}:`, err.message);
        return { status: 'FAILED', amount, message: err.message };
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
            latitude: String(latitude || "28.7041"),
            longitude: String(longitude || "77.1025"),
            mobilenumber: String(actualMobile || "9999999999"),
            referenceno: `AUTH${Date.now()}`,
            ipaddress: req.ip ? (req.ip === '::1' ? '127.0.0.1' : req.ip.replace(/^::ffff:/, '')) : "127.0.0.1",
            adhaarnumber: String(aadhaarNumber),
            accessmodetype: "SITE",
            data: pidData,
            submerchantid: String(merchantcode),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            is_iris: "No"
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
                        // Update merchant's daily auth date for this specific pipe
                        const updateData = { lastDailyAuthDate: new Date() };
                        updateData[`dailyAuthDates.${pipe}`] = new Date();
                        
                        await Retailer.findOneAndUpdate(
                            { retailerId: merchantcode },
                            updateData
                        );

                        // Cut ₹1 from the merchant's MAIN wallet for the daily 2FA auth
                        const dailyAuthCharge = await deductDailyAuthCharge(merchantcode, pipe);

                        return res.status(200).json({ 
                            success: true, 
                            message: "Registration and Daily Auth Successful!", 
                            data: secondResult,
                            dailyAuthCharge
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
                    const regMsg = (regData?.message || '').toLowerCase();
                    const isDeviceMapped = regData?.response_code === 26 ||
                        (regData?.response_code === 27 && regMsg.includes('mapped')) ||
                        regMsg.includes('already mapped') || regMsg.includes('mapped with other merchant');
                    const isDeviceError = isDeviceMapped || regMsg.includes('device') || regMsg.includes('capture failed');
                    return res.status(400).json({ 
                        success: false, 
                        message: isDeviceMapped
                            ? "Your biometric scanner is already mapped to another merchant on this pipe. Please contact your service provider to unbind the device, or use a different scanner."
                            : (regData?.message || "2FA Registration Failed."), 
                        data: regData,
                        needsWebOnboarding: !isDeviceError,
                        deviceMapped: isDeviceMapped,
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
            // Update merchant's daily auth date for this specific pipe
            const updateData = { lastDailyAuthDate: new Date() };
            updateData[`dailyAuthDates.${pipe}`] = new Date();
            
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                updateData
            );

            // Cut ₹1 from the merchant's MAIN wallet for the daily 2FA auth
            const dailyAuthCharge = await deductDailyAuthCharge(merchantcode, pipe);

            return res.status(200).json({ 
                success: true, 
                message: "Daily Auth Successful", 
                data: resultData,
                dailyAuthCharge
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

        const pipesToCheck = ['bank2', 'bank4', 'bank5', 'bank6', 'bank3'];
        const activePipes = [];
        let isActuallyOnboarded = false;

        const statusPromises = pipesToCheck.map(pipe => {
            const freshToken = generatePaySprintToken();
            const freshHeaders = {
                'Token': freshToken,
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                'Content-Type': 'application/json'
            };
            return axios.post(
                getOnboardStatusEndpoint(pipe),
                {
                    merchantcode: merchantcode,
                    mobile: String(retailer.contactNumber),
                    pipe: pipe
                },
                { headers: freshHeaders, validateStatus: () => true }
            );
        });

        const results = await Promise.allSettled(statusPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const responseData = result.value.data;
                console.log(`[syncMerchantPipes] PIPE ${pipesToCheck[index]} STATUS:`, JSON.stringify(responseData));
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

        // Check if daily auth was done today for the specific pipe
        const today = new Date();
        let isDailyAuthDoneToday = false;
        
        let activePipes = retailer.activeAepsPipes || [];
        
        // If no pipes are cached, or forceRefresh is true, fetch them now
        if (activePipes.length === 0 || forceRefresh === 'true') {
            activePipes = await syncMerchantPipes(merchantcode);
        }

        const pipeToCheck = req.query.pipe || (activePipes.length > 0 ? activePipes[0] : null);
        let lastAuth = null;

        if (pipeToCheck && retailer.dailyAuthDates && retailer.dailyAuthDates.get(pipeToCheck)) {
            lastAuth = retailer.dailyAuthDates.get(pipeToCheck);
        } else {
            lastAuth = retailer.lastDailyAuthDate; // Fallback
        }
        
        if (lastAuth) {
            isDailyAuthDoneToday = 
                lastAuth.getDate() === today.getDate() &&
                lastAuth.getMonth() === today.getMonth() &&
                lastAuth.getFullYear() === today.getFullYear();
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
        const { merchantcode, aadhaar, dob, pidData, pipe, latitude, longitude, annual_income, nature_of_bussiness } = req.body;
        if (!merchantcode || !aadhaar || !dob || !pidData || !pipe) {
            return res.status(400).json({ 
                success: false, 
                message: "Required fields missing (merchantcode, aadhaar, dob, pidData, pipe)" 
            });
        }

        const pipeNorm = String(pipe).toLowerCase();

        // Bank5 mandates annual_income & nature_of_bussiness; Bank6 mandates accessmode.
        if (pipeNorm === 'bank5' && !annual_income) {
            return res.status(400).json({ success: false, message: "annual_income is required for bank5 activation" });
        }
        if (pipeNorm === 'bank5' && !nature_of_bussiness) {
            return res.status(400).json({ success: false, message: "nature_of_bussiness is required for bank5 activation" });
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
            pipe: pipeNorm, // bank2, bank5, bank6
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025"
        };

        // bank6 requires accessmode; bank5 requires annual_income & nature_of_bussiness.
        if (pipeNorm === 'bank5') {
            payload.annual_income = annual_income;
            payload.nature_of_bussiness = nature_of_bussiness;
        }
        if (pipeNorm === 'bank6') {
            payload.accessmode = "SITE";
        }

        const headers = {
            'Token': currentToken,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/onboard/onboard/activate_merchant`, payload, { headers });

        if (response.data && response.data.status === true && response.data.response_code == "1") {
            // Check if we should update DB
            await Retailer.findOneAndUpdate(
                { retailerId: merchantcode },
                { 
                    isMerchantKycComplete: true,
                    $addToSet: { activeAepsPipes: pipeNorm }
                }
            );
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

