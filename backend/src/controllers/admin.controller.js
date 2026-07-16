import Admin from "../models/users/admin.model.js";
import Distributor from "../models/users/distributor.model.js";
import Retailer from "../models/users/retailer.model.js";
import MainWallet from "../models/mainWallet.model.js";
import AepsWallet from "../models/aepsWallet.model.js";
import { uploadOnR2 } from "../utils/r2.js";
import Transaction from "../models/transaction.model.js";
import { addClient } from "../utils/sse.js";

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
// ...
// We will skip editing the top functions using a targeted replace. Let's just target updateAdminProfile.
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const totalDistributors = await Distributor.countDocuments();
        const totalRetailers = await Retailer.countDocuments();

        const { default: AdminWallet } = await import('../models/adminWallet.model.js');
        const adminWallet = await AdminWallet.findOne({ userId: req.user.id });
        const adminWalletBalance = adminWallet ? adminWallet.balance : 0;

        // In the future, we can add Transaction totals, active users, etc.
        const stats = {
            totalDistributors,
            totalRetailers,
            activeUsers: totalDistributors + totalRetailers,
            totalTransactions: 0, // Placeholder
            adminWalletBalance
        };

        return res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get list of all distributors
export const getDistributors = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        // Fetch distributors and exclude sensitive fields like password
        const distributors = await Distributor.find({})
            .populate("retailers", "-password")
            .select("-password")
            .sort({ createdAt: -1 });

        const distributorsWithStats = await Promise.all(distributors.map(async (dist) => {
            const mainWallet = await MainWallet.findOne({ userId: dist._id, userModel: 'Distributor' });
            const aepsWallet = await AepsWallet.findOne({ userId: dist._id, userModel: 'Distributor' });
            
            return {
                ...dist.toObject(),
                commissionsEarned: (mainWallet?.balance || 0) + (aepsWallet?.balance || 0)
            };
        }));

        return res.status(200).json({ success: true, data: distributorsWithStats });
    } catch (error) {
        console.error("Error fetching distributors:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAdminProfile = async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Unauthorized access" });
        
        const admin = await Admin.findById(req.user.id).select("-password");
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

        return res.status(200).json({ success: true, data: admin });
    } catch (error) {
        console.error("Error fetching profile:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateAdminProfile = async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Unauthorized access" });

        const { name, contactNumber, businessName, businessAddress, address, aadhaarNumber, panNumber, hasGst, gstNumber } = req.body;
        
        const updateData = {};
        if (name) updateData.name = name;
        if (contactNumber) updateData.contactNumber = contactNumber;
        if (businessName) updateData.businessName = businessName;
        if (businessAddress) updateData.businessAddress = businessAddress;
        if (address) {
            updateData.address = typeof address === 'string' ? JSON.parse(address) : address;
        }

        // Legal fields
        if (aadhaarNumber) updateData.aadhaarNumber = aadhaarNumber;
        if (panNumber) updateData.panNumber = panNumber;
        if (hasGst !== undefined) updateData.hasGst = hasGst === 'true' || hasGst === true;
        if (gstNumber) updateData.gstNumber = gstNumber;

        // Image uploads
        const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
        const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
        const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

        if (profilePictureLocalPath) {
            const profilePic = await uploadOnR2(profilePictureLocalPath);
            if (profilePic?.url) updateData.profilePicture = profilePic.url;
        }

        if (aadhaarPictureLocalPath) {
            const aadhaarPic = await uploadOnR2(aadhaarPictureLocalPath);
            if (aadhaarPic?.url) updateData.aadhaarPicture = aadhaarPic.url;
        }

        if (panPictureLocalPath) {
            const panPic = await uploadOnR2(panPictureLocalPath);
            if (panPic?.url) updateData.panPicture = panPic.url;
        }

        const updatedAdmin = await Admin.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        ).select("-password");

        return res.status(200).json({ success: true, message: "Profile updated successfully", data: updatedAdmin });
    } catch (error) {
        console.error("Error updating profile:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getRecentTransactions = async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Unauthorized access" });

        const transactions = await Transaction.find({})
            .sort({ createdAt: -1 })
            .limit(15);

        return res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("Error fetching recent transactions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const liveTransactionsHandler = (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Unauthorized access" });
    
    // Register the client connection for SSE
    addClient(req, res);
};

