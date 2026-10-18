import FundRequest from '../models/fundRequest.model.js';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import { uploadOnR2 } from '../utils/r2.js';
import { updateWalletAtomically } from '../utils/wallet.util.js';
import { logActivity } from '../utils/activity.js';

// ======================= RETAILER -> DISTRIBUTOR =======================

export const createFundRequest = async (req, res) => {
  try {
    const { transactionMode, amount, bankUtr, depositDate, remarks } = req.body;

    if (!transactionMode || !amount || !bankUtr || !depositDate) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const existingReq = await FundRequest.findOne({ bankUtr });
    if (existingReq) {
      return res
        .status(400)
        .json({ success: false, message: 'A fund request with this UTR already exists' });
    }

    const retailer = await Retailer.findById(req.user.id);
    if (!retailer || !retailer.distributorId) {
      return res
        .status(400)
        .json({ success: false, message: 'Retailer or associated Distributor not found' });
    }

    let depositSlipUrl = null;
    if (req.files && req.files.depositSlip) {
      const uploadedFile = await uploadOnR2(req.files.depositSlip[0].path);
      if (uploadedFile && uploadedFile.url) {
        depositSlipUrl = uploadedFile.url;
      }
    }

    const fundRequest = await FundRequest.create({
      requestType: 'RETAILER',
      retailerId: req.user.id,
      distributorId: retailer.distributorId,
      transactionMode,
      amount: Number(amount),
      bankUtr,
      depositDate: new Date(depositDate),
      depositSlipUrl,
      remarks,
    });
    logActivity({ req, action: 'fund_request.create', summary: `Requested ₹${Number(fundRequest.amount).toLocaleString('en-IN')} from distributor (${transactionMode})`, meta: { fundRequestId: fundRequest._id, amount: fundRequest.amount } });

    return res
      .status(201)
      .json({ success: true, message: 'Fund request created successfully', data: fundRequest });
  } catch (error) {
    console.error('Create Fund Request Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRetailerFundRequests = async (req, res) => {
  try {
    const requests = await FundRequest.find({
      retailerId: req.user.id,
      requestType: 'RETAILER',
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Get Retailer Fund Requests Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDistributorFundRequests = async (req, res) => {
  try {
    const requests = await FundRequest.find({ distributorId: req.user.id, requestType: 'RETAILER' })
      .populate('retailerId', 'firstName lastName businessName retailerId contactNumber')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Get Distributor Fund Requests Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Moves a fund request out of PENDING in one atomic step, so two approvals
 * racing each other (double click, retry) cannot both credit the wallet.
 * Returns the claimed request, or a ready error response.
 */
const claimPendingRequest = async (filter, status, res) => {
  const claimed = await FundRequest.findOneAndUpdate(
    { ...filter, status: 'PENDING' },
    { $set: { status } },
    { new: true }
  );
  if (claimed) return claimed;
  const existing = await FundRequest.findOne(filter);
  res
    .status(existing ? 400 : 404)
    .json({ success: false, message: existing ? `Fund request is already ${existing.status}` : 'Fund request not found' });
  return null;
};

const releaseClaim = (id) => FundRequest.updateOne({ _id: id }, { $set: { status: 'PENDING' } });

export const updateFundRequestStatus = async (req, res) => {
  try {
    const { requestId, status, adminRemarks } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const fundRequest = await claimPendingRequest(
      { _id: String(requestId), distributorId: req.user.id, requestType: 'RETAILER' },
      status,
      res
    );
    if (!fundRequest) return;

    if (status === 'APPROVED') {
      // Keyed on the request, so even a second claim could not write a second credit.
      const transactionId = `FR${fundRequest._id}`;
      let deducted = false;
      try {

        // 1. Deduct from Distributor
        await updateWalletAtomically(fundRequest.distributorId, 'MAIN', -fundRequest.amount, {
          transactionId: `${transactionId}_DED`,
          userId: fundRequest.distributorId,
          type: 'FUND_TRANSFER',
          amount: fundRequest.amount,
          status: 'SUCCESS',
          metadata: {
            fundRequestId: fundRequest._id,
            bankUtr: fundRequest.bankUtr,
            note: 'Fund Request Approval Deduction for Retailer',
          },
        });
        deducted = true;

        // 2. Credit to Retailer
        await updateWalletAtomically(fundRequest.retailerId, 'MAIN', fundRequest.amount, {
          transactionId: `${transactionId}_CRED`,
          userId: fundRequest.retailerId,
          type: 'FUND_REQUEST',
          amount: fundRequest.amount,
          status: 'SUCCESS',
          metadata: {
            fundRequestId: fundRequest._id,
            bankUtr: fundRequest.bankUtr,
            note: 'Fund Request Approved by Distributor',
          },
        });
      } catch (err) {
        // Credit failed after the deduction: give the distributor their money back.
        if (deducted) {
          await updateWalletAtomically(fundRequest.distributorId, 'MAIN', fundRequest.amount, {
            transactionId: `${transactionId}_REV`,
            userId: fundRequest.distributorId,
            type: 'FUND_TRANSFER',
            amount: fundRequest.amount,
            status: 'SUCCESS',
            metadata: { fundRequestId: fundRequest._id, note: 'Reversal: retailer credit failed' },
          }).catch((e) => console.error('[FundRequest] reversal failed', fundRequest._id, e));
        }
        await releaseClaim(fundRequest._id);
        return res.status(400).json({
          success: false,
          message: err.message || 'Failed to process funds (insufficient balance?)',
        });
      }
    }

    fundRequest.status = status;
    if (adminRemarks) fundRequest.adminRemarks = adminRemarks;
    await fundRequest.save();
    logActivity({
      req,
      action: `fund_request.${status.toLowerCase()}`,
      target: { _id: fundRequest.retailerId || fundRequest.distributorId, role: fundRequest.requestType === 'RETAILER' ? 'retailer' : 'distributor' },
      summary: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} a ₹${Number(fundRequest.amount).toLocaleString('en-IN')} fund request`,
      meta: { fundRequestId: fundRequest._id, amount: fundRequest.amount, remarks: adminRemarks },
    });

    return res
      .status(200)
      .json({ success: true, message: `Fund request ${status.toLowerCase()}`, data: fundRequest });
  } catch (error) {
    console.error('Update Fund Request Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ======================= DISTRIBUTOR -> ADMIN =======================

export const createDistributorFundRequest = async (req, res) => {
  try {
    const { transactionMode, amount, bankUtr, depositDate, remarks } = req.body;

    if (!transactionMode || !amount || !bankUtr || !depositDate) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const existingReq = await FundRequest.findOne({ bankUtr });
    if (existingReq) {
      return res
        .status(400)
        .json({ success: false, message: 'A fund request with this UTR already exists' });
    }

    const distributor = await Distributor.findById(req.user.id);
    if (!distributor || !distributor.adminId) {
      return res
        .status(400)
        .json({ success: false, message: 'Distributor or associated Admin not found' });
    }

    let depositSlipUrl = null;
    if (req.files && req.files.depositSlip) {
      const uploadedFile = await uploadOnR2(req.files.depositSlip[0].path);
      if (uploadedFile && uploadedFile.url) {
        depositSlipUrl = uploadedFile.url;
      }
    }

    const fundRequest = await FundRequest.create({
      requestType: 'DISTRIBUTOR',
      distributorId: req.user.id,
      adminId: distributor.adminId,
      transactionMode,
      amount: Number(amount),
      bankUtr,
      depositDate: new Date(depositDate),
      depositSlipUrl,
      remarks,
    });
    logActivity({ req, action: 'fund_request.create', summary: `Requested ₹${Number(fundRequest.amount).toLocaleString('en-IN')} from admin (${transactionMode})`, meta: { fundRequestId: fundRequest._id, amount: fundRequest.amount } });

    return res.status(201).json({
      success: true,
      message: 'Fund request to Admin created successfully',
      data: fundRequest,
    });
  } catch (error) {
    console.error('Create Dist Fund Request Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDistributorOwnFundRequests = async (req, res) => {
  try {
    const requests = await FundRequest.find({
      distributorId: req.user.id,
      requestType: 'DISTRIBUTOR',
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Get Dist Own Fund Requests Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAdminFundRequests = async (req, res) => {
  try {
    const requests = await FundRequest.find({ adminId: req.user.id, requestType: 'DISTRIBUTOR' })
      .populate('distributorId', 'firstName lastName businessName distributorId contactNumber')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Get Admin Fund Requests Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateAdminFundRequestStatus = async (req, res) => {
  try {
    const { requestId, status, adminRemarks } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const fundRequest = await claimPendingRequest(
      { _id: String(requestId), adminId: req.user.id, requestType: 'DISTRIBUTOR' },
      status,
      res
    );
    if (!fundRequest) return;

    if (status === 'APPROVED') {
      try {
        const transactionId = `FR_ADM_${fundRequest._id}`;

        // Credit Distributor directly (Admin does not deduct from a strict wallet in this simplified flow)
        await updateWalletAtomically(fundRequest.distributorId, 'MAIN', fundRequest.amount, {
          transactionId,
          userId: fundRequest.distributorId,
          type: 'FUND_REQUEST',
          amount: fundRequest.amount,
          status: 'SUCCESS',
          metadata: {
            fundRequestId: fundRequest._id,
            bankUtr: fundRequest.bankUtr,
            note: 'Fund Request Approved by Admin',
          },
        });
      } catch (err) {
        await releaseClaim(fundRequest._id);
        return res
          .status(400)
          .json({ success: false, message: err.message || 'Failed to process funds' });
      }
    }

    fundRequest.status = status;
    if (adminRemarks) fundRequest.adminRemarks = adminRemarks;
    await fundRequest.save();
    logActivity({
      req,
      action: `fund_request.${status.toLowerCase()}`,
      target: { _id: fundRequest.retailerId || fundRequest.distributorId, role: fundRequest.requestType === 'RETAILER' ? 'retailer' : 'distributor' },
      summary: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} a ₹${Number(fundRequest.amount).toLocaleString('en-IN')} fund request`,
      meta: { fundRequestId: fundRequest._id, amount: fundRequest.amount, remarks: adminRemarks },
    });

    return res
      .status(200)
      .json({ success: true, message: `Fund request ${status.toLowerCase()}`, data: fundRequest });
  } catch (error) {
    console.error('Update Admin Fund Request Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteFundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const fundRequest = await FundRequest.findOne({
      _id: id,
      $or: [{ retailerId: userId }, { distributorId: userId }],
    });

    if (!fundRequest) {
      return res
        .status(404)
        .json({ success: false, message: 'Fund request not found or unauthorized to delete' });
    }

    if (fundRequest.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete request as it has already been processed',
      });
    }

    await FundRequest.deleteOne({ _id: id });
    return res.status(200).json({ success: true, message: 'Fund request deleted successfully' });
  } catch (error) {
    console.error('deleteFundRequest error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
