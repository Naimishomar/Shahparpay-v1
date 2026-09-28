import mongoose from 'mongoose';
import Distributor from '../models/users/distributor.model.js';
import Retailer from '../models/users/retailer.model.js';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import { uploadOnR2 } from '../utils/r2.js';
import { lifetimeFor } from './distributorAnalytics.controller.js';
import { parseDisabledServices } from '../utils/services.js';
import { logActivity } from '../utils/activity.js';

// Get dashboard statistics for distributor
export const getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'distributor') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    const distributor = await Distributor.findById(req.user.id);
    if (!distributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    const totalRetailers = distributor.retailers.length;

    const mainWallet = await MainWallet.findOne({ userId: req.user.id, userModel: 'Distributor' });
    const aepsWallet = await AepsWallet.findOne({ userId: req.user.id, userModel: 'Distributor' });

    const totalCommissions = (mainWallet?.balance || 0) + (aepsWallet?.balance || 0);

    const stats = {
      totalRetailers,
      totalCommissions,
      activeUsers: totalRetailers,
      totalTransactions: 0, // Placeholder
    };

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get list of all retailers for this distributor
export const getRetailers = async (req, res) => {
  try {
    if (req.user.role !== 'distributor') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    // Fetch retailers belonging to this distributor
    const retailers = await Retailer.find({ distributorId: req.user.id })
      .select('-password')
      .sort({ createdAt: -1 });

    const ids = retailers.map((ret) => ret._id);
    const [mainWallets, aepsWallets, lifetime] = await Promise.all([
      MainWallet.find({ userId: { $in: ids }, userModel: 'Retailer' }).select('userId balance').lean(),
      AepsWallet.find({ userId: { $in: ids }, userModel: 'Retailer' }).select('userId balance').lean(),
      lifetimeFor(ids),
    ]);
    const balance = (wallets) => new Map(wallets.map((w) => [String(w.userId), w.balance || 0]));
    const main = balance(mainWallets);
    const aeps = balance(aepsWallets);

    const retailersWithStats = retailers.map((ret) => {
      const key = String(ret._id);
      return {
        ...ret.toObject(),
        mainWalletBalance: main.get(key) || 0,
        aepsWalletBalance: aeps.get(key) || 0,
        // What the distributor has earned from this retailer. It used to be the
        // retailer's own wallet balance, which is not the distributor's money.
        commissionsEarned: Math.round((lifetime.get(key)?.earned || 0) * 100) / 100,
        lastActiveAt: lifetime.get(key)?.lastActiveAt || null,
      };
    });

    return res.status(200).json({ success: true, data: retailersWithStats });
  } catch (error) {
    console.error('Error fetching retailers:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update a retailer's details (only retailers belonging to this distributor)
export const updateRetailer = async (req, res) => {
  try {
    if (req.user.role !== 'distributor')
      return res.status(403).json({ success: false, message: 'Unauthorized access' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Retailer ID is required' });

    const retailer = await Retailer.findOne({ _id: id, distributorId: req.user.id });
    if (!retailer)
      return res.status(404).json({ success: false, message: 'Retailer not found' });

    const {
      prefix,
      firstName,
      lastName,
      dob,
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
      isActive,
      disabledServices,
    } = req.body;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (firstName || lastName)
      updateData.name = `${updateData.firstName || retailer.firstName} ${
        updateData.lastName || retailer.lastName
      }`.trim();
    if (prefix) updateData.prefix = prefix;
    if (dob) updateData.dob = dob;
    if (email) updateData.email = email;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (password) updateData.password = password;
    if (businessName) updateData.businessName = businessName;
    if (businessAddress) updateData.businessAddress = businessAddress;
    if (address)
      updateData.address = typeof address === 'string' ? JSON.parse(address) : address;
    if (aadhaarNumber) updateData.aadhaarNumber = aadhaarNumber;
    if (panNumber) updateData.panNumber = panNumber;
    if (hasGst !== undefined) updateData.hasGst = hasGst === 'true' || hasGst === true;
    if (gstNumber) updateData.gstNumber = gstNumber;

    const packages = {
      dmtPackage,
      rechargePackage,
      aepsPackage,
      bbpsPackage,
      payoutPackage,
      cmsPackage,
      ccpayPackage,
      payinPackage,
      upiPackage,
    };
    Object.entries(packages).forEach(([key, value]) => {
      if (value !== undefined && value !== null) updateData[key] = value;
    });

    if (disabledServices !== undefined) {
      const parsed = parseDisabledServices(disabledServices);
      if (!parsed) return res.status(400).json({ success: false, message: 'Invalid services list' });
      updateData.disabledServices = parsed;
    }

    if (website) updateData.website = website;
    if (brandName) updateData.brandName = brandName;
    if (companyRegisterName) updateData.companyRegisterName = companyRegisterName;
    if (supportEmail) updateData.supportEmail = supportEmail;
    if (supportMobile) updateData.supportMobile = supportMobile;
    if (isExistingMerchant !== undefined)
      updateData.isExistingMerchant = isExistingMerchant === 'true' || isExistingMerchant === true;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

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

    Object.assign(retailer, updateData);
    await retailer.save();
    logActivity({
      req,
      action: 'retailer.update',
      target: { _id: retailer._id, role: 'retailer', name: retailer.name },
      summary: `Updated ${retailer.name}'s details`,
      // Field names only: values can be passwords or KYC numbers.
      meta: { fields: Object.keys(updateData) },
    });

    const retailerObj = retailer.toObject();
    delete retailerObj.password;

    return res.status(200).json({
      success: true,
      message: 'Retailer updated successfully',
      data: retailerObj,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email, contact number or KYC document is already in use by another retailer.',
      });
    }
    console.error('Error updating retailer:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/distributor/retailers/:id/services  { disabledServices: string[] }
 * Switches services on or off for one of this distributor's retailers. Takes
 * effect on the retailer's next request; their menus refresh within 15 minutes.
 */
export const updateRetailerServices = async (req, res) => {
  try {
    if (req.user.role !== 'distributor')
      return res.status(403).json({ success: false, message: 'Unauthorized access' });

    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid retailer id' });

    const disabledServices = parseDisabledServices(req.body?.disabledServices);
    if (!disabledServices)
      return res.status(400).json({ success: false, message: 'Invalid services list' });

    const retailer = await Retailer.findOneAndUpdate(
      { _id: req.params.id, distributorId: req.user.id },
      { $set: { disabledServices } },
      { new: true }
    ).select('_id name disabledServices');
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });
    logActivity({
      req,
      action: 'retailer.services',
      target: { _id: retailer._id, role: 'retailer', name: retailer.name },
      summary: disabledServices.length ? `Switched off: ${disabledServices.join(', ')}` : 'All services switched on',
      meta: { disabledServices },
    });

    return res.status(200).json({ success: true, message: 'Services updated', data: retailer });
  } catch (error) {
    console.error('Error updating retailer services:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    if (req.user.role !== 'distributor')
      return res.status(403).json({ success: false, message: 'Unauthorized access' });

    const distributor = await Distributor.findById(req.user.id).select('-password');
    if (!distributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    return res.status(200).json({ success: true, data: distributor });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (req.user.role !== 'distributor')
      return res.status(403).json({ success: false, message: 'Unauthorized access' });

    const {
      name,
      contactNumber,
      businessName,
      businessAddress,
      address,
      aadhaarNumber,
      panNumber,
      hasGst,
      gstNumber,
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (businessName) updateData.businessName = businessName;
    if (businessAddress) updateData.businessAddress = businessAddress;
    if (address) {
      updateData.address = typeof address === 'string' ? JSON.parse(address) : address;
    }

    const existingDistributor = await Distributor.findById(req.user.id);
    if (!existingDistributor)
      return res.status(404).json({ success: false, message: 'Distributor not found' });

    // Legal fields (Only update if empty)
    if (aadhaarNumber && !existingDistributor.aadhaarNumber)
      updateData.aadhaarNumber = aadhaarNumber;
    if (panNumber && !existingDistributor.panNumber) updateData.panNumber = panNumber;
    if (hasGst !== undefined) updateData.hasGst = hasGst === 'true' || hasGst === true;
    if (gstNumber) updateData.gstNumber = gstNumber;

    // Image uploads (Only update if empty)
    const profilePictureLocalPath = req.files?.profilePicture?.[0]?.path;
    const aadhaarPictureLocalPath = req.files?.aadhaarPicture?.[0]?.path;
    const panPictureLocalPath = req.files?.panPicture?.[0]?.path;

    if (profilePictureLocalPath) {
      const profilePic = await uploadOnR2(profilePictureLocalPath);
      if (profilePic?.url) updateData.profilePicture = profilePic.url;
    }

    if (aadhaarPictureLocalPath && !existingDistributor.aadhaarPicture) {
      const aadhaarPic = await uploadOnR2(aadhaarPictureLocalPath);
      if (aadhaarPic?.url) updateData.aadhaarPicture = aadhaarPic.url;
    }

    if (panPictureLocalPath && !existingDistributor.panPicture) {
      const panPic = await uploadOnR2(panPictureLocalPath);
      if (panPic?.url) updateData.panPicture = panPic.url;
    }

    const updatedDistributor = await Distributor.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    return res
      .status(200)
      .json({ success: true, message: 'Profile updated successfully', data: updatedDistributor });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
