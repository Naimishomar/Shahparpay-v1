import fs from 'fs';
import { readAadhaarQr } from '../utils/aadhaarQr.js';
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
import { parseDisabledServices } from '../utils/services.js';
import { logActivity } from '../utils/activity.js';
import { sendEmailOTP } from '../utils/email.js';

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

    // One answer for "no such user" and "wrong password", so the login form
    // cannot be used to find out which IDs, emails and phones are registered.
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) {
      logActivity({ req, actor: { _id: user._id, role, name: user.name }, action: 'auth.login_failed', summary: 'Failed sign-in: wrong password' });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is inactive.' });

    // Generate OTP
    const otpCode = await Otp.issue(user.email);

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
const signRefreshToken = (user, role) =>
  jwt.sign({ id: user._id, role, v: user.tokenVersion ?? 0 }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });

const MODEL_BY_ROLE = { admin: Admin, distributor: Distributor, retailer: Retailer };

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

    if (!(await Otp.consume(user.email, otp))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

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
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = signRefreshToken(user, role);

    logActivity({ req, actor: { _id: user._id, role, name: user.name }, action: 'auth.login', summary: 'Signed in' });

    const userObj = user.toObject();
    delete userObj.password;

    // `secure: true` makes the browser drop the cookie entirely over plain
    // HTTP, and `sameSite: 'none'` is only legal alongside it — so a server
    // reachable over http:// silently issued no refresh cookie at all. Follow
    // the actual protocol instead of assuming TLS.
    res.cookie('refreshToken', refreshToken, refreshCookieOptions(req));

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

    const otpCode = await Otp.issue(email);

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

    const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    });

    let user;
    if (decoded.role === 'admin') user = await Admin.findById(decoded.id);
    else if (decoded.role === 'distributor') user = await Distributor.findById(decoded.id);
    else if (decoded.role === 'retailer')
      user = await Retailer.findById(decoded.id).populate('distributorId', 'distributorId name');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }
    // Logout and password changes bump tokenVersion, retiring every older refresh token.
    if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
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
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const userObj = user.toObject();
    delete userObj.password;

    // Rotate: hand out a fresh refresh token every time.
    const newRefreshToken = signRefreshToken(user, decoded.role);
    if (req.cookies?.refreshToken) res.cookie('refreshToken', newRefreshToken, refreshCookieOptions(req));

    return res.status(200).json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      role: decoded.role,
      user: userObj,
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

/**
 * POST /api/auth/logout { everywhere?: boolean }
 *
 * By default only this device signs out: it drops its own tokens. With
 * `everywhere`, tokenVersion is bumped and every device's refresh token dies.
 * ponytail: a single-device logout does not revoke that device's refresh token
 * server-side (rotated tokens are not revoked either); a jti denylist would.
 */
export const logoutUser = async (req, res) => {
  try {
    if (req.body?.everywhere === true) {
      await MODEL_BY_ROLE[req.user.role]?.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    }
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

    const otpCode = await Otp.issue(email);

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

    // Signup-only: for a registered address this would be an oracle for the
    // password-reset code, so refuse those outright.
    const registered =
      (await Admin.exists({ email })) || (await Distributor.exists({ email })) || (await Retailer.exists({ email }));
    if (registered || !(await Otp.check(email, otp))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Error verifying email OTP', error: error.message });
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
    logActivity({ req, action: 'distributor.create', target: { _id: newDistributor._id, role: 'distributor', name: newDistributor.name }, summary: `Created distributor ${newDistributor.name}` });

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

/**
 * POST /signup-retailer (public, multipart): a retailer signs up from the app
 * with the distributor's form. The email must carry a fresh OTP. The account
 * waits for an admin, who approves it and picks the distributor.
 */
export const signupRetailer = async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp || !(await Otp.check(email, otp))) {
    return res.status(400).json({ success: false, message: 'Verify your email with the OTP first.' });
  }
  req.selfSignup = true;
  return createRetailer(req, res);
};

export const createRetailer = async (req, res) => {
  try {
    const self = req.selfSignup === true;
    if (!self && req.user?.role !== 'distributor')
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
      disabledServices,
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

    // Only a distributor may carry over an existing merchant code.
    const retailerId = (!self && req.body.merchantCode) || `RT${customAlphabet('0123456789', 6)()}`;

    const isMerchantKycComplete = false; // Set once AEPS onboarding completes

    const newRetailer = new Retailer({
      distributorId: self ? null : req.user.id,
      signupSource: self ? 'self' : 'distributor',
      verificationStatus: self ? 'pending' : 'approved',
      verifiedAt: self ? null : new Date(),
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
      isExistingMerchant: !self && (isExistingMerchant === 'true' || isExistingMerchant === true),
      // Services are a distributor's call; a self signup starts with all on.
      disabledServices: self ? [] : parseDisabledServices(disabledServices) || [],
    });

    await newRetailer.save();
    const target = { _id: newRetailer._id, role: 'retailer', name: newRetailer.name };
    await Otp.deleteOne({ email });
    if (self) {
      logActivity({ req, actor: target, action: 'retailer.signup', target, summary: `Retailer ${newRetailer.name} (${newRetailer.retailerId}) signed up; awaiting admin verification` });
      return res.status(201).json({
        success: true,
        message: 'Account created. An admin will verify it; you can sign in to check the status.',
        data: { retailerId: newRetailer.retailerId, verificationStatus: newRetailer.verificationStatus },
      });
    }

    logActivity({ req, action: 'retailer.create', target, summary: `Onboarded retailer ${newRetailer.name} (${newRetailer.retailerId})` });

    await Distributor.findByIdAndUpdate(req.user.id, { $push: { retailers: newRetailer._id } });

    return res
      .status(201)
      .json({ success: true, message: 'Retailer created successfully.', data: newRetailer });
  } catch (error) {
    if (error?.code === 11000) {
      const field = { email: 'email', contactNumber: 'mobile number', aadhaarNumber: 'Aadhaar', panNumber: 'PAN', retailerId: 'retailer ID' }[Object.keys(error.keyPattern || {})[0]] || 'detail';
      return res.status(409).json({ success: false, message: `This ${field} is already registered.` });
    }
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
    if (contactNumber) {
      // The number is a login identifier: it must look like a phone number and be nobody else's.
      if (!/^[6-9]\d{9}$/.test(String(contactNumber))) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });
      }
      const taken = await Promise.all(
        [Admin, Distributor, Retailer].map((M) => M.exists({ contactNumber: String(contactNumber), _id: { $ne: userId } }))
      );
      if (taken.some(Boolean)) {
        return res.status(400).json({ success: false, message: 'This mobile number is already registered.' });
      }
      updateData.contactNumber = String(contactNumber);
    }
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

    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ success: false, message: 'New password must be at least 6 characters long.' });
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

    if (!(await Otp.consume(email, otp))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Assigned in the clear: every user schema's pre('save') hook hashes a
    // modified password, so hashing here too would store a hash of a hash and
    // lock the user out.
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    logActivity({ req, actor: { _id: user._id, role, name: user.name }, action: 'auth.password_change', summary: 'Changed password' });

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please provide your User ID, Email, or Contact Number.' });
    }

    const trimmed = identifier.trim();
    let user = await Retailer.findOne({
      $or: [{ email: trimmed.toLowerCase() }, { contactNumber: trimmed }, { retailerId: trimmed }]
    });

    if (!user) {
      user = await Distributor.findOne({
        $or: [{ email: trimmed.toLowerCase() }, { contactNumber: trimmed }, { distributorId: trimmed }]
      });
    }

    if (!user) {
      user = await Admin.findOne({
        $or: [{ email: trimmed.toLowerCase() }, { contactNumber: trimmed }, { username: trimmed }]
      });
    }

    if (!user || !user.email) {
      return res.status(404).json({ success: false, message: 'No registered account found with these details.' });
    }

    const otpCode = await Otp.issue(user.email);

    await sendEmailOTP(user.email, user.name || user.ownerName || 'Merchant', otpCode);

    const parts = user.email.split('@');
    const maskedEmail = parts[0].substring(0, 2) + '***' + (parts[0].length > 4 ? parts[0].slice(-1) : '') + '@' + parts[1];

    return res.status(200).json({
      success: true,
      message: `Password reset OTP has been sent to your registered email (${maskedEmail}).`,
      email: user.email,
      maskedEmail
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string' || !email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    if (!(await Otp.consume(email, otp))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    let user = await Retailer.findOne({ email });
    if (!user) user = await Distributor.findOne({ email });
    if (!user) user = await Admin.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    logActivity({
      req,
      // Model name gives the role: Retailer | Distributor | Admin.
      actor: { _id: user._id, role: user.constructor.modelName.toLowerCase(), name: user.name },
      action: 'auth.password_reset',
      summary: 'Reset password with an emailed code',
    });

    return res.status(200).json({ success: true, message: 'Password has been reset successfully! You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * POST /aadhaar-address (multipart `image`): reads the QR on the back of an
 * Aadhaar so the onboarding form can fill the address. The photo is not kept.
 */
export const readAadhaarAddress = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath || !req.file.mimetype?.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Upload a photo of the back of the Aadhaar.' });
    }
    const address = await readAadhaarQr(filePath);
    if (!address) {
      return res.status(422).json({
        success: false,
        message: 'Could not read the QR on this photo. Take a clear photo of the whole back side, or type the address.',
      });
    }
    return res.status(200).json({ success: true, message: 'Address read from the Aadhaar QR', data: address });
  } catch (error) {
    console.error('Aadhaar QR read error:', error.message);
    return res.status(422).json({ success: false, message: 'Could not read this photo. Type the address instead.' });
  } finally {
    if (filePath) fs.promises.unlink(filePath).catch(() => {});
  }
};
