import Retailer from "../models/users/retailer.model.js";
import Distributor from "../models/users/distributor.model.js";
import Customer from "../models/users/customer.model.js";
import AepsWallet from "../models/aepsWallet.model.js";
import MainWallet from "../models/mainWallet.model.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { customAlphabet } from "nanoid";
import Admin from "../models/users/admin.model.js";
import { uploadOnR2 } from "../utils/r2.js";
import bcrypt from "bcrypt";
import Otp from "../models/otp.model.js";
import { sendEmailOTP } from "../utils/email.js";
import { onboardMerchant, sendAadhaarOtp, verifyAadhaarOtp as verifyAadhaarOtpApi, verifyPanDetails, getWebOnboardingUrl } from "../utils/paysprint.util.js";

export const registerAdmin = async(req,res)=>{
    try {
       const { username, email, contactNumber, password } = req.body; 
       if(!username || !email || !contactNumber || !password){
            return res.status(400).json({success: false, message: "All fields are required"});
       }
       const isAdminExist = await Admin.findOne({$or:[{email}, {username}, {contactNumber}]});
       if(isAdminExist){
            return res.status(400).json({success: false, message: "Admin already exists"});
       }
       const adminId = `AD${customAlphabet('0123456789', 6)()}`;
       const createAdmin = await Admin.create({
           adminId,
           username,
           email,
           contactNumber,
           password,
        });
        const token = await jwt.sign({ id: createAdmin._id}, process.env.ADMIN_JWT_SECRET, {expiresIn: '1d'})
        return res.status(201).json({success: true, message: "Admin registered successfully", createAdmin, token});
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}

// Unified login for all roles
export const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "Identifier and password are required." });
        }

        let user = await Admin.findOne({ $or: [{ adminId: identifier }, { email: identifier }, { contactNumber: identifier }] });
        let role = "admin";

        if (!user) {
            user = await Distributor.findOne({ $or: [{ distributorId: identifier }, { email: identifier }, { contactNumber: identifier }] });
            role = "distributor";
        }

        if (!user) {
            user = await Retailer.findOne({ $or: [{ retailerId: identifier }, { email: identifier }, { contactNumber: identifier }] }).populate('distributorId', 'distributorId name');
            role = "retailer";
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (!user.isActive) return res.status(403).json({ success: false, message: "Account is inactive." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials." });

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await Otp.findOneAndUpdate(
            { email: user.email },
            { otp: otpCode, createdAt: Date.now() },
            { upsert: true, returnDocument: 'after' }
        );

        const emailSent = await sendEmailOTP(user.email, user.name || "User", otpCode);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email." });
        }

        return res.status(200).json({ 
            success: true, 
            message: "OTP sent to your email", 
            email: user.email,
            requireOtp: true 
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export const verifyLoginOtp = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp) {
            return res.status(400).json({ success: false, message: "Identifier and OTP are required." });
        }

        let user = await Admin.findOne({ $or: [{ adminId: identifier }, { email: identifier }, { contactNumber: identifier }] });
        let role = "admin";

        if (!user) {
            user = await Distributor.findOne({ $or: [{ distributorId: identifier }, { email: identifier }, { contactNumber: identifier }] });
            role = "distributor";
        }

        if (!user) {
            user = await Retailer.findOne({ $or: [{ retailerId: identifier }, { email: identifier }, { contactNumber: identifier }] }).populate('distributorId', 'distributorId name');
            role = "retailer";
        }

        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const otpRecord = await Otp.findOne({ email: user.email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
        }

        await Otp.deleteOne({ email: user.email });

        const accessToken = jwt.sign(
            { id: user._id, role: role, code: user.adminId || user.retailerId || (user.distributorId && user.distributorId._id ? user.distributorId.distributorId : user.distributorId) },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { id: user._id, role: role },
            process.env.JWT_REFRESH_SECRET || "default_refresh_secret",
            { expiresIn: "7d" }
        );

        const userObj = user.toObject();
        delete userObj.password;

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({ success: true, message: "Login successful", token: accessToken, role, user: userObj });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendVerificationOtp = async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const adminExist = await Admin.findOne({ email });
        const distExist = await Distributor.findOne({ email });
        const retExist = await Retailer.findOne({ email });
        
        if (adminExist || distExist || retExist) {
            return res.status(400).json({ success: false, message: "Email is already registered." });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await Otp.findOneAndUpdate(
            { email },
            { otp: otpCode, createdAt: Date.now() },
            { upsert: true, returnDocument: 'after' }
        );

        const emailSent = await sendEmailOTP(email, name || 'User', otpCode);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP." });
        }

        return res.status(200).json({ success: true, message: "OTP sent successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken;
        if (!incomingRefreshToken) {
            return res.status(401).json({ success: false, message: "Refresh token is missing" });
        }

        const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET || "default_refresh_secret");

        let user;
        if (decoded.role === 'admin') user = await Admin.findById(decoded.id);
        else if (decoded.role === 'distributor') user = await Distributor.findById(decoded.id);
        else if (decoded.role === 'retailer') user = await Retailer.findById(decoded.id).populate('distributorId', 'distributorId name');

        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const newAccessToken = jwt.sign(
            { id: user._id, role: decoded.role, code: user.adminId || user.retailerId || (user.distributorId && user.distributorId._id ? user.distributorId.distributorId : user.distributorId) },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "15m" }
        );

        const userObj = user.toObject();
        delete userObj.password;

        return res.status(200).json({ 
            success: true, 
            token: newAccessToken, 
            role: decoded.role, 
            user: userObj 
        });

    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }
};

export const logoutUser = async (req, res) => {
    try {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error during logout" });
    }
};

export const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required" });
        }

        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        return res.status(200).json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error verifying email OTP", error: error.message });
    }
};

export const generateAadhaarOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, latitude, longitude, formData } = req.body;
        if (!merchantcode || !aadhaar) {
            return res.status(400).json({ success: false, message: "merchantcode and aadhaar are required" });
        }


        const response = await sendAadhaarOtp(merchantcode, aadhaar, latitude, longitude);
        if (response.success) {
            return res.status(200).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const verifyAadhaarOtp = async (req, res) => {
    try {
        const { merchantcode, aadhaar, otp, stateresp, ekyc_id, latitude, longitude } = req.body;
        if (!merchantcode || !aadhaar || !otp || !stateresp || !ekyc_id) {
            return res.status(400).json({ success: false, message: "Missing required fields for Aadhaar verification" });
        }

        const response = await verifyAadhaarOtpApi(merchantcode, aadhaar, otp, stateresp, ekyc_id, latitude, longitude);
        if (response.success) {
            return res.status(200).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const verifyPan = async (req, res) => {
    try {
        const { merchantcode, name, pan, dob, formData } = req.body;
        if (!merchantcode || !name || !pan || !dob) {
            return res.status(400).json({ success: false, message: "Missing required fields for PAN verification" });
        }


        const response = await verifyPanDetails(merchantcode, name, pan, dob);
        if (response.success) {
            return res.status(200).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const createDistributor = async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Only Admins can create Distributors." });

        const { 
            prefix, firstName, lastName, email, contactNumber, password, address, 
            businessName, businessAddress, aadhaarNumber, panNumber, hasGst, gstNumber,
            dob, dmtPackage, rechargePackage, aepsPackage, bbpsPackage, payoutPackage,
            cmsPackage, ccpayPackage, payinPackage, upiPackage, website, brandName,
            companyRegisterName, supportEmail, supportMobile
        } = req.body;
        
        const name = `${firstName} ${lastName}`;
        const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
        const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
        const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

        if (!aadhaarPictureLocalPath || !panPictureLocalPath) return res.status(400).json({ success: false, message: "Aadhaar and PAN pictures are required." });


        const profilePic = profilePictureLocalPath ? await uploadOnR2(profilePictureLocalPath) : null;
        const aadhaarPic = await uploadOnR2(aadhaarPictureLocalPath);
        const panPic = await uploadOnR2(panPictureLocalPath);

        let parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;

        const distributorId = req.body.merchantCode || `DT${customAlphabet('0123456789', 6)()}`;

        // Paysprint Merchant Onboarding / Verification
        const paysprintResponse = await onboardMerchant({
            merchantcode: distributorId,
            mobile: contactNumber,
            email,
            name,
            businessName,
            panNumber,
            panPictureUrl: panPic?.url,
            aadhaarNumber,
            aadhaarPictureUrl: aadhaarPic?.url,
            dob,
            address: parsedAddress,
            pincode: parsedAddress?.pincode || "110001"
        });

        // Strict rejection: If PaySprint fails, do not create the user in DB
        if (!paysprintResponse.success) {
            return res.status(400).json({ 
                success: false, 
                message: "PaySprint Onboarding Failed: " + (paysprintResponse.message || "Unknown error") 
            });
        }
        
        const isMerchantKycComplete = false; // They still need to do Web KYC
        
        const newDistributor = new Distributor({
            adminId: req.user.id,
            distributorId, name, prefix, firstName, lastName, email, contactNumber, password, address: parsedAddress,
            businessName, businessAddress, aadhaarNumber, aadhaarPicture: aadhaarPic?.url,
            panNumber, panPicture: panPic?.url, hasGst: hasGst === 'true' || hasGst === true, gstNumber,
            isMerchantKycComplete,
            profilePicture: profilePic?.url || null,
            dob, dmtPackage, rechargePackage, aepsPackage, bbpsPackage, payoutPackage,
            cmsPackage, ccpayPackage, payinPackage, upiPackage, website, brandName,
            companyRegisterName, supportEmail, supportMobile
        });

        await newDistributor.save();

        await Admin.findByIdAndUpdate(req.user.id, { $push: { distributors: newDistributor._id } });

        await Otp.deleteOne({ email });

        return res.status(201).json({ success: true, message: "Distributor created successfully.", data: newDistributor });
    } catch (error) {
        console.error("Create Distributor Error:", error);
        return res.status(500).json({ success: false, message: "Error creating distributor", error: error.message });
    }
};

export const createRetailer = async (req, res) => {
    try {
        if (req.user.role !== "distributor") return res.status(403).json({ success: false, message: "Only Distributors can create Retailers." });

        const { 
            prefix, firstName, lastName, email, contactNumber, password, address, 
            businessName, businessAddress, aadhaarNumber, panNumber, hasGst, gstNumber,
            dob, dmtPackage, rechargePackage, aepsPackage, bbpsPackage, payoutPackage,
            cmsPackage, ccpayPackage, payinPackage, upiPackage, website, brandName,
            companyRegisterName, supportEmail, supportMobile, isExistingMerchant
        } = req.body;

        const name = `${firstName} ${lastName}`;

        const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
        const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
        const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

        if (!aadhaarPictureLocalPath || !panPictureLocalPath) return res.status(400).json({ success: false, message: "Aadhaar and PAN pictures are required." });


        const profilePic = profilePictureLocalPath ? await uploadOnR2(profilePictureLocalPath) : null;
        const aadhaarPic = await uploadOnR2(aadhaarPictureLocalPath);
        const panPic = await uploadOnR2(panPictureLocalPath);

        let parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;

        const retailerId = req.body.merchantCode || `RT${customAlphabet('0123456789', 6)()}`;

        // Paysprint Merchant Onboarding / Verification
        // (Skipping this backend auto-onboarding because the endpoint returns HTML/404. 
        // Retailers will use the Web Onboarding API flow from their dashboard instead.)
        /*
        const paysprintResponse = await onboardMerchant({
            merchantcode: retailerId,
            mobile: contactNumber,
            email,
            name,
            businessName,
            panNumber,
            panPictureUrl: panPic?.url,
            aadhaarNumber,
            aadhaarPictureUrl: aadhaarPic?.url,
            dob,
            address: parsedAddress,
            pincode: parsedAddress?.pincode || "110001"
        });

        if (!paysprintResponse.success) {
            return res.status(400).json({ 
                success: false, 
                message: "PaySprint Onboarding Failed: " + (paysprintResponse.message || "Unknown error") 
            });
        }
        */
        
        const isMerchantKycComplete = false; // They still need to do Web KYC

        const newRetailer = new Retailer({
            distributorId: req.user.id,
            retailerId, name, prefix, firstName, lastName, email, contactNumber, password, address: parsedAddress,
            businessName, businessAddress, aadhaarNumber, aadhaarPicture: aadhaarPic?.url,
            panNumber, panPicture: panPic?.url, hasGst: hasGst === 'true' || hasGst === true, gstNumber,
            isMerchantKycComplete,
            profilePicture: profilePic?.url || null,
            dob, dmtPackage, rechargePackage, aepsPackage, bbpsPackage, payoutPackage,
            cmsPackage, ccpayPackage, payinPackage, upiPackage, website, brandName,
            companyRegisterName, supportEmail, supportMobile,
            isExistingMerchant: isExistingMerchant === 'true' || isExistingMerchant === true
        });

        await newRetailer.save();

        await Distributor.findByIdAndUpdate(req.user.id, { $push: { retailers: newRetailer._id } });

        await Otp.deleteOne({ email });

        return res.status(201).json({ success: true, message: "Retailer created successfully.", data: newRetailer });
    } catch (error) {
        console.error("Create Retailer Error:", error);
        return res.status(500).json({ success: false, message: "Error creating retailer", error: error.message });
    }
};

export const registerCustomer = async (req, res) => {
    try{
        const { username, email, contactNumber, password } = req.body;
        if(!username || !email || !contactNumber || !password){
            return res.status(400).json({success: false, message: "All fields are required"});
        }
        const isCustomerExist = await Customer.findOne({$or:[{email}, {username}, {contactNumber}]});
        if(isCustomerExist){
            return res.status(400).json({success: false, message: "Customer already exists"});
        }

        const retailer = await Retailer.findById(req.user.id);
        if(!retailer){
            return res.status(401).json({success: false, message: "You are not authorized to create customer"});
        }

        const customerId = `CS${customAlphabet('0123456789', 6)()}`;
        const createCustomer = await Customer.create({
            customerId,
            username,
            email,
            contactNumber,
            password
        });

        retailer.customers.push(createCustomer._id);
        await retailer.save();

        const token = await jwt.sign({ id: createCustomer._id}, process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET, {expiresIn: '1d'});
        return res.status(201).json({success: true, message: "Customer registered successfully", createCustomer, token});
    }
    catch(err){
        return res.status(500).json({success: false, message: err.message});
    }
}

export const getAllCustomer = async(req,res)=>{
    try {
        const retailer = await Retailer.findById(req.user.id);
        if(!retailer){
            return res.status(401).json({success: false, message: "You are not authorized to get customer"});
        }
        const customers = await Customer.find({retailer: retailer._id});
        return res.status(200).json({success: true, message: "Customers fetched successfully", customers});
    } catch (error) {
        return res.status(500).json({success: false, message: error.message});
    }
}

export const addBankAccount = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}

export const createAepsWallet = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}


export const createMainWallet = async(req,res)=>{
    try {
        
    } catch (error) {
        return res.status(500).json({success: false, message: err.message});
    }
}
export const generateOnboardUrl = async (req, res) => {
    try {
        const { merchantId, isNew, callbackUrl, pipe } = req.body;
        if (!merchantId) return res.status(400).json({ success: false, message: "merchantId is required" });

        let user;
        let merchantCode = merchantId; // Assume it's already the code
        
        // Try to find by retailerId or distributorId first
        user = await Retailer.findOne({ retailerId: merchantId });
        if (!user) {
            user = await Distributor.findOne({ distributorId: merchantId });
        }
        
        // If not found by code, try by ID
        if (!user) {
            // First check if it's a valid ObjectId to prevent Mongoose cast errors
            if (mongoose.Types.ObjectId.isValid(merchantId)) {
                user = await Retailer.findById(merchantId);
                if (!user) {
                    user = await Distributor.findById(merchantId);
                }
            }
        }
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Merchant not found." });
        }

        let merchantCodeFinal = user.retailerId || user.distributorId;
        if (!merchantCodeFinal) {
            merchantCodeFinal = merchantId;
        }

        const merchantData = {
            merchantcode: merchantCodeFinal.toString(),
            mobile: user.contactNumber,
            is_new: isNew === "1" || isNew === true ? true : (user.isExistingMerchant ? false : true),
            email: user.email,
            businessName: user.businessName || user.name,
            name: user.name,
            pipe: pipe,
            callbackUrl: callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/kyc-status`
        };

        const result = await getWebOnboardingUrl(merchantData);
        if (result.success) {
            if (result.alreadyOnboarded) {
                // Update DB since PaySprint says they are already onboarded
                if (user.retailerId) {
                    await Retailer.findOneAndUpdate({ retailerId: merchantCodeFinal }, { isMerchantKycComplete: true });
                } else if (user.distributorId) {
                    await Distributor.findOneAndUpdate({ distributorId: merchantCodeFinal }, { isMerchantKycComplete: true });
                }
                // Return callback URL so frontend redirects back gracefully
                return res.status(200).json({ success: true, url: merchantData.callbackUrl });
            }
            return res.status(200).json({ success: true, url: result.url });
        } else {
            return res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error("Generate Onboard URL error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateKycStatus = async (req, res) => {
    try {
        const { jwt: tokenStr } = req.body;
        if (!tokenStr) return res.status(400).json({ success: false, message: "JWT is required" });

        const jwtKeyBase64 = process.env.PAYSPRINT_JWT_KEY;
        let decoded;
        try {
            decoded = jwt.verify(tokenStr, jwtKeyBase64);
        } catch (err) {
            console.error("JWT Verification failed, attempting to decode without verification:", err.message);
            decoded = jwt.decode(tokenStr);
        }

        if (!decoded || !decoded.merchantcode) {
            return res.status(400).json({ success: false, message: "Invalid payload from PaySprint" });
        }

        const merchantCode = decoded.merchantcode;

        // Find the user and update
        const retailer = await Retailer.findOneAndUpdate({ retailerId: merchantCode }, { isMerchantKycComplete: true }, { new: true });
        if (retailer) return res.status(200).json({ success: true, message: "KYC Status updated" });

        const distributor = await Distributor.findOneAndUpdate({ distributorId: merchantCode }, { isMerchantKycComplete: true }, { new: true });
        if (distributor) return res.status(200).json({ success: true, message: "KYC Status updated" });

        return res.status(404).json({ success: false, message: "Merchant not found" });
    } catch (error) {
        console.error("Update KYC Status Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, contactNumber, businessName, address } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        let Model;
        if (role === 'admin') Model = Admin;
        else if (role === 'distributor') Model = Distributor;
        else if (role === 'retailer') Model = Retailer;
        else return res.status(400).json({ success: false, message: "Invalid role" });

        const updateData = {};
        if (name) updateData.name = name;
        if (contactNumber) updateData.contactNumber = contactNumber;
        if (businessName) updateData.businessName = businessName;
        if (address) {
            try {
                updateData.address = typeof address === 'string' ? JSON.parse(address) : address;
            } catch (e) {
                updateData.address = address;
            }
        }

        if (req.file) {
            const profilePicturePath = req.file.path;
            const profilePictureUrl = await uploadOnR2(profilePicturePath);
            if (profilePictureUrl) {
                updateData.profilePicture = profilePictureUrl.url || profilePictureUrl;
            }
        }

        const updatedUser = await Model.findByIdAndUpdate(userId, { $set: updateData }, { returnDocument: 'after' });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "Email, OTP, and new password are required." });
        }

        let Model;
        if (role === 'admin') Model = Admin;
        else if (role === 'distributor') Model = Distributor;
        else if (role === 'retailer') Model = Retailer;
        else return res.status(400).json({ success: false, message: "Invalid role" });

        const user = await Model.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (user.email !== email) {
            return res.status(400).json({ success: false, message: "Email does not match our records." });
        }

        // Verify OTP
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "OTP not found or expired." });
        }

        const isOtpValid = await bcrypt.compare(otp.toString(), otpRecord.otp);
        if (!isOtpValid) {
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        // Hash new password and save
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        // Delete OTP
        await Otp.deleteOne({ email });

        res.status(200).json({ success: true, message: "Password changed successfully." });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
