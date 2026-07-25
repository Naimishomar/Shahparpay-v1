import Transaction from "../models/transaction.model.js";
import Retailer from "../models/users/retailer.model.js";
import axios from "axios";

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

        // Ref ID MUST be numeric only and max 20 chars
        const customerRefId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const transaction = new Transaction({
            transactionId: customerRefId,
            userId: retailer._id,
            type: 'PAN_CARD',
            amount: 0,
            status: 'PENDING',
            metadata: {
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
            transaction.metadata.psa_id = data.data?.psa_id;
            transaction.status = data.data?.status || 'PENDING';
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message || "Biometric PSA Agent Added Successfully",
                data: data.data
            });
        } else {
            transaction.status = 'FAILED';
            await transaction.save();
            
            // Clean up error message if HTML tags returned by PHP validator
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

// @desc Webhook callback from BharatPays for Bio PSA Agent
// @route POST /api/pan/callback
// @access Public
export const panCallback = async (req, res) => {
    try {
        const { success, message, data } = req.body;
        console.log(`[PSA Callback] Received webhook:`, req.body);

        if (data && data.psa_id) {
            const transaction = await Transaction.findOne({ "metadata.psa_id": data.psa_id, type: 'PAN_CARD' });

            if (transaction) {
                transaction.status = data.status || transaction.status;
                transaction.metadata.callback_data = data;
                await transaction.save();
            }
        }

        return res.status(200).json({ success: true, message: "Callback processed successfully" });
    } catch (error) {
        console.error("Error processing PSA callback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
