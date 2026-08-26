import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import Customer from '../models/users/customer.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import MainWallet from '../models/mainWallet.model.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import Admin from '../models/users/admin.model.js';
import { uploadOnR2 } from '../utils/r2.js';
import bcrypt from 'bcrypt';
import Otp from '../models/otp.model.js';
import { sendEmailOTP } from '../utils/email.js';
import {
  onboardMerchant,
  sendAadhaarOtp,
  verifyAadhaarOtp as verifyAadhaarOtpApi,
  verifyPanDetails,
  getWebOnboardingUrl,
  decryptPayload,
  generatePaySprintToken,
  getOnboardStatusEndpoint,
  isWebKycDone,
  getOnboardStatus,
} from '../utils/paysprint.util.js';
import axios from 'axios';

export const registerAdmin = async (req, res) => {
  try {
    const { username, email, contactNumber, password } = req.body;
    if (!username || !email || !contactNumber || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const isAdminExist = await Admin.findOne({ $or: [{ email }, { username }, { contactNumber }] });
    if (isAdminExist) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }
    const adminId = `AD${customAlphabet('0123456789', 6)()}`;
    // Admins do not require KYC for onboarding.
    const createAdmin = await Admin.create({
      adminId,
      name: req.body.name || username,
      email,
      contactNumber,
      password,
      ...(req.body.businessName && { businessName: req.body.businessName }),
      ...(req.body.businessAddress && { businessAddress: req.body.businessAddress }),
      ...(req.body.aadhaarNumber && { aadhaarNumber: req.body.aadhaarNumber }),
      ...(req.body.panNumber && { panNumber: req.body.panNumber }),
      ...(req.body.address
        ? {
            address:
              typeof req.body.address === 'string'
                ? JSON.parse(req.body.address)
                : req.body.address,
          }
        : {}),
    });
    const token = await jwt.sign({ id: createAdmin._id }, process.env.ADMIN_JWT_SECRET, {
      expiresIn: '1d',
    });
    return res
      .status(201)
      .json({ success: true, message: 'Admin registered successfully', createAdmin, token });
  } catch (error) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Unified login for all roles
export const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Identifier and password are required.' });
    }

    let user = await Admin.findOne({
      $or: [{ adminId: identifier }, { email: identifier }, { contactNumber: identifier }],
    });
    let role = 'admin';

    if (!user) {
      user = await Distributor.findOne({
        $or: [{ distributorId: identifier }, { email: identifier }, { contactNumber: identifier }],
      });
      role = 'distributor';
    }

    if (!user) {
      user = await Retailer.findOne({
        $or: [{ retailerId: identifier }, { email: identifier }, { contactNumber: identifier }],
      }).populate('distributorId', 'distributorId name');
      role = 'retailer';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is inactive.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email: user.email },
      { otp: otpCode, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    const emailSent = await sendEmailOTP(user.email, user.name || 'User', otpCode);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      email: user.email,
      requireOtp: true,
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Cookie flags for the refresh token, matched to how the request actually
 * arrived. Behind a proxy the original scheme is only visible in
 * x-forwarded-proto, so both are checked.
 *
 * Native clients never use this cookie — they get the refresh token in the
 * response body, which is the only path that survives plain HTTP.
 */
const refreshCookieOptions = (req) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    // SameSite=None is invalid without Secure; browsers reject the whole cookie.
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

export const verifyLoginOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required.' });
    }

    let user = await Admin.findOne({
      $or: [{ adminId: identifier }, { email: identifier }, { contactNumber: identifier }],
    });
    let role = 'admin';

    if (!user) {
      user = await Distributor.findOne({
        $or: [{ distributorId: identifier }, { email: identifier }, { contactNumber: identifier }],
      });
      role = 'distributor';
    }

    if (!user) {
      user = await Retailer.findOne({
        $or: [{ retailerId: identifier }, { email: identifier }, { contactNumber: identifier }],
      }).populate('distributorId', 'distributorId name');
      role = 'retailer';
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const otpRecord = await Otp.findOne({ email: user.email });
    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await Otp.deleteOne({ email: user.email });

    const accessToken = jwt.sign(
      {
        id: user._id,
        role: role,
        code:
          user.adminId ||
          user.retailerId ||
          (user.distributorId && user.distributorId._id
            ? user.distributorId.distributorId
            : user.distributorId),
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: role },
      process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
      { expiresIn: '7d' }
    );

    const userObj = user.toObject();
    delete userObj.password;

    // `secure: true` makes the browser drop the cookie entirely over plain
    // HTTP, and `sameSite: 'none'` is only legal alongside it — so a server
    // reachable over http:// silently issued no refresh cookie at all. Follow
    // the actual protocol instead of assuming TLS.
    res.cookie('refreshToken', refreshToken, refreshCookieOptions(req));

    // Fire off background pipe synchronization for retailers
    if (role === 'retailer') {
      import('./aepsPayment.controller.js')
        .then(({ syncMerchantPipes }) => {
          syncMerchantPipes(user.retailerId).catch((err) =>
            console.error('Background sync failed:', err)
          );
        })
        .catch((err) => console.error('Failed to import sync function:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      // Native clients have no cookie jar for a `Secure; SameSite=None`
      // cookie, so they get the refresh token in the body instead.
      refreshToken,
      role,
      user: userObj,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const sendVerificationOtp = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const adminExist = await Admin.findOne({ email });
    const distExist = await Distributor.findOne({ email });
    const retExist = await Retailer.findOne({ email });

    if (adminExist || distExist || retExist) {
      return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    const emailSent = await sendEmailOTP(email, name || 'User', otpCode);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token is missing' });
    }

    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.JWT_REFRESH_SECRET || 'default_refresh_secret'
    );

    let user;
    if (decoded.role === 'admin') user = await Admin.findById(decoded.id);
    else if (decoded.role === 'distributor') user = await Distributor.findById(decoded.id);
    else if (decoded.role === 'retailer')
      user = await Retailer.findById(decoded.id).populate('distributorId', 'distributorId name');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        role: decoded.role,
        code:
          user.adminId ||
          user.retailerId ||
          (user.distributorId && user.distributorId._id
            ? user.distributorId.distributorId
            : user.distributorId),
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '15m' }
    );

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({
      success: true,
      token: newAccessToken,
      refreshToken: incomingRefreshToken,
      role: decoded.role,
      user: userObj,
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

export const logoutUser = async (req, res) => {
  try {
    // Must mirror the attributes used when setting it, or the browser keeps it.
    // Flags must match the ones the cookie was set with, or the browser keeps it.
    const { maxAge: _ignored, ...clearOptions } = refreshCookieOptions(req);
    res.clearCookie('refreshToken', clearOptions);
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error during logout' });
  }
};

/**
 * OTP for changing the password of the *signed-in* user.
 * `sendVerificationOtp` deliberately refuses addresses that already belong to
 * an account (it guards signup), so it can never serve this flow. The email is
 * taken from the access token, never from the body.
 * @route POST /api/auth/send-password-otp
 */
export const sendPasswordOtp = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'No email on file for this account.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    const sent = await sendEmailOTP(email, req.user?.name || 'User', otpCode);
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }

    return res
      .status(200)
      .json({ success: true, message: 'OTP sent to your registered email', email });
  } catch (error) {
    console.error('Send password OTP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Error verifying email OTP', error: error.message });
  }
};

export const generateAadhaarOtp = async (req, res) => {
  try {
    const { merchantcode, aadhaar, latitude, longitude, formData } = req.body;
    if (!merchantcode || !aadhaar) {
      return res
        .status(400)
        .json({ success: false, message: 'merchantcode and aadhaar are required' });
    }

    const response = await sendAadhaarOtp(merchantcode, aadhaar, latitude, longitude);
    if (response.success) {
      return res.status(200).json(response);
    } else {
      return res.status(400).json(response);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const verifyAadhaarOtp = async (req, res) => {
  try {
    const { merchantcode, aadhaar, otp, stateresp, ekyc_id, latitude, longitude } = req.body;
    if (!merchantcode || !aadhaar || !otp || !stateresp || !ekyc_id) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields for Aadhaar verification' });
    }

    const response = await verifyAadhaarOtpApi(
      merchantcode,
      aadhaar,
      otp,
      stateresp,
      ekyc_id,
      latitude,
      longitude
    );
    if (response.success) {
      return res.status(200).json(response);
    } else {
      return res.status(400).json(response);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const verifyPan = async (req, res) => {
  try {
    const { merchantcode, name, pan, dob, formData } = req.body;
    if (!merchantcode || !name || !pan || !dob) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields for PAN verification' });
    }

    const response = await verifyPanDetails(merchantcode, name, pan, dob);
    if (response.success) {
      return res.status(200).json(response);
    } else {
      return res.status(400).json(response);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const createDistributor = async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res
        .status(403)
        .json({ success: false, message: 'Only Admins can create Distributors.' });

    const {
      prefix,
      firstName,
      lastName,
      email,
      contactNumber,
      password,
      address,
      businessName,
      businessAddress,
      aadhaarNumber,
      panNumber,
      hasGst,
      gstNumber,
      dob,
      dmtPackage,
      rechargePackage,
      aepsPackage,
      bbpsPackage,
      payoutPackage,
      cmsPackage,
      ccpayPackage,
      payinPackage,
      upiPackage,
      website,
      brandName,
      companyRegisterName,
      supportEmail,
      supportMobile,
    } = req.body;

    const name = `${firstName} ${lastName}`;
    const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
    const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
    const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

    const profilePic = profilePictureLocalPath ? await uploadOnR2(profilePictureLocalPath) : null;
    const aadhaarPic = aadhaarPictureLocalPath ? await uploadOnR2(aadhaarPictureLocalPath) : null;
    const panPic = panPictureLocalPath ? await uploadOnR2(panPictureLocalPath) : null;

    let parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;

    const distributorId = req.body.merchantCode || `DT${customAlphabet('0123456789', 6)()}`;

    // Distributors do not require KYC onboarding.

    const isMerchantKycComplete = true; // No KYC required for distributors

    const newDistributor = new Distributor({
      adminId: req.user.id,
      distributorId,
      name,
      prefix,
      firstName,
      lastName,
      email,
      contactNumber,
      password,
      address: parsedAddress,
      businessName,
      businessAddress,
      aadhaarNumber: aadhaarNumber || undefined,
      aadhaarPicture: aadhaarPic?.url,
      panNumber: panNumber || undefined,
      panPicture: panPic?.url,
      hasGst: hasGst === 'true' || hasGst === true,
      gstNumber,
      isMerchantKycComplete,
      profilePicture: profilePic?.url || null,
      dob,
      dmtPackage,
      rechargePackage,
      aepsPackage,
      bbpsPackage,
      payoutPackage,
      cmsPackage,
      ccpayPackage,
      payinPackage,
      upiPackage,
      website,
      brandName,
      companyRegisterName,
      supportEmail,
      supportMobile,
    });

    await newDistributor.save();

    await Admin.findByIdAndUpdate(req.user.id, { $push: { distributors: newDistributor._id } });

    await Otp.deleteOne({ email });

    return res
      .status(201)
      .json({ success: true, message: 'Distributor created successfully.', data: newDistributor });
  } catch (error) {
    console.error('Create Distributor Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error creating distributor', error: error.message });
  }
};

export const createRetailer = async (req, res) => {
  try {
    if (req.user.role !== 'distributor')
      return res
        .status(403)
        .json({ success: false, message: 'Only Distributors can create Retailers.' });

    const {
      prefix,
      firstName,
      lastName,
      email,
      contactNumber,
      password,
      address,
      businessName,
      businessAddress,
      aadhaarNumber,
      panNumber,
      hasGst,
      gstNumber,
      dob,
      dmtPackage,
      rechargePackage,
      aepsPackage,
      bbpsPackage,
      payoutPackage,
      cmsPackage,
      ccpayPackage,
      payinPackage,
      upiPackage,
      website,
      brandName,
      companyRegisterName,
      supportEmail,
      supportMobile,
      isExistingMerchant,
    } = req.body;

    const name = `${firstName} ${lastName}`;

    const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
    const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
    const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

    if (!aadhaarPictureLocalPath || !panPictureLocalPath)
      return res
        .status(400)
        .json({ success: false, message: 'Aadhaar and PAN pictures are required.' });

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
      retailerId,
      name,
      prefix,
      firstName,
      lastName,
      email,
      contactNumber,
      password,
      address: parsedAddress,
      businessName,
      businessAddress,
      aadhaarNumber,
      aadhaarPicture: aadhaarPic?.url,
      panNumber,
      panPicture: panPic?.url,
      hasGst: hasGst === 'true' || hasGst === true,
      gstNumber,
      isMerchantKycComplete,
      profilePicture: profilePic?.url || null,
      dob,
      dmtPackage,
      rechargePackage,
      aepsPackage,
      bbpsPackage,
      payoutPackage,
      cmsPackage,
      ccpayPackage,
      payinPackage,
      upiPackage,
      website,
      brandName,
      companyRegisterName,
      supportEmail,
      supportMobile,
      isExistingMerchant: isExistingMerchant === 'true' || isExistingMerchant === true,
    });

    await newRetailer.save();

    await Distributor.findByIdAndUpdate(req.user.id, { $push: { retailers: newRetailer._id } });

    await Otp.deleteOne({ email });

    return res
      .status(201)
      .json({ success: true, message: 'Retailer created successfully.', data: newRetailer });
  } catch (error) {
    console.error('Create Retailer Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error creating retailer', error: error.message });
  }
};

export const registerCustomer = async (req, res) => {
  try {
    const { username, email, contactNumber, password } = req.body;
    if (!username || !email || !contactNumber || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const isCustomerExist = await Customer.findOne({
      $or: [{ email }, { username }, { contactNumber }],
    });
    if (isCustomerExist) {
      return res.status(400).json({ success: false, message: 'Customer already exists' });
    }

    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res
        .status(401)
        .json({ success: false, message: 'You are not authorized to create customer' });
    }

    const customerId = `CS${customAlphabet('0123456789', 6)()}`;
    const createCustomer = await Customer.create({
      customerId,
      username,
      email,
      contactNumber,
      password,
    });

    retailer.customers.push(createCustomer._id);
    await retailer.save();

    const token = await jwt.sign(
      { id: createCustomer._id },
      process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    return res
      .status(201)
      .json({ success: true, message: 'Customer registered successfully', createCustomer, token });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllCustomer = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res
        .status(401)
        .json({ success: false, message: 'You are not authorized to get customer' });
    }
    const customers = await Customer.find({ retailer: retailer._id });
    return res
      .status(200)
      .json({ success: true, message: 'Customers fetched successfully', customers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addBankAccount = async (req, res) => {
  try {
  } catch (error) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createAepsWallet = async (req, res) => {
  try {
  } catch (error) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createMainWallet = async (req, res) => {
  try {
  } catch (error) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
export const generateOnboardUrl = async (req, res) => {
  try {
    const { merchantId, isNew, callbackUrl, pipe } = req.body;
    if (!merchantId)
      return res.status(400).json({ success: false, message: 'merchantId is required' });

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
      return res.status(404).json({ success: false, message: 'Merchant not found.' });
    }

    let merchantCodeFinal = user.retailerId || user.distributorId;
    if (!merchantCodeFinal) {
      merchantCodeFinal = merchantId;
    }

    let finalIsNew;
    if (isNew === '0' || isNew === false) {
      finalIsNew = false;
    } else if (isNew === '1' || isNew === true) {
      finalIsNew = true;
    } else {
      finalIsNew = !user.isExistingMerchant;
    }

    const merchantData = {
      merchantcode: merchantCodeFinal.toString(),
      mobile: user.contactNumber,
      is_new: finalIsNew,
      email: user.email,
      businessName: user.businessName || user.name,
      name: user.name,
      pipe: pipe,
      callbackUrl:
        callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/kyc-status`,
    };

    // ──────────────────────────────────────────────────────────────────────
    // PRE-CHECK: If the merchant is ALREADY onboarded/accepted on this pipe at
    // PaySprint, don't bounce them to the onboarding page and back (the loop).
    // Mark KYC complete locally and return alreadyOnboarded so the frontend
    // can proceed/closes cleanly.
    // ──────────────────────────────────────────────────────────────────────
    const pipesToCheck = pipe
      ? [String(pipe).toLowerCase()]
      : ['bank3', 'bank2', 'bank4', 'bank5', 'bank6'];
    const acceptedPipes = [];
    for (const p of pipesToCheck) {
      try {
        const checkToken = generatePaySprintToken();
        const checkRes = await axios.post(
          getOnboardStatusEndpoint(p),
          {
            merchantcode: merchantCodeFinal.toString(),
            mobile: String(user.contactNumber),
            pipe: p,
          },
          {
            headers: {
              Token: checkToken,
              Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
              'Content-Type': 'application/json',
            },
            validateStatus: () => true,
            timeout: 10000,
          }
        );
        console.log(`[generateOnboardUrl] Pipe ${p} status:`, JSON.stringify(checkRes.data));
        if (
          checkRes.data &&
          checkRes.data.response_code === 1 &&
          checkRes.data.is_approved === 'Accepted'
        ) {
          acceptedPipes.push(p);
        }
      } catch (e) {
        console.warn(`[generateOnboardUrl] Could not pre-check pipe ${p}:`, e.message);
      }
    }

    if (acceptedPipes.length > 0) {
      // Mark KYC complete locally + store the pipes that are actually active.
      const updateObj = {
        isMerchantKycComplete: true,
        activeAepsPipes: acceptedPipes,
        lastPipeCheckDate: new Date(),
      };
      if (user.retailerId) {
        await Retailer.findOneAndUpdate({ retailerId: merchantCodeFinal }, updateObj);
      } else if (user.distributorId) {
        await Distributor.findOneAndUpdate({ distributorId: merchantCodeFinal }, updateObj);
      }
      return res.status(200).json({
        success: true,
        alreadyOnboarded: true,
        message: 'Merchant already onboarded',
        pipes: acceptedPipes,
      });
    }

    const result = await getWebOnboardingUrl(merchantData);
    if (result.success) {
      if (result.alreadyOnboarded) {
        // getonboardurl reports "already onboarded" whenever the merchant
        // exists on ANY pipe. If a specific pipe was requested but it is
        // NOT in the accepted set from the pre-check above, the merchant
        // still needs to be onboarded on that pipe — do NOT claim success.
        const requestedPipe = pipe ? String(pipe).toLowerCase() : null;
        if (requestedPipe && !acceptedPipes.includes(requestedPipe)) {
          // Merchant exists on another pipe but not the requested one.
          // PaySprint's getonboardurl returns "already onboarded" for an
          // existing merchant regardless of is_new/pipe, so there is no
          // web path to add the pipe — surface it honestly.
          return res.status(400).json({
            success: false,
            message: `Merchant is already onboarded with PaySprint but NOT on ${requestedPipe}. Please complete ${requestedPipe} onboarding (via PaySprint support if the web flow is blocked).`,
          });
        }
        // Verify with PaySprint's LIVE status before persisting — getonboardurl
        // saying "already onboarded" is NOT proof that web KYC was completed on
        // this pipe. Only mark the merchant KYC-complete when PaySprint confirms it.
        const pipesToVerify = requestedPipe
          ? [requestedPipe]
          : ['bank3', 'bank2', 'bank4', 'bank5', 'bank6'];
        let liveWebKycDone = false;
        for (const p of pipesToVerify) {
          const live = await getOnboardStatus(
            merchantCodeFinal.toString(),
            String(user.contactNumber || ''),
            p
          );
          console.log(
            `[generateOnboardUrl] verify pipe ${p} for ${merchantCodeFinal}:`,
            JSON.stringify(live)
          );
          if (live && isWebKycDone(live)) {
            liveWebKycDone = true;
            break;
          }
        }
        // Update DB only when PaySprint actually confirms web onboarding is done.
        if (liveWebKycDone) {
          if (user.retailerId) {
            await Retailer.findOneAndUpdate(
              { retailerId: merchantCodeFinal },
              { isMerchantKycComplete: true }
            );
          } else if (user.distributorId) {
            await Distributor.findOneAndUpdate(
              { distributorId: merchantCodeFinal },
              { isMerchantKycComplete: true }
            );
          }
        }
        // Return callback URL so frontend redirects back gracefully
        return res.status(200).json({ success: true, alreadyOnboarded: true });
      }
      return res.status(200).json({ success: true, url: result.url });
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Generate Onboard URL error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Paysprint's onboarding callback sends `?data=<payload>` where payload can be
// a signed JWT, an AES-encrypted JSON string, or plain JSON. Try each strategy.
const parseOnboardCallbackData = (tokenStr) => {
  // 1) Signed JWT
  try {
    const decoded = jwt.verify(tokenStr, process.env.PAYSPRINT_JWT_KEY);
    if (decoded && decoded.merchantcode) return decoded;
  } catch (e) {
    // fall through
  }

  // 2) Unsigned JWT (decode without verification)
  try {
    const decoded = jwt.decode(tokenStr);
    if (decoded && typeof decoded === 'object' && decoded.merchantcode) return decoded;
  } catch (e) {
    // fall through
  }

  // 3) AES-decrypted JSON blob
  try {
    const decrypted = decryptPayload(tokenStr);
    const parsed = JSON.parse(decrypted);
    if (parsed && parsed.merchantcode) return parsed;
  } catch (e) {
    // fall through
  }

  // 4) Plain JSON string
  try {
    const parsed = JSON.parse(tokenStr);
    if (parsed && parsed.merchantcode) return parsed;
  } catch (e) {
    // fall through
  }

  return null;
};

export const updateKycStatus = async (req, res) => {
  try {
    const { jwt: tokenStr } = req.body;
    if (!tokenStr) return res.status(400).json({ success: false, message: 'JWT/Data is required' });

    const decoded = parseOnboardCallbackData(tokenStr);

    if (!decoded || !decoded.merchantcode) {
      return res.status(400).json({ success: false, message: 'Invalid payload from PaySprint' });
    }

    const merchantCode = decoded.merchantcode;

    // Load the merchant's real contact number from the DB — the callback payload may
    // omit `mobile`, and PaySprint's getonboardstatus needs it for the verification call.
    let existingUser = await Retailer.findOne({ retailerId: merchantCode });
    if (!existingUser) existingUser = await Distributor.findOne({ distributorId: merchantCode });
    const mobile = existingUser?.contactNumber
      ? String(existingUser.contactNumber)
      : String(decoded.mobile || '');

    // status "0" means onboarding is still PENDING -> must not be marked complete.
    // Only accept a genuinely successful callback status.
    const status = String(decoded.status ?? '');
    const isSuccess = status === '1' || status === 'true' || status === '2';

    // Persist the same pipe(s) reported as bank / active pipes.
    const updateData = {};
    if (decoded.bank) {
      const activePipes = [];
      if (decoded.bank.Bank2 === 1 || decoded.bank.Bank2 === '1') activePipes.push('bank2');
      if (decoded.bank.Bank3 === 1 || decoded.bank.Bank3 === '1') activePipes.push('bank3');
      if (decoded.bank.Bank4 === 1 || decoded.bank.Bank4 === '1') activePipes.push('bank4');
      if (decoded.bank.Bank5 === 1 || decoded.bank.Bank5 === '1') activePipes.push('bank5');
      if (decoded.bank.Bank6 === 1 || decoded.bank.Bank6 === '1') activePipes.push('bank6');
      if (activePipes.length) updateData.activeAepsPipes = activePipes;
    }

    // NEVER trust the local isMerchantKycComplete flag or the callback payload on its
    // own. Merely opening the PaySprint web onboarding page can fire a callback (or
    // flip a local flag) before web KYC is actually complete. So when the callback
    // claims success, re-verify against PaySprint's live getonboardstatus: only mark
    // web KYC complete when PaySprint actually confirms the merchant is onboarded.
    let webKycVerified = false;
    if (isSuccess) {
      const pipesToVerify =
        updateData.activeAepsPipes && updateData.activeAepsPipes.length
          ? updateData.activeAepsPipes
          : ['bank3', 'bank2', 'bank4', 'bank5', 'bank6'];
      for (const p of pipesToVerify) {
        const live = await getOnboardStatus(merchantCode, mobile, p);
        console.log(
          `[updateKycStatus] verify pipe ${p} for ${merchantCode}:`,
          JSON.stringify(live)
        );
        if (live && isWebKycDone(live)) {
          webKycVerified = true;
          break;
        }
      }
    }

    const finalSuccess = isSuccess && webKycVerified;
    updateData.isMerchantKycComplete = finalSuccess;

    const retailer = await Retailer.findOneAndUpdate({ retailerId: merchantCode }, updateData, {
      new: true,
    });
    if (retailer) {
      return res.status(200).json({
        success: finalSuccess,
        message: finalSuccess
          ? 'KYC Status updated'
          : 'Onboarding is still pending. Please complete onboarding again.',
        isPending: !finalSuccess,
      });
    }

    const distributor = await Distributor.findOneAndUpdate(
      { distributorId: merchantCode },
      updateData,
      { new: true }
    );
    if (distributor) {
      return res.status(200).json({
        success: finalSuccess,
        message: finalSuccess
          ? 'KYC Status updated'
          : 'Onboarding is still pending. Please complete onboarding again.',
        isPending: !finalSuccess,
      });
    }

    return res.status(404).json({ success: false, message: 'Merchant not found' });
  } catch (error) {
    console.error('Update KYC Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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
    else return res.status(400).json({ success: false, message: 'Invalid role' });

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

    const updatedUser = await Model.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res
      .status(200)
      .json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    let Model;
    if (role === 'admin') Model = Admin;
    else if (role === 'distributor') Model = Distributor;
    else if (role === 'retailer') Model = Retailer;
    else return res.status(400).json({ success: false, message: 'Invalid role' });

    const user = await Model.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.email !== email) {
      return res.status(400).json({ success: false, message: 'Email does not match our records.' });
    }

    // Verify OTP
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'OTP not found or expired.' });
    }

    const isOtpValid = await bcrypt.compare(otp.toString(), otpRecord.otp);
    if (!isOtpValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Delete OTP
    await Otp.deleteOne({ email });

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
