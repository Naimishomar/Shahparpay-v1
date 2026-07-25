import Transaction from "../models/transaction.model.js";
import Retailer from "../models/users/retailer.model.js";
import axios from "axios";

// @desc Get existing Retailer Biometric PSA Status
// @route GET /api/pan/my-psa-status
// @access Private (Retailer)
export const getMyPsaStatus = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Find latest PAN_CARD transaction with psa_id
        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        }).sort({ createdAt: -1 });

        if (!existingTxn || !existingTxn.metadata?.psa_id) {
            return res.status(200).json({
                success: true,
                hasPsa: false,
                message: "No PSA Registration found"
            });
        }

        return res.status(200).json({
            success: true,
            hasPsa: true,
            data: {
                psa_id: existingTxn.metadata.psa_id,
                status: existingTxn.status,
                name: existingTxn.metadata.name,
                contact_person: existingTxn.metadata.contact_person,
                mobile: existingTxn.metadata.mobile,
                email: existingTxn.metadata.email,
                pan_no: existingTxn.metadata.pan_no,
                createdAt: existingTxn.createdAt
            }
        });
    } catch (error) {
        console.error("Error fetching PSA status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc Register Biometric PSA Agent
// @route POST /api/pan/register-bio-psa
// @access Private (Retailer)
export const registerBiometricPsa = async (req, res) => {
    try {
        const {
            name,
            contact_person,
            email,
            mobile,
            pin,
            pan_no,
            district_id,
            state_id,
            location,
            address_line_1,
            address_line_2
        } = req.body;

        const addr2 = address_line_2 || address_line_1;

        if (!name || !contact_person || !email || !mobile || !pin || !pan_no || !district_id || !state_id || !location || !address_line_1) {
            return res.status(400).json({ success: false, message: "Missing required fields for Biometric PSA registration" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Check if retailer already registered
        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        });

        if (existingTxn && existingTxn.metadata?.psa_id) {
            return res.status(200).json({
                success: true,
                message: `You are already registered with PSA ID: ${existingTxn.metadata.psa_id}`,
                data: {
                    psa_id: existingTxn.metadata.psa_id,
                    status: existingTxn.status
                }
            });
        }

        // Ref ID MUST be numeric only and max 20 chars
        const customerRefId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const token = process.env.BHARATPAYS_TOKEN;
        
        console.log(`[Biometric PSA Registration] Registering agent for Ref: ${customerRefId}`);

        const queryParams = new URLSearchParams({
            token,
            contact_person,
            name,
            email,
            mobile,
            pin,
            pan_no,
            district_id,
            state_id,
            location,
            address_line_1,
            address_line_2: addr2,
            address_line_3: '',
            address_line_4: '',
            ref_id: customerRefId
        });

        const targetUrl = `https://api.bharatpays.in/api/biometric_psa/register?${queryParams.toString()}`;

        const response = await axios.get(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            validateStatus: () => true
        });

        console.log("[Biometric PSA Registration] Provider Response:", response.status, response.data);

        const data = response.data;

        if (data && data.success === 1) {
            const psaId = data.data?.psa_id;
            const psaStatus = data.data?.status || 'PENDING';

            const transaction = new Transaction({
                transactionId: customerRefId,
                userId: retailer._id,
                type: 'PAN_CARD',
                amount: 0,
                status: psaStatus,
                metadata: {
                    psa_id: psaId,
                    name,
                    contact_person,
                    mobile,
                    email,
                    pan_no,
                    location,
                    apiProvider: 'BharatPays_Biometric_PSA'
                }
            });
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message || "Biometric PSA Agent Added Successfully",
                data: data.data
            });
        } else {
            let cleanMsg = data?.message || "Failed to register Biometric PSA Agent";
            if (typeof cleanMsg === 'string') {
                cleanMsg = cleanMsg.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim();
            }

            return res.status(400).json({
                success: false,
                message: cleanMsg
            });
        }

    } catch (error) {
        console.error("Error registering Biometric PSA:", error);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || "Internal server error" 
        });
    }
};

// @desc Buy Biometric PSA Tokens/Coupons
// @route POST /api/pan/buy-coupons
// @access Private (Retailer)
export const buyPsaCoupons = async (req, res) => {
    try {
        const { psa_id, amount } = req.body;

        if (!psa_id || !amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Valid PSA ID and Amount are required" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const customerRefId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const transaction = new Transaction({
            transactionId: customerRefId,
            userId: retailer._id,
            type: 'PAN_CARD',
            amount: Number(amount),
            status: 'PENDING',
            metadata: {
                psa_id,
                amount,
                action: 'PAYMENT_REQUEST',
                apiProvider: 'BharatPays_Biometric_PSA'
            }
        });
        await transaction.save();

        const token = process.env.BHARATPAYS_TOKEN;

        const queryParams = new URLSearchParams({
            token,
            amount: String(amount),
            psa_id,
            your_ref_id: customerRefId
        });

        const targetUrl = `https://api.bharatpays.in/api/biometric_psa/payment_request?${queryParams.toString()}`;

        console.log(`[Biometric PSA Payment Request] Ref: ${customerRefId}, PSA ID: ${psa_id}, Amount: ${amount}`);

        const response = await axios.get(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            validateStatus: () => true
        });

        console.log("[Biometric PSA Payment Request] Provider Response:", response.status, response.data);

        const data = response.data;

        if (data && data.success === 1) {
            transaction.status = data.data?.status || 'SUCCESS';
            transaction.metadata = {
                ...transaction.metadata,
                order_id: data.data?.order_id
            };
            transaction.markModified('metadata');
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message || "Bio Payment Request Submitted Successfully",
                data: data.data
            });
        } else {
            transaction.status = 'FAILED';
            await transaction.save();

            let cleanMsg = data?.message || "Payment request failed";
            if (typeof cleanMsg === 'string') {
                cleanMsg = cleanMsg.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim();
            }

            return res.status(400).json({
                success: false,
                message: cleanMsg
            });
        }

    } catch (error) {
        console.error("Error submitting PSA payment request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc Webhook callback from BharatPays for Bio PSA Agent & Payments
// @route POST /api/pan/callback
// @access Public
export const panCallback = async (req, res) => {
    try {
        const { success, message, data } = req.body;
        console.log(`[PSA Callback] Received webhook:`, req.body);

        if (data && (data.psa_id || data.order_id)) {
            const query = data.psa_id 
                ? { "metadata.psa_id": data.psa_id, type: 'PAN_CARD' } 
                : { "metadata.order_id": data.order_id, type: 'PAN_CARD' };

            const transaction = await Transaction.findOne(query);

            if (transaction) {
                transaction.status = data.status || transaction.status;
                transaction.metadata = {
                    ...transaction.metadata,
                    callback_data: data
                };
                transaction.markModified('metadata');
                await transaction.save();
            }
        }

        return res.status(200).json({ success: true, message: "Callback processed successfully" });
    } catch (error) {
        console.error("Error processing PSA callback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
