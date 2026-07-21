import Transaction from "../models/transaction.model.js";
import Retailer from "../models/users/retailer.model.js";
import axios from "axios";

// @desc Generate PAN Card URL from BharatPays
// @route POST /api/pan/generate-url
// @access Private (Retailer)
export const generatePanUrl = async (req, res) => {
    try {
        const { title, first_name, middle_name, last_name, gender, mode, email_id } = req.body;

        if (!title || !first_name || !last_name || !gender || !mode) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        if (mode === 'E' && !email_id) {
            return res.status(400).json({ success: false, message: "Email ID is required for Electronic PAN" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Generate a unique customer reference ID
        const customerRefId = `PAN${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // For now, no wallet deduction as per user feedback
        // amount: 0 since there's no deduction for now
        const transaction = new Transaction({
            transactionId: customerRefId,
            userId: retailer._id,
            type: 'PAN_CARD',
            amount: 0,
            status: 'PENDING',
            metadata: {
                title,
                first_name,
                middle_name,
                last_name,
                gender,
                mode,
                email_id,
                apiProvider: 'BharatPays'
            }
        });
        await transaction.save();

        const token = process.env.BHARATPAYS_TOKEN;
        const redirectUrl = req.body.redirect_url || `${process.env.FRONTEND_URL}/dashboard`;

        const queryParams = new URLSearchParams({
            customer_ref_id: customerRefId,
            title,
            first_name,
            middle_name: middle_name || '',
            last_name,
            gender,
            mode,
            redirect_url: redirectUrl,
            token
        });

        if (mode === 'E') {
            queryParams.append('email_id', email_id);
        }

        const bharatPaysUrl = `https://api.bharatpays.in/api/nsdl?${queryParams.toString()}`;

        console.log(`[PAN URL Generation] Calling BharatPays API for Ref: ${customerRefId}`);

        const response = await axios.get(bharatPaysUrl);
        const data = response.data;

        if (data && data.success === 1 && data.data) {
            return res.status(200).json({
                success: true,
                message: "URL Generated Successfully",
                data: {
                    response_url: data.data.response_url,
                    encdata: data.data.encdata,
                    customer_ref_id: customerRefId
                }
            });
        } else {
            console.error(`[PAN URL Generation] Failed:`, data);
            transaction.status = 'FAILED';
            await transaction.save();
            return res.status(400).json({
                success: false,
                message: data?.message || "Failed to Generate URL from Service Provider"
            });
        }

    } catch (error) {
        console.error("Error generating PAN URL:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc Webhook callback from BharatPays
// @route POST /api/pan/callback
// @access Public
export const panCallback = async (req, res) => {
    try {
        const { status, customer_ref_id, type } = req.body;
        console.log(`[PAN Callback] Received webhook:`, req.body);

        if (!customer_ref_id) {
            return res.status(400).json({ success: false, message: "Missing customer_ref_id" });
        }

        const transaction = await Transaction.findOne({ transactionId: customer_ref_id, type: 'PAN_CARD' });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        if (status === "SUCCESS") {
            transaction.status = 'SUCCESS';
        } else if (status === "FAILED") {
            transaction.status = 'FAILED';
            // No refund logic for now as per user feedback
        }

        await transaction.save();

        return res.status(200).json({ success: true, message: "Callback processed successfully" });
    } catch (error) {
        console.error("Error processing PAN callback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
