import Transaction from "../models/transaction.model.js";
import Retailer from "../models/users/retailer.model.js";
import axios from "axios";

// @desc Register for UTI PSA
// @route POST /api/pan/register-psa
// @access Private (Retailer)
export const registerPsa = async (req, res) => {
    try {
        const { shop_name, name, state, district, address, pincode, mobile, email, dob, pan_no, aadhar_no } = req.body;

        if (!shop_name || !name || !state || !district || !address || !pincode || !mobile || !email || !dob || !pan_no || !aadhar_no) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Generate a unique numeric-only customer reference ID
        const customerRefId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const transaction = new Transaction({
            transactionId: customerRefId,
            userId: retailer._id,
            type: 'PAN_CARD', // Reusing the same enum for UTI PAN
            amount: 0,
            status: 'PENDING',
            metadata: {
                shop_name,
                name,
                mobile,
                email,
                pan_no,
                aadhar_no,
                apiProvider: 'BharatPays_UTI_PSA'
            }
        });
        await transaction.save();

        const token = process.env.BHARATPAYS_TOKEN;
        
        console.log(`[UTI PSA Registration] Calling BharatPays API for Ref: ${customerRefId}`);

        // The PHP example uses an array for CURLOPT_POSTFIELDS which usually implies multipart/form-data.
        // We can pass a plain object to axios and use multipart/form-data header.
        const payload = {
            shop_name,
            name,
            state,
            district,
            address,
            pincode,
            mobile,
            email,
            dob,
            pan_no,
            aadhar_no,
            ref_id: customerRefId
        };

        const response = await axios.post("https://api.bharatpays.in/api/psa/register", payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        const data = response.data;

        if (data && data.success === 1 && data.data) {
            // Update transaction with psa_id
            transaction.metadata.psa_id = data.data.psa_id;
            transaction.status = data.data.status; // usually PENDING or APPROVED
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message,
                data: data.data
            });
        } else {
            console.error(`[UTI PSA Registration] Failed:`, data);
            transaction.status = 'FAILED';
            await transaction.save();
            return res.status(400).json({
                success: false,
                message: data?.message || "Failed to register PSA"
            });
        }

    } catch (error) {
        console.error("Error registering PSA:", error);
        res.status(500).json({ success: false, message: error.response?.data?.message || "Internal server error" });
    }
};

// @desc Webhook callback from BharatPays for PSA
// @route POST /api/pan/callback
// @access Public
export const panCallback = async (req, res) => {
    try {
        const { success, message, data } = req.body;
        console.log(`[UTI PSA Callback] Received webhook:`, req.body);

        if (!data || !data.ref_id) {
            return res.status(400).json({ success: false, message: "Missing ref_id" });
        }

        const transaction = await Transaction.findOne({ transactionId: data.ref_id, type: 'PAN_CARD' });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        transaction.status = data.status;
        transaction.metadata.remark = data.remark;
        transaction.metadata.updated_at = data.updated_at;
        
        await transaction.save();

        return res.status(200).json({ success: true, message: "Callback processed successfully" });
    } catch (error) {
        console.error("Error processing PSA callback:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
