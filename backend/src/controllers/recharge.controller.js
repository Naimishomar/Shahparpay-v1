import axios from 'axios';
import { generatePaySprintToken } from '../utils/paysprint.util.js';
import Transaction from "../models/transaction.model.js";

const getPaysprintHeaders = () => {
    return {
        'Token': generatePaySprintToken(),
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
    };
};

const getPaysprintBase = () => process.env.PAYSPRINT_BASE_URL || 'https://sit.paysprint.in/service-api/api/v1';

const PAYSPRINT_OP_MAP = {
    "11": "Airtel",
    "18": "Jio",
    "22": "Vodafone",
    "13": "BSNL",
    "4": "Idea",
    "35": "MTNL",
    // DTH Exact Strings for DTH INFO API
    "12": "Airteldth",
    "14": "Dishtv",
    "27": "Sundirect",
    "8": "TataSky",
    "10": "Videocon"
};

export const getOperators = async (req, res) => {
    try {
        const { type } = req.params; // e.g. 'prepaid', 'dth'
        
        const url = `${getPaysprintBase()}/service/recharge/recharge/getoperator`;
        const response = await axios.post(url, {}, { headers: getPaysprintHeaders() });

        if (response.data && response.data.status) {
            const allOperators = response.data.data || [];
            
            // Map frontend type to Paysprint category
            const typeMap = {
                'prepaid': 'Prepaid',
                'postpaid': 'Postpaid',
                'dth': 'DTH',
                'electricity': 'Electricity',
                'gas': 'GAS',
                'water': 'Water',
                'broadband': 'Broadband',
                'insurance': 'Insurance'
            };
            
            const targetCategory = (typeMap[type.toLowerCase()] || 'Prepaid').toLowerCase();
            
            const filteredOps = allOperators.filter(op => op.category && op.category.toLowerCase() === targetCategory);
            
            const formattedData = filteredOps.map(op => ({
                id: op.id,
                name: op.name
            }));
            
            return res.status(200).json({ success: true, data: formattedData });
        } else {
            return res.status(500).json({ success: false, message: "Failed to fetch operators from Paysprint" });
        }
    } catch (error) {
        console.error("Fetch Operators Error:", error?.response?.data || error?.message);
        return res.status(500).json({ success: false, message: "Failed to fetch operators" });
    }
};

export const browsePlans = async (req, res) => {
    try {
        const { mobileNumber, operator, circle = "Delhi NCR" } = req.body;
        if (!mobileNumber) {
            return res.status(400).json({ success: false, message: "Mobile number is required" });
        }

        const opName = PAYSPRINT_OP_MAP[operator] || "Airtel";
        
        const planUrl = `${getPaysprintBase()}/service/recharge/hlrapi/browseplan`;
        const payload = {
            circle: circle === 1 ? "Delhi NCR" : circle, // fallback for legacy circle=1
            op: opName
        };

        const planResponse = await axios.post(planUrl, payload, { headers: getPaysprintHeaders() });

        console.log('--- PAYSPRINT BROWSEPLAN RESPONSE ---');
        console.log('Payload sent:', payload);
        console.log('Response data:', planResponse.data);

        if (planResponse.data && planResponse.data.status && planResponse.data.info) {
            const info = planResponse.data.info;
            const groupedPlans = {};
            
            // info contains categories like "TOPUP", "3G/4G", "Romaing", etc.
            for (const [category, plans] of Object.entries(info)) {
                if (Array.isArray(plans)) {
                    groupedPlans[category] = plans.map(p => ({
                        rs: p.rs,
                        desc: p.desc,
                        validity: p.validity
                    }));
                }
            }

            return res.status(200).json({ success: true, data: groupedPlans });
        } else {
            const errorMsg = planResponse.data?.message || "No plans found";
            return res.status(400).json({ success: false, message: errorMsg, data: null });
        }
    } catch (error) {
        console.error("Browse Plans Error:", error?.response?.data || error?.message);
        return res.status(500).json({ success: false, message: "Failed to browse plans" });
    }
};

export const fetchDthInfo = async (req, res) => {
    try {
        const { dthNumber, operator } = req.body;
        if (!dthNumber || !operator) {
            return res.status(400).json({ success: false, message: "DTH number and operator are required" });
        }

        const opName = PAYSPRINT_OP_MAP[operator] || "Airteldth";
        const url = `${getPaysprintBase()}/service/recharge/hlrapi/dthinfo`;
        
        const rawBodyPayload = {
            op: opName,
            canumber: dthNumber
        };

        const payload = {
            RAW_BODY: JSON.stringify(rawBodyPayload)
        };
        
        const response = await axios.post(url, payload, { headers: getPaysprintHeaders() });

        if (response.data && response.data.status && response.data.info && response.data.info.length > 0) {
            const info = response.data.info[0];
            const mappedInfo = {
                customerName: info.customerName,
                status: info.status,
                balance: info.Balance,
                nextRechargeDate: info.NextRechargeDate,
                monthlyRecharge: info.MonthlyRecharge,
                planName: info.planname
            };
            return res.status(200).json({ success: true, data: mappedInfo });
        } else {
            return res.status(400).json({ success: false, message: response.data?.message || "DTH info not found" });
        }
    } catch (error) {
        console.error("DTH Info Error:", error?.response?.data || error?.message);
        return res.status(500).json({ success: false, message: "Failed to fetch DTH info" });
    }
};

export const fetchBill = async (req, res) => {
    try {
        const { caNumber, operator } = req.body;
        if (!caNumber || !operator) {
            return res.status(400).json({ success: false, message: "CA number (Consumer Number) and operator are required" });
        }

        const url = `${getPaysprintBase()}/service/recharge/recharge/fetchbill`;
        
        const payload = {
            operator: Number(operator),
            canumber: caNumber
        };
        
        const response = await axios.post(url, payload, { headers: getPaysprintHeaders() });

        if (response.data && response.data.status) {
            return res.status(200).json({ 
                success: true, 
                data: response.data.data,
                message: "Bill fetched successfully" 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: response.data?.message || "Failed to fetch bill. Please verify the consumer number." 
            });
        }
    } catch (error) {
        console.error("Fetch Bill Error:", error?.response?.data || error?.message);
        return res.status(500).json({ success: false, message: "An error occurred while fetching the bill." });
    }
};

export const doRecharge = async (req, res) => {
    try {
        const { mobileNumber, dthNumber, number, operator, amount, pin, type, userId } = req.body;

        const referenceId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const caNumber = mobileNumber || dthNumber || number;
        
        // Ensure userId is present
        if (!userId) {
            return res.status(401).json({ success: false, message: "User ID is required for authentication." });
        }

        // Verify PIN
        if (!pin) {
            return res.status(400).json({ success: false, message: "Transaction PIN is required." });
        }
        const bcrypt = (await import('bcrypt')).default;
        const AepsWallet = (await import('../models/aepsWallet.model.js')).default;
        const aepsWallet = await AepsWallet.findOne({ userId });
        if (!aepsWallet || !aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "Please set your wallet PIN first." });
        }
        const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
        if (!isPinValid) {
            return res.status(401).json({ success: false, message: "Incorrect PIN" });
        }

        // Deduct balance atomically (Creates PENDING transaction)
        const { updateWalletAtomically } = await import('../utils/wallet.util.js');
        const totalAmount = Number(amount);
        try {
            await updateWalletAtomically(userId, 'MAIN', -totalAmount, {
                transactionId: referenceId,
                userId: userId,
                type: 'RECHARGE',
                amount: totalAmount,
                status: 'PENDING',
                metadata: {
                    caNumber,
                    operator,
                    mode: type
                }
            });
        } catch (walletError) {
            return res.status(400).json({ success: false, message: walletError.message || "Insufficient balance for recharge." });
        }

        const payload = {
            operator: Number(operator),
            canumber: caNumber,
            amount: totalAmount,
            referenceid: referenceId
        };

        const url = `${getPaysprintBase()}/service/recharge/recharge/dorecharge`;
        console.log("--- PAYSPRINT DORECHARGE REQUEST PAYLOAD ---", payload);

        let response;
        let status = 'FAILED';
        try {
            response = await axios.post(url, payload, { 
                headers: getPaysprintHeaders(),
                validateStatus: () => true 
            });
            status = (response.data && response.data.status) ? 'SUCCESS' : 'FAILED';
        } catch (apiError) {
            console.error("Recharge API request failed:", apiError?.response?.data || apiError.message);
            response = { data: apiError?.response?.data || { message: apiError.message } };
        }

        if (status === 'FAILED') {
            await updateWalletAtomically(userId, 'MAIN', totalAmount, {
                transactionId: `REF-${referenceId}`,
                userId: userId,
                type: 'RECHARGE',
                amount: totalAmount,
                status: 'SUCCESS',
                metadata: { note: 'Refund for failed recharge', originalTxn: referenceId }
            });
        }

        // Update the original Transaction status
        const Transaction = (await import('../models/transaction.model.js')).default;
        await Transaction.findOneAndUpdate({ transactionId: referenceId }, { 
            status, 
            apiResponse: response.data 
        });

        if (status === 'SUCCESS') {
            return res.status(200).json({
                success: true,
                message: response.data?.message || "Recharge successful",
                data: response.data
            });
        } else {
            console.log("PAYSPRINT DORECHARGE FAILED RESPONSE:", response.data);
            return res.status(400).json({
                success: false,
                message: response.data?.message || "Recharge failed",
                data: response.data
            });
        }
    } catch (error) {
        console.error("Do Recharge Error:", error?.response?.data || error?.message || error);
        return res.status(500).json({ success: false, message: "Recharge error occurred", error: error.message || String(error) });
    }
};

export const checkStatus = async (req, res) => {
    try {
        const { referenceId } = req.body;
        
        const url = `${getPaysprintBase()}/service/recharge/recharge/status`;
        const payload = {
            referenceid: referenceId
        };
        
        const response = await axios.post(url, payload, { headers: getPaysprintHeaders() });

        return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Check Status Error:", error?.response?.data || error?.message);
        return res.status(500).json({ success: false, message: "Failed to check status" });
    }
};

export const getHistory = async (req, res) => {
    try {
        const history = await Transaction.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: history });
    } catch (error) {
        console.error("Get History Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch history" });
    }
};

export const checkBalance = async (req, res) => {
    try {
        // TODO: Implement PaySprint Balance API if required by frontend
        return res.status(200).json({ success: true, balance: "NA", message: "PaySprint Wallet Balance" });
    } catch (error) {
        console.error("Check Balance Error:", error);
        return res.status(500).json({ success: false, message: "Failed to check balance" });
    }
};
