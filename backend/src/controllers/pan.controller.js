import Transaction from "../models/transaction.model.js";
import Retailer from "../models/users/retailer.model.js";
import MainWallet from "../models/mainWallet.model.js";
import axios from "axios";

// Standard UTI PAN token charge per PAN card application / coupon.
const PAN_COUPON_FEE = 107;

// Atomically deducts `amount` from a retailer's Main Wallet if the balance is
// sufficient. Returns the updated wallet, or null if the balance is too low.
const debitMainWallet = async (userId, amount) => {
    return MainWallet.findOneAndUpdate(
        { userId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: 'after' }
    );
};

// @desc Get existing Retailer Biometric PSA Status
// @route GET /api/pan/my-psa-status
// @access Private (Retailer)
export const getMyPsaStatus = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // First: find transaction that has psa_id in metadata (new records)
        let existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        }).sort({ createdAt: -1 });

        // Fallback: find any BharatPays PSA registration transaction (older records that missed saving psa_id)
        if (!existingTxn || !existingTxn.metadata?.psa_id) {
            existingTxn = await Transaction.findOne({
                userId: retailer._id,
                type: 'PAN_CARD',
                'metadata.apiProvider': 'BharatPays_Biometric_PSA',
                'metadata.action': { $exists: false } // Exclude coupon payment requests
            }).sort({ createdAt: -1 });
        }

        if (!existingTxn) {
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
                psa_id: existingTxn.metadata?.psa_id || null,
                status: existingTxn.status,
                name: existingTxn.metadata?.name,
                contact_person: existingTxn.metadata?.contact_person,
                mobile: existingTxn.metadata?.mobile,
                email: existingTxn.metadata?.email,
                pan_no: existingTxn.metadata?.pan_no,
                createdAt: existingTxn.createdAt,
                txnId: existingTxn._id
            }
        });
    } catch (error) {
        console.error("Error fetching PSA status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc Manually set psa_id on an existing registration transaction (repair old records)
// @route PATCH /api/pan/set-psa-id
// @access Private (Retailer)
export const setPsaId = async (req, res) => {
    try {
        const { psa_id } = req.body;
        if (!psa_id) {
            return res.status(400).json({ success: false, message: "psa_id is required" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Find the BharatPays PSA registration transaction (non-coupon)
        const txn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.apiProvider': 'BharatPays_Biometric_PSA',
            'metadata.action': { $exists: false }
        }).sort({ createdAt: -1 });

        if (!txn) {
            return res.status(404).json({ success: false, message: "No PSA registration record found to update" });
        }

        txn.metadata = { ...txn.metadata, psa_id };
        txn.markModified('metadata');
        await txn.save();

        return res.status(200).json({
            success: true,
            message: `PSA ID ${psa_id} linked successfully`,
            data: { psa_id, status: txn.status }
        });
    } catch (error) {
        console.error("Error setting PSA ID:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// @desc Manually sync PSA status from BharatPays (for stuck PENDING records)
// @route PATCH /api/pan/sync-psa-status
// @access Private (Retailer)
export const syncPsaStatus = async (req, res) => {
    try {
        const { psa_id, status } = req.body;
        const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'SUCCESS'];

        if (!psa_id || !status) {
            return res.status(400).json({ success: false, message: "psa_id and status are required" });
        }
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        // Find by psa_id in metadata OR by apiProvider (for old records)
        let txn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.psa_id': psa_id
        });

        if (!txn) {
            // Fallback: find by apiProvider for old records where psa_id wasn't saved
            txn = await Transaction.findOne({
                userId: retailer._id,
                type: 'PAN_CARD',
                'metadata.apiProvider': 'BharatPays_Biometric_PSA',
                'metadata.action': { $exists: false }
            }).sort({ createdAt: -1 });
        }

        if (!txn) {
            return res.status(404).json({ success: false, message: "No PSA registration record found" });
        }

        // Update status and ensure psa_id is persisted
        txn.status = status;
        txn.metadata = { ...txn.metadata, psa_id };
        txn.markModified('metadata');
        await txn.save();

        console.log(`[PSA Status Sync] Retailer ${retailer._id} manually synced PSA ${psa_id} → ${status}`);

        return res.status(200).json({
            success: true,
            message: `PSA status updated to ${status}`,
            data: { psa_id, status }
        });
    } catch (error) {
        console.error("Error syncing PSA status:", error);
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

        // Check if retailer already has an active/pending registration
        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        }).sort({ createdAt: -1 });

        if (existingTxn && existingTxn.metadata?.psa_id) {
            // Allow re-registration if previous was REJECTED or FAILED
            if (existingTxn.status === 'REJECTED' || existingTxn.status === 'FAILED') {
                console.log(`[Biometric PSA] Previous registration ${existingTxn.metadata.psa_id} was ${existingTxn.status}. Allowing fresh registration.`);
            } else {
                return res.status(200).json({
                    success: true,
                    message: `You are already registered with PSA ID: ${existingTxn.metadata.psa_id}`,
                    data: {
                        psa_id: existingTxn.metadata.psa_id,
                        status: existingTxn.status
                    }
                });
            }
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

// ==========================================
// STANDARD UTI WEB PSA AGENT APIs
// ==========================================

export const getStdPsaStatus = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'STD_PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        }).sort({ createdAt: -1 });

        if (!existingTxn) {
            return res.status(200).json({
                success: true,
                hasPsa: false,
                message: "No Standard PSA Registration found"
            });
        }

        return res.status(200).json({
            success: true,
            hasPsa: true,
            data: {
                psa_id: existingTxn.metadata?.psa_id || null,
                status: existingTxn.status,
                shop_name: existingTxn.metadata?.shop_name,
                name: existingTxn.metadata?.name,
                mobile: existingTxn.metadata?.mobile,
                email: existingTxn.metadata?.email,
                pan_no: existingTxn.metadata?.pan_no,
                createdAt: existingTxn.createdAt,
                txnId: existingTxn._id
            }
        });
    } catch (error) {
        console.error("Error fetching Standard PSA status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const registerStdPsa = async (req, res) => {
    try {
        const {
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
            aadhar_no
        } = req.body;

        if (!shop_name || !name || !state || !district || !address || !pincode || !mobile || !email || !dob || !pan_no || !aadhar_no) {
            return res.status(400).json({ success: false, message: "Missing required fields for Standard PSA registration" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'STD_PAN_CARD',
            'metadata.psa_id': { $exists: true, $ne: null }
        }).sort({ createdAt: -1 });

        if (existingTxn && existingTxn.metadata?.psa_id) {
            if (existingTxn.status === 'REJECTED' || existingTxn.status === 'FAILED') {
                console.log(`[Std PSA] Previous registration ${existingTxn.metadata.psa_id} was ${existingTxn.status}. Allowing fresh registration.`);
            } else {
                return res.status(200).json({
                    success: true,
                    message: `You are already registered with Standard PSA ID: ${existingTxn.metadata.psa_id}`,
                    data: {
                        psa_id: existingTxn.metadata.psa_id,
                        status: existingTxn.status
                    }
                });
            }
        }

        const ref_id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const token = process.env.BHARATPAYS_TOKEN;

        const formData = new URLSearchParams({
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
            ref_id
        });

        const targetUrl = `https://api.bharatpays.in/api/psa/register`;

        const response = await axios.post(targetUrl, formData.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: () => true
        });

        console.log("[Std PSA Registration] Response:", response.status, response.data);

        const data = response.data;

        if (data && data.success === 1) {
            const psaId = data.data?.psa_id;
            const psaStatus = data.data?.status || 'PENDING';

            const transaction = new Transaction({
                transactionId: ref_id,
                userId: retailer._id,
                type: 'STD_PAN_CARD',
                amount: 0,
                status: psaStatus,
                metadata: {
                    psa_id: psaId,
                    name,
                    shop_name,
                    mobile,
                    email,
                    pan_no,
                    apiProvider: 'BharatPays_Standard_PSA'
                }
            });
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message || "Standard PSA Agent Added Successfully",
                data: data.data
            });
        } else {
            let cleanMsg = data?.message || "Failed to register Standard PSA Agent";
            if (typeof cleanMsg === 'string') {
                cleanMsg = cleanMsg.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim();
            }

            return res.status(400).json({
                success: false,
                message: cleanMsg
            });
        }
    } catch (error) {
        console.error("Error registering Standard PSA:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateStdPsa = async (req, res) => {
    try {
        const {
            psa_id,
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
            aadhar_no
        } = req.body;

        if (!psa_id || !shop_name || !name || !state || !district || !address || !pincode || !mobile || !email || !dob || !pan_no || !aadhar_no) {
            return res.status(400).json({ success: false, message: "Missing required fields for updating Standard PSA registration" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const existingTxn = await Transaction.findOne({
            userId: retailer._id,
            type: 'STD_PAN_CARD',
            'metadata.psa_id': psa_id
        }).sort({ createdAt: -1 });

        if (!existingTxn) {
            return res.status(404).json({ success: false, message: "Standard PSA Registration not found" });
        }

        if (existingTxn.status !== 'REJECTED' && existingTxn.status !== 'FAILED') {
            return res.status(400).json({ success: false, message: "Only rejected applications can be updated." });
        }

        const token = process.env.BHARATPAYS_TOKEN;

        const formData = new URLSearchParams({
            psa_id,
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
            aadhar_no
        });

        const targetUrl = `https://api.bharatpays.in/api/psa/update_registration`;

        const response = await axios.post(targetUrl, formData.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: () => true
        });

        console.log("[Std PSA Update] Response:", response.status, response.data);

        const data = response.data;

        if (data && data.success === 1) {
            existingTxn.status = data.data?.status || 'PENDING';
            existingTxn.metadata = {
                ...existingTxn.metadata,
                name,
                shop_name,
                mobile,
                email,
                pan_no,
                updatedAt: new Date()
            };
            existingTxn.markModified('metadata');
            await existingTxn.save();

            return res.status(200).json({
                success: true,
                message: data.message || "PSA Request Data Update Successfully.",
                data: data.data
            });
        } else {
            let cleanMsg = data?.message || "Failed to update Standard PSA Agent";
            if (typeof cleanMsg === 'string') {
                cleanMsg = cleanMsg.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim();
            }

            return res.status(400).json({
                success: false,
                message: cleanMsg
            });
        }
    } catch (error) {
        console.error("Error updating Standard PSA:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const purchaseStdCoupons = async (req, res) => {
    try {
        const { psa_id, coupon } = req.body;

        if (!psa_id || !coupon || Number(coupon) <= 0) {
            return res.status(400).json({ success: false, message: "Valid PSA ID and number of coupons are required" });
        }

        const retailer = await Retailer.findById(req.user.id);
        if (!retailer) {
            return res.status(404).json({ success: false, message: "Retailer not found" });
        }

        const couponQty = Number(coupon);
        const totalAmount = couponQty * PAN_COUPON_FEE;

        // Verify the retailer has enough Main Wallet balance BEFORE hitting the
        // provider, so coupons are never bought without the wallet being debited.
        const mainWallet = await MainWallet.findOne({ userId: retailer._id });
        if (!mainWallet || mainWallet.balance < totalAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient Main Wallet balance. Required ₹${totalAmount}, available ₹${mainWallet?.balance || 0}.`
            });
        }

        const ref_id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const transaction = new Transaction({
            transactionId: ref_id,
            userId: retailer._id,
            type: 'STD_PAN_CARD',
            amount: totalAmount,
            status: 'PENDING',
            metadata: {
                psa_id,
                coupon_qty: couponQty,
                amount: totalAmount,
                action: 'COUPON_PURCHASE',
                apiProvider: 'BharatPays_Standard_PSA'
            }
        });
        await transaction.save();

        const token = process.env.BHARATPAYS_TOKEN;

        const formData = new URLSearchParams({
            psa_id,
            coupon: String(couponQty),
            ref_id
        });

        const targetUrl = `https://api.bharatpays.in/api/psa/purchase_coupon`;

        console.log(`[Std PSA Coupon Purchase] Ref: ${ref_id}, PSA ID: ${psa_id}, Qty: ${couponQty}`);

        const response = await axios.post(targetUrl, formData.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: () => true
        });

        console.log("[Std PSA Coupon Purchase] Response:", response.status, response.data);

        const data = response.data;

        if (data && data.success === 1) {
            // Coupon purchase succeeded — cut ₹107 per coupon from the Main Wallet.
            const wallet = await debitMainWallet(retailer._id, totalAmount);
            if (!wallet) {
                transaction.status = 'FAILED';
                transaction.metadata = {
                    ...transaction.metadata,
                    gatewayMessage: 'Insufficient Main Wallet balance for coupon purchase'
                };
                transaction.markModified('metadata');
                await transaction.save();

                return res.status(400).json({
                    success: false,
                    message: "Insufficient Main Wallet balance for coupon purchase."
                });
            }

            transaction.status = data.data?.status || 'SUCCESS';
            transaction.metadata = {
                ...transaction.metadata,
                request_id: data.data?.request_id,
                new_wallet_balance: wallet.balance
            };
            transaction.markModified('metadata');
            await transaction.save();

            return res.status(200).json({
                success: true,
                message: data.message || "PSA Coupon Purchased Successfully.",
                data: data.data,
                amountDebited: totalAmount,
                new_wallet_balance: wallet.balance
            });
        } else {
            transaction.status = 'FAILED';
            await transaction.save();

            let cleanMsg = data?.message || "Coupon purchase failed";
            if (typeof cleanMsg === 'string') {
                cleanMsg = cleanMsg.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim();
            }

            return res.status(400).json({
                success: false,
                message: cleanMsg
            });
        }

    } catch (error) {
        console.error("Error submitting Std PSA coupon purchase:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const requestStdPsaPassword = async (req, res) => {
    try {
        const { psa_id } = req.query;

        if (!psa_id) {
            return res.status(400).json({ success: false, message: "PSA ID is required" });
        }

        const token = process.env.BHARATPAYS_TOKEN;
        const targetUrl = `https://api.bharatpays.in/api/psa_get?token=${token}&psa_id=${psa_id}`;

        const response = await axios.get(targetUrl, {
            validateStatus: () => true
        });

        const data = response.data;

        if (data && data.success === 1) {
            return res.status(200).json({
                success: true,
                message: data.message || "PSA Password request is Submitted Successfully.",
                data: data.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: data?.message || "Failed to request PSA Password"
            });
        }
    } catch (error) {
        console.error("Error requesting PSA password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
