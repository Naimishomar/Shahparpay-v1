import Lead from '../models/lead.model.js';
import { generateLeadUrl, checkLeadStatus } from '../utils/paysprint.util.js';
import Retailer from '../models/users/retailer.model.js';

// Helper to get merchantcode
const getMerchantCode = async (userId) => {
    // Assuming only retailers generate leads currently
    const retailer = await Retailer.findById(userId);
    return retailer ? retailer.retailerId : 'PS001'; // Defaulting to PS001 if not found for testing
};

// Generate a Lead URL
export const generateLead = async (req, res) => {
    try {
        const { name, mobile_no, email, product, pincode, state } = req.body;
        
        if (!name || !mobile_no || !email || !product) {
            return res.status(400).json({ success: false, message: 'Missing required fields: name, mobile_no, email, product' });
        }

        const merchantcode = await getMerchantCode(req.user.id);
        const refid = `LEAD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const payload = {
            refid,
            merchantcode,
            name,
            mobile_no,
            email,
            product,
            redirect_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/lead-generation` : "https://shahparpay-v1.vercel.app/lead-generation"
        };

        const psResponse = await generateLeadUrl(payload);
        console.log("PAYSPRINT LEAD RESPONSE:", JSON.stringify(psResponse));

        if (psResponse.success && psResponse.data) {
            // PaySprint sometimes returns the token separately or needs it appended
            let finalUrl = psResponse.data.url;
            if (finalUrl && psResponse.data.token && !finalUrl.includes('?')) {
                finalUrl = `${finalUrl}?token=${psResponse.data.token}`;
            } else if (finalUrl && psResponse.data.jwt && !finalUrl.includes('?')) {
                finalUrl = `${finalUrl}?jwt=${psResponse.data.jwt}`;
            }

            // Save to DB
            const newLead = new Lead({
                userId: req.user.id,
                userModel: req.user.role === 'retailer' ? 'Retailer' : req.user.role === 'distributor' ? 'Distributor' : 'Admin',
                refid,
                merchantcode,
                name,
                mobile_no,
                email,
                product,
                pincode,
                state,
                url: finalUrl
            });
            await newLead.save();

            return res.status(200).json({ success: true, message: psResponse.message, data: newLead });
        } else {
            return res.status(400).json({ success: false, message: psResponse.message || 'Failed to generate Lead URL from PaySprint' });
        }
    } catch (error) {
        console.error('Generate Lead Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Check Status Manually
export const checkStatus = async (req, res) => {
    try {
        const { refid } = req.params;
        const lead = await Lead.findOne({ refid, userId: req.user.id });
        
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        const psResponse = await checkLeadStatus(refid);
        if (psResponse.success && psResponse.data) {
            const data = psResponse.data;
            lead.executive_status = data.executive_status || lead.executive_status;
            lead.executive_remarks = data.executive_remarks || lead.executive_remarks;
            lead.executive_updated_date = data.executive_updated_date || lead.executive_updated_date;
            await lead.save();

            return res.status(200).json({ success: true, message: psResponse.message, data: lead });
        } else {
            return res.status(400).json({ success: false, message: psResponse.message || 'Failed to fetch status from PaySprint' });
        }
    } catch (error) {
        console.error('Check Lead Status Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get History
export const getLeadHistory = async (req, res) => {
    try {
        const leads = await Lead.find({ userId: req.user.id }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: leads });
    } catch (error) {
        console.error('Get Lead History Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// PaySprint Webhook Callback
export const leadCallback = async (req, res) => {
    try {
        // According to docs, the payload has: { "event": "LEAD_GENERATION_CALLBACK", "param": { ... } }
        const { event, param } = req.body;
        
        if (event === 'LEAD_GENERATION_CALLBACK' && param && param.refid) {
            const lead = await Lead.findOne({ refid: param.refid });
            if (lead) {
                lead.executive_status = param.executive_status || lead.executive_status;
                lead.executive_remarks = param.executive_remarks || lead.executive_remarks;
                lead.executive_updated_date = param.executive_updated_date || lead.executive_updated_date;
                await lead.save();

                // If status becomes APPROVED, we could process commission here or wait for settlement.
                // Currently just updating status.
            }
        }
        
        // Always return 200 OK to PaySprint
        return res.status(200).json({ success: true, message: 'Callback received' });
    } catch (error) {
        console.error('Lead Callback Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
