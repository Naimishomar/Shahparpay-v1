import axios from 'axios';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import BankAccount from '../models/bankAccount.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';
import { generatePaySprintToken } from '../utils/paysprint.util.js';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dmtBanksPath = path.join(__dirname, '../data/dmt_banks.json');
let dmtBanks = [];
try {
    dmtBanks = JSON.parse(fs.readFileSync(dmtBanksPath, 'utf-8'));
} catch (e) {
    console.error("Failed to load dmt_banks.json in settlement.controller.js", e);
}

const getBankId = (bankName) => {
    if (!bankName) return "1177";
    const record = dmtBanks.find(b => b.BankName && b.BankName.toLowerCase() === bankName.toLowerCase());
    return record ? String(record.BankId) : "1177";
};

const getPaySprintHeaders = () => {
    return {
        'Token': generatePaySprintToken(),
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };
};

const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

// resolve the merchant code (used by Paysprint Payout as merchant_code / merchantid)
const getMerchantCode = (req) => {
    if (req.user.role === 'distributor') {
        return req.user.distributorId || String(req.user.id);
    }
    return req.user.retailerId || String(req.user.id);
};

const getUser = async (req) => {
    if (req.user.role === 'distributor') {
        return Distributor.findById(req.user.id);
    }
    return Retailer.findById(req.user.id);
};

// Response code meaning (see PaySprint Payout ADD ACCOUNT docs)
const addAccountNeedsDocument = (resData) => {
    const code = resData?.response_code;
    if (code === 2 || code === 0) return true; // saved but supportive document required to activate
    if (resData?.acc_status === 0 && (resData?.status === true || code === 1)) return true;
    return false;
};

const extractBeneId = (resData, fallback) => {
    const beneId = resData?.bene_id || resData?.data?.beneid || resData?.data?.bene_id || resData?.data?.beneficiary_id;
    return beneId || fallback || null;
};

// PaySprint Payout (AEPS settlement) only accepts transactions 9 AM - 9 PM IST.
// Both bounds are configurable via env (HH:mm IST) to adapt to any merchant-specific window.
const getIstMinutesNow = () => {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

const getPayoutWindow = () => {
    const parse = (v, fallback) => {
        const [h, m] = (v || fallback).split(':').map(Number);
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    return {
        start: parse(process.env.PAYSPRINT_SETTLEMENT_START, '09:00'),
        end: parse(process.env.PAYSPRINT_SETTLEMENT_END, '21:00')
    };
};

const isPayoutServiceActive = () => {
    const { start, end } = getPayoutWindow();
    const nowMin = getIstMinutesNow();
    return nowMin >= start && nowMin < end;
};

const getServiceHoursError = () => {
    const start = process.env.PAYSPRINT_SETTLEMENT_START || '09:00';
    const end = process.env.PAYSPRINT_SETTLEMENT_END || '21:00';
    return `AEPS Settlement service is available from ${start} to ${end} IST only. Please try again later.`;
};

export const getSavedBanks = async (req, res) => {
    try {
        const banks = await BankAccount.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: banks });
    } catch (error) {
        console.error("Error fetching saved banks:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// GET LIST — Pulls the merchant's saved settlement accounts from PaySprint and
// upserts them into the local BankAccount collection (keeps bene_id in sync).
export const syncSavedBanks = async (req, res) => {
    try {
        const merchantCode = getMerchantCode(req);

        let apiResponse;
        try {
            apiResponse = await axios.post(`${baseUrl}/service/payout/payout/list`,
                { merchantid: merchantCode },
                { headers: getPaySprintHeaders(), validateStatus: () => true }
            );
        } catch (err) {
            console.error("Payout List API Error:", err?.response?.data || err.message);
            return res.status(502).json({ success: false, message: "Failed to fetch accounts from PaySprint" });
        }

        const data = apiResponse.data;
        if (!data || data.status === false) {
            // response_code 0 = no accounts registered for merchant — return empty list, not an error
            return res.status(200).json({ success: true, synced: 0, data: [], message: data?.message || "No accounts registered for merchant" });
        }

        const accounts = Array.isArray(data.data) ? data.data : [];
        const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';
        const syncedBanks = [];

        for (const acct of accounts) {
            if (!acct?.account) continue;

            const verified = String(acct.verified) === '1';
            // status: 1 = active, 2 = inactive/document pending (see GET LIST response)
            const status = String(acct.status) === '1' ? 'VERIFIED' : 'PENDING';

            const updated = await BankAccount.findOneAndUpdate(
                { userId: req.user.id, accountNumber: String(acct.account) },
                {
                    $set: {
                        userId: req.user.id,
                        userModel,
                        accountHolderName: acct.name,
                        accountNumber: String(acct.account),
                        ifscCode: acct.ifsc,
                        bankName: acct.bankname,
                        beneId: acct.beneid,
                        status: verified ? 'VERIFIED' : status,
                        accountType: acct.account_type === 'RELATIVE' ? 'RELATIVE' : 'PRIMARY'
                    }
                },
                { upsert: true, new: true }
            );
            syncedBanks.push(updated);
        }

        return res.status(200).json({ success: true, synced: syncedBanks.length, data: syncedBanks });
    } catch (error) {
        console.error("Error syncing settlement banks:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteSettlementBank = async (req, res) => {
    try {
        const { id } = req.params;
        const bank = await BankAccount.findOneAndDelete({ _id: id, userId: req.user.id });

        if (!bank) {
            return res.status(404).json({ success: false, message: "Bank account not found or unauthorized to delete" });
        }

        return res.status(200).json({ success: true, message: "Bank account deleted successfully" });
    } catch (error) {
        console.error("Error deleting bank:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ADD ACCOUNT — Registers a settlement account on PaySprint.
// accountType: "PRIMARY" (self, validated via penny drop) or "RELATIVE" (needs
// supportive document upload to activate).
export const addSettlementBank = async (req, res) => {
    try {
        const { accountNumber, ifscCode, bankName, accountType } = req.body;

        if (!accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({ success: false, message: "Account number, IFSC, and Bank Name are required" });
        }

        const user = await getUser(req);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const merchantCode = getMerchantCode(req);

        // Strict AEPS Rule: Account Holder Name MUST match the KYC name for self accounts
        const kycName = `${user.firstName} ${user.lastName}`.trim();
        const selectedAccountType = accountType === 'RELATIVE' ? 'RELATIVE' : 'PRIMARY';

        // PaySprint Payout ADD ACCOUNT contract:
        // { bankid, merchant_code, account, ifsc, name, account_type: PRIMARY|RELATIVE, pipe }
        const payload = {
            bankid: getBankId(bankName),
            merchant_code: merchantCode,
            account: accountNumber,
            ifsc: ifscCode,
            name: kycName,
            account_type: selectedAccountType,
            pipe: "bank2"
        };

        let apiResponse;
        try {
            apiResponse = await axios.post(`${baseUrl}/service/payout/payout/add`, payload, {
                headers: getPaySprintHeaders(),
                validateStatus: () => true
            });
        } catch (err) {
            console.error("PaySprint Add Account Error:", err?.response?.data || err.message);
            return res.status(502).json({ success: false, message: "Failed to integrate with Payout provider" });
        }

        const resData = apiResponse.data;

        // Failure: status === false and no bene_id returned (response_code 0/3/8/9/10/11/12)
        if (resData?.status === false && !resData?.bene_id && !resData?.data?.beneid) {
            return res.status(400).json({
                success: false,
                message: resData?.message || "Failed to add account at PaySprint",
                response_code: resData?.response_code
            });
        }

        const beneId = extractBeneId(resData, accountNumber);
        const needsDocument = addAccountNeedsDocument(resData);
        const alreadyAdded = resData?.response_code === 4 || (resData?.message && /already added/i.test(resData.message || ''));

        const newBank = await BankAccount.findOneAndUpdate(
            { userId: req.user.id, accountNumber },
            {
                userId: req.user.id,
                userModel: req.user.role === 'distributor' ? 'Distributor' : 'Retailer',
                accountHolderName: kycName,
                accountNumber,
                ifscCode,
                bankName,
                beneId,
                accountType: selectedAccountType,
                status: needsDocument ? 'PENDING' : 'VERIFIED',
                documentRequired: needsDocument
            },
            { upsert: true, new: true }
        );

        return res.status(alreadyAdded ? 200 : 201).json({
            success: true,
            message: alreadyAdded
                ? "Account already added to settlement list"
                : (needsDocument
                    ? "Account saved. Please upload a supportive document to activate it."
                    : "Bank account added successfully"),
            data: newBank,
            needsDocument
        });
    } catch (error) {
        console.error("Error adding bank:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ACCOUNT STATUS CHECK — Verifies activation state of a settlement account.
// accountstatus: 0 = Deactivated, 1 = Activated, 2 = Document Upload Pending, 3 = Document verification pending
export const getSettlementAccountStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const bank = await BankAccount.findOne({ _id: id, userId: req.user.id });
        if (!bank) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }
        if (!bank.beneId) {
            return res.status(400).json({ success: false, message: "Account has no PaySprint bene_id. Please sync or re-add the account." });
        }

        const merchantCode = getMerchantCode(req);
        const payload = { beneid: bank.beneId, merchantid: merchantCode };

        let apiResponse;
        try {
            apiResponse = await axios.post(`${baseUrl}/service/payout/Payout/accountstatus`, payload, {
                headers: getPaySprintHeaders(),
                validateStatus: () => true
            });
        } catch (err) {
            console.error("Payout Account Status API Error:", err?.response?.data || err.message);
            return res.status(502).json({ success: false, message: "Failed to check account status at PaySprint" });
        }

        const resData = apiResponse.data;
        const accountStatus = resData?.accountstatus;

        if (resData?.status === false || accountStatus === undefined) {
            return res.status(400).json({ success: false, message: resData?.message || "Unable to fetch account status", data: resData });
        }

        // Sync local record
        const statusMap = { 0: 'REJECTED', 1: 'VERIFIED', 2: 'PENDING', 3: 'PENDING' };
        await BankAccount.updateOne(
            { _id: bank._id },
            { $set: { status: statusMap[accountStatus] || bank.status, payoutAccountStatus: accountStatus } }
        );

        return res.status(200).json({
            success: true,
            accountStatus,
            message: accountStatus === 1 ? "Account is activated" :
                     accountStatus === 2 ? "Document upload pending" :
                     accountStatus === 3 ? "Document verification pending at PaySprint" : "Account is deactivated"
        });
    } catch (error) {
        console.error("Error checking account status:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// UPLOAD DOCUMENT — Submits a supportive document (passbook for PRIMARY,
// front/back aadhaar for RELATIVE, pan image alternatively) to activate the account.
export const uploadSettlementDocument = async (req, res) => {
    try {
        const { bankId, doctype } = req.body;
        if (!bankId) {
            return res.status(400).json({ success: false, message: "bankId is required" });
        }

        const bank = await BankAccount.findOne({ _id: bankId, userId: req.user.id });
        if (!bank) {
            return res.status(404).json({ success: false, message: "Bank account not found" });
        }
        if (!bank.beneId) {
            return res.status(400).json({ success: false, message: "Account has no PaySprint bene_id. Please re-add the account first." });
        }

        const selectedDoctype = doctype === 'AADHAAR' ? 'AADHAAR' : 'PAN';
        const files = req.files || {};

        const passbook = files.passbook ? files.passbook[0] : null;
        const panimage = files.panimage ? files.panimage[0] : null;
        const frontAadhar = files.front_aadhar ? files.front_aadhar[0] : null;
        const backAadhar = files.back_aadhar ? files.back_aadhar[0] : null;

        if (!passbook && !panimage && !frontAadhar) {
            return res.status(400).json({ success: false, message: "Please upload at least a passbook / pan image / aadhaar image" });
        }

        const form = new FormData();
        form.append('doctype', selectedDoctype);
        form.append('bene_id', String(bank.beneId));
        if (passbook) form.append('passbook', passbook.buffer, { filename: passbook.originalname, contentType: passbook.mimetype });
        if (panimage) form.append('panimage', panimage.buffer, { filename: panimage.originalname, contentType: panimage.mimetype });
        if (frontAadhar) form.append('front_aadhar', frontAadhar.buffer, { filename: frontAadhar.originalname, contentType: frontAadhar.mimetype });
        if (backAadhar) form.append('back_aadhar', backAadhar.buffer, { filename: backAadhar.originalname, contentType: backAadhar.mimetype });

        const response = await axios.post(`${baseUrl}/service/payout/payout/uploaddocument`, form, {
            headers: {
                'Token': generatePaySprintToken(),
                'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
                ...form.getHeaders()
            },
            validateStatus: () => true,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const resData = response.data;
        if (resData?.status === false) {
            return res.status(400).json({ success: false, message: resData?.message || "Failed to upload document", data: resData });
        }

        // response_code 1 = verified immediately, 2 = submitted for manual verification
        await BankAccount.updateOne(
            { _id: bank._id },
            { $set: { status: resData?.response_code === 1 ? 'VERIFIED' : 'PENDING', documentRequired: false } }
        );

        return res.status(200).json({ success: true, message: resData?.message || "Document uploaded successfully", data: resData });
    } catch (error) {
        console.error("Upload document error:", error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Failed to upload document", error: error?.response?.data || error.message });
    }
};

// Auto-register a beneficiary on PaySprint so we always have a valid bene_id.
const ensureBeneRegistered = async ({ merchantCode, bank, accountNumber, ifscCode, bankName, accountHolderName, accountType }) => {
    const existingBeneId = bank?.beneId;
    if (existingBeneId) return existingBeneId;

    const addPayload = {
        bankid: getBankId(bankName),
        merchant_code: merchantCode,
        account: accountNumber,
        ifsc: ifscCode,
        name: accountHolderName,
        account_type: accountType || "PRIMARY",
        pipe: "bank2"
    };

    try {
        const addRes = await axios.post(`${baseUrl}/service/payout/payout/add`, addPayload, {
            headers: getPaySprintHeaders(),
            validateStatus: () => true
        });
        const resData = addRes.data;
        const beneId = extractBeneId(resData, accountNumber);
        if (bank) {
            await BankAccount.updateOne(
                { _id: bank._id },
                { $set: { beneId, accountType: accountType || 'PRIMARY' } }
            );
        }
        return beneId;
    } catch (addErr) {
        console.error("Payout Auto-Register Error:", addErr?.response?.data || addErr.message);
        const errData = addErr?.response?.data;
        const beneId = extractBeneId(errData, null);
        return beneId || accountNumber;
    }
};

// DO TRANSACTION — Executes the AEPS fund settlement into the beneficiary bank account.
// PaySprint Payout contract: { bene_id, amount, refid, mode, pipe }
const executeSettlementTransaction = async ({ merchantCode, bank, beneId, accountNumber, ifscCode, bankName, accountHolderName, amount, refid, mode }) => {
    const payload = {
        bene_id: beneId,
        amount: String(amount),
        refid: refid,
        mode: mode || "IMPS",
        pipe: "bank2"
    };

    try {
        const apiResponse = await axios.post(`${baseUrl}/service/payout/payout/dotransaction`, payload, {
            headers: getPaySprintHeaders(),
            validateStatus: () => true
        });
        return { apiResponse: apiResponse.data, transportError: null };
    } catch (apiError) {
        console.error("Payout DoTransaction API Error:", apiError?.response?.data || apiError.message);
        return { apiResponse: null, transportError: apiError };
    }
};

export const initiateSettlement = async (req, res) => {
    try {
        const { bankId, amount, pin, mode } = req.body;

        if (!bankId || !amount || amount <= 0 || !pin) {
            return res.status(400).json({ success: false, message: "Invalid parameters" });
        }

        if (!isPayoutServiceActive()) {
            return res.status(400).json({ success: false, message: getServiceHoursError(), serviceHours: getPayoutWindow() });
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

        // 0.2% charges is applicable on each manual settlement transaction.
        const fee = Number(amount) * 0.002;
        const totalDeduction = Number(amount) + fee;

        if (aepsWallet.balance < totalDeduction) {
            return res.status(400).json({ success: false, message: `Insufficient AEPS Wallet balance. (Amount: ₹${amount} + Fee: ₹${fee})` });
        }

        const transactionId = `SETTLE${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const merchantCode = getMerchantCode(req);

        // Deduct balance atomically (Creates PROCESSING transaction)
        const { lockFundsForTransaction } = await import('../utils/wallet.util.js');
        try {
            await lockFundsForTransaction(req.user.id, 'AEPS', -totalDeduction, {
                transactionId,
                userId: req.user.id,
                type: 'AEPS_SETTLEMENT',
                amount: totalDeduction,
                metadata: {
                    bankAccount: bank.accountNumber,
                    bankName: bank.bankName,
                    beneficiaryName: bank.accountHolderName,
                    mode,
                    fee
                }
            });
        } catch (walletError) {
            return res.status(400).json({ success: false, message: walletError.message || "Insufficient AEPS Wallet balance" });
        }

        // Ensure a valid bene_id exists on PaySprint
        const beneId = await ensureBeneRegistered({
            merchantCode,
            bank,
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode,
            bankName: bank.bankName,
            accountHolderName: bank.accountHolderName,
            accountType: bank.accountType
        });

        const { apiResponse, transportError } = await executeSettlementTransaction({
            merchantCode,
            bank,
            beneId,
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode,
            bankName: bank.bankName,
            accountHolderName: bank.accountHolderName,
            amount,
            refid: transactionId,
            mode
        });

        if (transportError) {
            // Ambiguous network failure — leave PROCESSING so it can be reconciled via status enquiry.
            const errorData = transportError?.response?.data;
            let errorMessage = transportError.message;
            if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')) {
                errorMessage = "PaySprint Payout API is currently unavailable or the endpoint URL is incorrect (404 Not Found).";
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            }
            await Transaction.updateOne(
                { transactionId },
                { $set: { 'metadata.apiMessage': errorMessage, 'metadata.transportError': true } }
            );
            return res.status(502).json({
                success: false,
                message: errorMessage,
                pending: true,
                transactionId
            });
        }

        const resData = apiResponse;
        const ackno = resData?.ackno || resData?.data?.ackno || null;
        const apiMessage = resData?.message || (resData?.status ? "Settlement successful" : "Settlement failed");

        // response_code 1 => accepted; status true => received by Paysprint.
        // Any non-success => FAILED (funds auto-refunded by resolveTransaction).
        let finalStatus = 'FAILED';
        if (resData?.response_code === 1 || (resData?.status === true && ackno)) {
            finalStatus = 'SUCCESS';
        }

        if (finalStatus === 'SUCCESS') {
            await Transaction.updateOne(
                { transactionId },
                {
                    $set: {
                        status: 'SUCCESS',
                        transactionId: ackno || transactionId,
                        'metadata.refid': transactionId,
                        'metadata.ackno': ackno,
                        'metadata.apiMessage': apiMessage
                    }
                }
            );
        } else {
            const { resolveTransaction } = await import('../utils/wallet.util.js');
            await resolveTransaction(transactionId, 'FAILED', apiMessage, 'AEPS');
        }

        return res.status(finalStatus === 'SUCCESS' ? 200 : 400).json({
            success: finalStatus === 'SUCCESS',
            message: apiMessage,
            data: { ackno, response: resData }
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

        if (!isPayoutServiceActive()) {
            return res.status(400).json({ success: false, message: getServiceHoursError(), serviceHours: getPayoutWindow() });
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
        const merchantCode = getMerchantCode(req);

        // Deduct balance atomically from MAIN Wallet
        const { lockFundsForTransaction } = await import('../utils/wallet.util.js');
        try {
            await lockFundsForTransaction(req.user.id, 'MAIN', -totalDeduction, {
                transactionId,
                userId: req.user.id,
                type: 'DIRECT_PAYOUT',
                amount: totalDeduction,
                metadata: {
                    bankAccount: accountNumber,
                    bankName: bankName || 'Bank Account',
                    beneficiaryName: accountHolderName,
                    name: accountHolderName,
                    customerName: accountHolderName,
                    mobile: aepsWallet?.mobile || "N/A",
                    mode: mode || 'IMPS',
                    fee
                }
            });
        } catch (walletError) {
            return res.status(400).json({ success: false, message: `Insufficient Main Wallet balance. (Amount: ₹${amount} + Fee: ₹${fee})` });
        }

        // Auto-register the beneficiary to obtain a valid bene_id
        let savedBank = await BankAccount.findOne({ userId: req.user.id, accountNumber });
        const beneId = await ensureBeneRegistered({
            merchantCode,
            bank: savedBank,
            accountNumber,
            ifscCode,
            bankName: bankName || 'Bank',
            accountHolderName,
            accountType: 'PRIMARY'
        });

        const { apiResponse, transportError } = await executeSettlementTransaction({
            merchantCode,
            bank: savedBank,
            beneId,
            accountNumber,
            ifscCode,
            bankName: bankName || 'Bank',
            accountHolderName,
            amount,
            refid: transactionId,
            mode
        });

        if (transportError) {
            const errorData = transportError?.response?.data;
            let errorMessage = transportError.message;
            if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE html>')) {
                errorMessage = "PaySprint Payout API is currently unavailable or the endpoint URL is incorrect (404 Not Found).";
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            }
            await Transaction.updateOne(
                { transactionId },
                { $set: { 'metadata.apiMessage': errorMessage, 'metadata.transportError': true } }
            );
            return res.status(502).json({
                success: false,
                message: errorMessage,
                pending: true,
                transactionId
            });
        }

        const resData = apiResponse;
        const ackno = resData?.ackno || resData?.data?.ackno || null;
        const apiMessage = resData?.message || (resData?.status ? "Direct payout successful" : "Direct payout failed");

        let finalStatus = 'FAILED';
        if (resData?.response_code === 1 || (resData?.status === true && ackno)) {
            finalStatus = 'SUCCESS';
        }

        const { resolveTransaction } = await import('../utils/wallet.util.js');
        if (finalStatus === 'SUCCESS') {
            await Transaction.updateOne(
                { transactionId },
                {
                    $set: {
                        status: 'SUCCESS',
                        transactionId: ackno || transactionId,
                        'metadata.refid': transactionId,
                        'metadata.ackno': ackno,
                        'metadata.apiMessage': apiMessage
                    }
                }
            );
        } else {
            await resolveTransaction(transactionId, 'FAILED', apiMessage, 'MAIN');
        }

        return res.status(finalStatus === 'SUCCESS' ? 200 : 400).json({
            success: finalStatus === 'SUCCESS',
            message: apiMessage,
            data: { ackno, response: resData }
        });
    } catch (error) {
        console.error("Direct Payout Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// STATUS ENQUIRY — Reconciles a settlement transaction with PaySprint.
// txn_status: 0 = Failed & Refunded, 1 = Success, 2 = Pending, 3 = In Process, 4 = On Hold
export const checkSettlementStatus = async (req, res) => {
    try {
        const { transactionId } = req.body;
        if (!transactionId) {
            return res.status(400).json({ success: false, message: "transactionId is required" });
        }

        const txn = await Transaction.findOne({ transactionId, userId: req.user.id });
        if (!txn) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        const refid = txn.metadata?.refid || txn.transactionId;
        const ackno = txn.metadata?.ackno || null;

        const payload = { refid };
        if (ackno) payload.ackno = ackno;

        let apiResponse;
        try {
            apiResponse = await axios.post(`${baseUrl}/service/payout/payout/status`, payload, {
                headers: getPaySprintHeaders(),
                validateStatus: () => true
            });
        } catch (err) {
            console.error("Payout Status API Error:", err?.response?.data || err.message);
            return res.status(502).json({ success: false, message: "Failed to fetch status from PaySprint" });
        }

        const resData = apiResponse.data;
        if (resData?.status === false) {
            return res.status(400).json({ success: false, message: resData?.message || "Status enquiry failed", data: resData });
        }

        const statusData = resData?.data || {};
        const txnStatus = statusData.txn_status;

        let finalStatus = txn.status;
        if (txnStatus === 1) finalStatus = 'SUCCESS';
        else if (txnStatus === 0) finalStatus = 'FAILED';
        else if (txnStatus === 2 || txnStatus === 3 || txnStatus === 4) finalStatus = 'PROCESSING';

        if (finalStatus === 'FAILED' && (txn.status === 'PROCESSING' || txn.status === 'PENDING')) {
            const { resolveTransaction } = await import('../utils/wallet.util.js');
            await resolveTransaction(txn.transactionId, 'FAILED', statusData.status || "Transaction failed & refunded", txn.type === 'DIRECT_PAYOUT' ? 'MAIN' : 'AEPS');
        } else if (finalStatus === 'SUCCESS') {
            await Transaction.updateOne(
                { _id: txn._id },
                {
                    $set: {
                        status: 'SUCCESS',
                        transactionId: statusData.ackno || ackno || txn.transactionId,
                        'metadata.ackno': statusData.ackno || ackno,
                        'metadata.utr': statusData.utr || txn.metadata?.utr,
                        'metadata.charges': statusData.charges,
                        'metadata.apiMessage': statusData.status || "Settlement successful"
                    }
                }
            );
        } else if (finalStatus === 'PROCESSING') {
            await Transaction.updateOne(
                { _id: txn._id },
                { $set: { status: 'PROCESSING', 'metadata.apiMessage': statusData.status || "Transaction is in process" } }
            );
        }

        return res.status(200).json({
            success: true,
            txnStatus,
            message: txnStatus === 1 ? "Transaction Successful" :
                     txnStatus === 0 ? "Transaction Failed and Refunded" :
                     txnStatus === 2 ? "Transaction Pending" :
                     txnStatus === 3 ? "Transaction In Process" : "Transaction On Hold",
            data: {
                ...statusData,
                transactionId: txn.transactionId
            }
        });
    } catch (error) {
        console.error("Settlement status enquiry error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSettlementHistory = async (req, res) => {
    try {
        const { type } = req.query;
        const allowedTypes = ['AEPS_SETTLEMENT', 'DIRECT_PAYOUT', 'AEPSTOMAIN'];
        const selectedType = allowedTypes.includes(type) ? type : 'AEPS_SETTLEMENT';

        const history = await Transaction.find({
            userId: req.user.id,
            type: selectedType
        }).sort({ createdAt: -1 }).limit(50);

        return res.status(200).json({ success: true, data: history });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
