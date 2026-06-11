import axios from 'axios';
import { generatePaySprintToken, encryptPayload } from '../utils/paysprint.util.js';
// import Customer from "../models/users/customer.model.js";

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
        const payload = {
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            mobilenumber: mobileNumber || "9999999999",
            referenceno: `REF${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: aadhaarNumber,
            accessmodetype: "SITE",
            nationalbankidentificationnumber: bankIIN,
            requestremarks: "Balance Enquiry",
            data: pidData
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/balanceenquiry/index`, { body: encryptedData }, { headers });

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

export const getBankList = async (req, res) => {
    try {
        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const token = generatePaySprintToken();
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/banklist/index`, {}, { headers });

        if (response.data && response.data.status) {
            return res.status(200).json({
                success: true,
                message: "Bank list fetched successfully",
                data: response.data.banklist ? response.data.banklist.data : response.data.data
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
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during fetch bank list request",
            error: error?.response?.data || error.message
        });
    }
};

export const cashWithdrawal = async (req, res) => {
    try {
        const { mobileNumber, aadhaarNumber, bankIIN, pidData, amount, latitude, longitude } = req.body;
        if (!aadhaarNumber || !bankIIN || !pidData || !amount) {
            return res.status(400).json({ 
                success: false,
                message: "Aadhaar number, Bank IIN, Biometric PidData, and Amount are required." 
            });
        }

        const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://uat.paysprint.in/service-api/api/v1';
        const payload = {
            latitude: latitude || "28.7041",
            longitude: longitude || "77.1025",
            mobilenumber: mobileNumber || "9999999999",
            referenceno: `CW${Date.now()}`,
            ipaddress: req.ip === '::1' ? '127.0.0.1' : (req.ip || "127.0.0.1"),
            adhaarnumber: aadhaarNumber,
            accessmodetype: "SITE",
            nationalbankidentificationnumber: bankIIN,
            requestremarks: "Cash Withdrawal",
            data: pidData,
            amount: amount
        };

        const token = generatePaySprintToken();
        const encryptedData = encryptPayload(JSON.stringify(payload));
        
        const headers = {
            'Token': token,
            'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${baseUrl}/service/aeps/cashwithdrawal/index`, { body: encryptedData }, { headers });

        if (response.data && response.data.status) {
            return res.status(200).json({
                success: true,
                message: "Cash withdrawal successful",
                data: response.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || "Cash withdrawal failed",
                data: response.data
            });
        }
    } catch (error) {
        console.error("AEPS Cash Withdrawal Error:", error?.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AEPS Cash Withdrawal request",
            error: error?.response?.data || error.message
        });
    }
};
