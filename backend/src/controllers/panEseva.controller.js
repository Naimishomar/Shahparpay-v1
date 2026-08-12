import axios from 'axios';
import Retailer from '../models/users/retailer.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Transaction from '../models/transaction.model.js';

// ==========================================
// eSevaTech PAN Service / PAN Coupon APIs
// Docs: apply_pan_service.php, apply_pan_coupon.php, service-status.php, coupon-status.php
// ==========================================

const ESEVA_BASE_URL = () => process.env.ESEVATECH_BASE_URL || 'https://esevatech.in/api/core/main';

// Fixed per-application PAN service charge. Used as a hard floor for the wallet
// balance check and as a fallback amount when the provider omits final_amount.
const PAN_APPLICATION_FEE = 107;

const getEsevaCredentials = () => {
  const partner_unique_id = process.env.ESEVATECH_PARTNER_UNIQUE_ID;
  const secret_key = process.env.ESEVATECH_SECRET_KEY;

  if (!partner_unique_id || !secret_key) {
    return {
      error:
        'eSevaTech configuration is missing on the server. Please check environment variables.',
    };
  }
  return { partner_unique_id, secret_key };
};

const getRetailerWithWallet = async (userId) => {
  const retailer = await Retailer.findById(userId);
  if (!retailer) {
    return { error: 'Retailer not found' };
  }

  const mainWallet = await MainWallet.findOne({ userId: retailer._id });
  const balance = mainWallet ? mainWallet.balance : 0;

  return { retailer, balance };
};

// Map eSevaTech status strings to our Transaction status enum
const mapEsevaStatus = (status) => {
  if (!status) return 'PENDING';
  const s = String(status).toUpperCase();
  if (s.includes('COMPLET') || s.includes('SUCCESS')) return 'SUCCESS';
  if (s.includes('APPROV')) return 'APPROVED';
  if (s.includes('REJECT')) return 'REJECTED';
  if (s.includes('PROCESS')) return 'PROCESSING';
  if (s.includes('SUBMIT')) return 'PENDING';
  return 'PENDING';
};

// Atomically debit fee and credit commission on the retailer MainWallet.
// Creates a single Transaction record with the fee as `amount` and the
// net commission stored under commissions.retailerEarned.
const applyWalletImpact = async ({
  retailer,
  finalAmount,
  netCommission,
  transactionId,
  type,
  status,
  metadata,
}) => {
  const fee = Number(finalAmount) || 0;
  const commission = Number(netCommission) || 0;

  // Single atomic update: check balance >= fee, then apply fee debit + commission credit
  const updatedWallet = await MainWallet.findOneAndUpdate(
    { userId: retailer._id, balance: { $gte: fee } },
    { $inc: { balance: -fee + commission } },
    { returnDocument: 'after' }
  );

  if (!updatedWallet) {
    return { error: 'Insufficient wallet balance' };
  }

  const transaction = await Transaction.create({
    transactionId,
    userId: retailer._id,
    type,
    amount: fee,
    commissions: {
      retailerEarned: commission,
      chargeDeducted: fee,
    },
    status,
    metadata,
  });

  return { transaction, newBalance: updatedWallet.balance };
};

/**
 * 1. Submit PAN Service application via eSevaTech
 * @route POST /api/pan/eseva/apply-service
 */
export const applyPanService = async (req, res) => {
  try {
    const { pan_number, shop_name, shop_address, state_name, district_name, pincode } = req.body;

    if (!pan_number || !shop_name || !shop_address || !state_name || !district_name || !pincode) {
      return res.status(400).json({ success: false, message: 'All fields are mandatory' });
    }
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(String(pan_number))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PAN number. Must be 10 characters (e.g. ABCDE1234F)',
      });
    }
    if (!/^\d{6}$/.test(String(pincode))) {
      return res.status(400).json({ success: false, message: 'Pincode must be 6 digits' });
    }

    const creds = getEsevaCredentials();
    if (creds.error) {
      return res.status(500).json({ success: false, message: creds.error });
    }

    const { retailer, balance } = await getRetailerWithWallet(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    if (balance < PAN_APPLICATION_FEE) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Required at least ₹${PAN_APPLICATION_FEE}.`,
        required_amount: PAN_APPLICATION_FEE,
        current_balance: balance,
      });
    }

    const data = {
      partner_unique_id: creds.partner_unique_id,
      secret_key: creds.secret_key,
      agent_unique_id: retailer.retailerId,
      pan_number: String(pan_number).toUpperCase(),
      shop_name,
      shop_address,
      state_name,
      district_name,
      pincode,
    };

    console.log(
      `[eSeva PAN Service] Submitting application for Agent: ${retailer.retailerId}, PAN: ${data.pan_number}`
    );

    const response = await axios.post(`${ESEVA_BASE_URL()}/apply_pan_service.php`, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });

    const result = response.data;
    console.log('[eSeva PAN Service] Response:', response.status, result);

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to submit PAN Service application',
      });
    }

    const finalAmount =
      Number(result.final_amount) > 0 ? Number(result.final_amount) : PAN_APPLICATION_FEE;
    const netCommission = Number(result.net_commission);
    const applicationNumber = result.application_number;

    const impact = await applyWalletImpact({
      retailer,
      finalAmount,
      netCommission,
      transactionId: `PAN-SERVICE-${applicationNumber}`,
      type: 'PAN_SERVICE',
      status: 'SUCCESS',
      metadata: {
        apiProvider: 'eSevaTech',
        application_number: applicationNumber,
        agent_unique_id: result.agent_unique_id,
        pan_number: result.pan_number || data.pan_number,
        shop_name,
        shop_address,
        state_name,
        district_name,
        pincode,
        admin_fee: result.admin_fee,
        gst_amount: result.gst_amount,
        final_amount: finalAmount,
        commission_amount: result.commission_amount,
        tds_amount: result.tds_amount,
        net_commission: netCommission,
        eseva_status: result.status,
        message: result.message,
        new_wallet_balance: result.new_wallet_balance,
      },
    });

    if (impact.error) {
      // Application was created at eSevaTech but local wallet debit failed
      return res.status(200).json({
        success: true,
        warning: impact.error,
        application_number: applicationNumber,
        final_amount: finalAmount,
        net_commission: netCommission,
        message:
          'Application submitted at eSevaTech, but wallet debit failed locally. Please top up your wallet and contact support.',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message || 'PAN Service application submitted successfully.',
      application_number: applicationNumber,
      admin_fee: result.admin_fee,
      gst_amount: result.gst_amount,
      final_amount: finalAmount,
      commission_amount: result.commission_amount,
      tds_amount: result.tds_amount,
      net_commission: netCommission,
      new_wallet_balance: impact.newBalance,
      status: result.status,
      transactionId: impact.transaction.transactionId,
    });
  } catch (error) {
    console.error('Error applying PAN Service:', error);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Internal server error',
    });
  }
};

/**
 * 2. Submit PAN Coupon request via eSevaTech
 * @route POST /api/pan/eseva/apply-coupon
 */
export const applyPanCoupon = async (req, res) => {
  try {
    const { psa_id, number_of_coupons, pan_agency_name } = req.body;

    if (!psa_id || !number_of_coupons) {
      return res
        .status(400)
        .json({ success: false, message: 'psa_id and number_of_coupons are mandatory' });
    }
    if (Number(number_of_coupons) < 1) {
      return res.status(400).json({ success: false, message: 'Minimum 1 coupon is required' });
    }

    const creds = getEsevaCredentials();
    if (creds.error) {
      return res.status(500).json({ success: false, message: creds.error });
    }

    const { retailer, balance } = await getRetailerWithWallet(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    if (balance < PAN_APPLICATION_FEE * Number(number_of_coupons)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Required at least ₹${PAN_APPLICATION_FEE * Number(number_of_coupons)}.`,
        required_amount: PAN_APPLICATION_FEE * Number(number_of_coupons),
        current_balance: balance,
      });
    }

    const data = {
      partner_unique_id: creds.partner_unique_id,
      agent_unique_id: retailer.retailerId,
      secret_key: creds.secret_key,
      psa_id,
      pan_agency_name: pan_agency_name || 'UTIITSL',
      number_of_coupons: Number(number_of_coupons),
    };

    console.log(
      `[eSeva PAN Coupon] Submitting coupon request for Agent: ${retailer.retailerId}, PSA: ${psa_id}, Qty: ${data.number_of_coupons}`
    );

    const response = await axios.post(`${ESEVA_BASE_URL()}/apply_pan_coupon.php`, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });

    const result = response.data;
    console.log('[eSeva PAN Coupon] Response:', response.status, result);

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to submit PAN Coupon request',
      });
    }

    const finalAmount =
      Number(result.final_amount) > 0
        ? Number(result.final_amount)
        : PAN_APPLICATION_FEE * Number(number_of_coupons);
    const netCommission = Number(result.net_commission);
    const applicationNumber = result.application_number;

    const impact = await applyWalletImpact({
      retailer,
      finalAmount,
      netCommission,
      transactionId: `PAN-COUPON-${applicationNumber}`,
      type: 'PAN_COUPON',
      status: 'SUCCESS',
      metadata: {
        apiProvider: 'eSevaTech',
        application_number: applicationNumber,
        agent_unique_id: result.agent_unique_id,
        psa_id,
        pan_agency_name: result.pan_agency_name || data.pan_agency_name,
        number_of_coupons: result.number_of_coupons || data.number_of_coupons,
        admin_fee: result.admin_fee,
        gst_amount: result.gst_amount,
        final_amount: finalAmount,
        commission_amount: result.commission_amount,
        tds_amount: result.tds_amount,
        net_commission: netCommission,
        eseva_status: result.status,
        message: result.message,
        new_wallet_balance: result.new_wallet_balance,
      },
    });

    if (impact.error) {
      return res.status(200).json({
        success: true,
        warning: impact.error,
        application_number: applicationNumber,
        final_amount: finalAmount,
        net_commission: netCommission,
        message:
          'Coupon request submitted at eSevaTech, but wallet debit failed locally. Please top up your wallet and contact support.',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message || 'PAN Coupon request submitted successfully.',
      application_number: applicationNumber,
      number_of_coupons: result.number_of_coupons || data.number_of_coupons,
      psa_id,
      admin_fee: result.admin_fee,
      gst_amount: result.gst_amount,
      final_amount: finalAmount,
      commission_amount: result.commission_amount,
      tds_amount: result.tds_amount,
      net_commission: netCommission,
      new_wallet_balance: impact.newBalance,
      status: result.status,
      transactionId: impact.transaction.transactionId,
    });
  } catch (error) {
    console.error('Error applying PAN Coupon:', error);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Internal server error',
    });
  }
};

/**
 * 3. Check PAN Service application status via eSevaTech
 * @route POST /api/pan/eseva/service-status
 */
export const getPanServiceStatus = async (req, res) => {
  try {
    const { application_number } = req.body;

    if (!application_number) {
      return res.status(400).json({ success: false, message: 'application_number is required' });
    }

    const creds = getEsevaCredentials();
    if (creds.error) {
      return res.status(500).json({ success: false, message: creds.error });
    }

    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const data = {
      partner_unique_id: creds.partner_unique_id,
      secret_key: creds.secret_key,
      agent_unique_id: retailer.retailerId,
      application_number: Number(application_number),
    };

    const response = await axios.post(`${ESEVA_BASE_URL()}/service-status.php`, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });

    const result = response.data;
    console.log('[eSeva PAN Service Status] Response:', response.status, result);

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to fetch PAN Service status',
      });
    }

    // Sync status into the stored transaction if it exists
    const transaction = await Transaction.findOne({
      userId: retailer._id,
      type: 'PAN_SERVICE',
      'metadata.application_number': Number(application_number),
    });

    if (transaction) {
      transaction.status = mapEsevaStatus(result.status) || transaction.status;
      transaction.metadata = {
        ...transaction.metadata,
        eseva_status: result.status,
        public_remarks: result.public_remarks,
        psa_id: result.psa_id || transaction.metadata?.psa_id || null,
        last_status_check: new Date().toISOString(),
      };
      transaction.markModified('metadata');
      await transaction.save();
    }

    return res.status(200).json({
      success: true,
      service_type: result.service_type,
      application_number: result.application_number,
      status: result.status,
      public_remarks: result.public_remarks,
      psa_id: result.psa_id || null,
      pan_number: result.pan_number,
      shop_name: result.shop_name,
      final_amount: result.final_amount,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  } catch (error) {
    console.error('Error checking PAN Service status:', error);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Internal server error',
    });
  }
};

/**
 * 4. Check PAN Coupon application status via eSevaTech
 * @route POST /api/pan/eseva/coupon-status
 */
export const getPanCouponStatus = async (req, res) => {
  try {
    const { application_number } = req.body;

    if (!application_number) {
      return res.status(400).json({ success: false, message: 'application_number is required' });
    }

    const creds = getEsevaCredentials();
    if (creds.error) {
      return res.status(500).json({ success: false, message: creds.error });
    }

    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const data = {
      partner_unique_id: creds.partner_unique_id,
      secret_key: creds.secret_key,
      agent_unique_id: retailer.retailerId,
      application_number: Number(application_number),
    };

    const response = await axios.post(`${ESEVA_BASE_URL()}/coupon-status.php`, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });

    const result = response.data;
    console.log('[eSeva PAN Coupon Status] Response:', response.status, result);

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to fetch PAN Coupon status',
      });
    }

    const transaction = await Transaction.findOne({
      userId: retailer._id,
      type: 'PAN_COUPON',
      'metadata.application_number': Number(application_number),
    });

    if (transaction) {
      transaction.status = mapEsevaStatus(result.status) || transaction.status;
      transaction.metadata = {
        ...transaction.metadata,
        eseva_status: result.status,
        public_remarks: result.public_remarks,
        psa_id: result.psa_id || transaction.metadata?.psa_id || null,
        last_status_check: new Date().toISOString(),
      };
      transaction.markModified('metadata');
      await transaction.save();
    }

    return res.status(200).json({
      success: true,
      service_type: result.service_type,
      application_number: result.application_number,
      status: result.status,
      public_remarks: result.public_remarks,
      psa_id: result.psa_id || null,
      pan_agency_name: result.pan_agency_name,
      number_of_coupons: result.number_of_coupons,
      final_amount: result.final_amount,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  } catch (error) {
    console.error('Error checking PAN Coupon status:', error);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Internal server error',
    });
  }
};

/**
 * 5. Get retailer's eSevaTech PAN history (PAN_SERVICE + PAN_COUPON)
 * @route GET /api/pan/eseva/history
 */
export const getEsevaPanHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user.id,
      type: { $in: ['PAN_SERVICE', 'PAN_COUPON'] },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching eSeva PAN history:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * 6. Get the retailer's latest eSevaTech PSA ID (autofills the coupon form).
 * PSA ID is pulled from the most recent approved PAN_SERVICE whose metadata
 * has a psa_id synced back from the eSevaTech status check.
 * @route GET /api/pan/eseva/my-psa
 */
export const getMyEsevaPsaId = async (req, res) => {
  try {
    const txn = await Transaction.findOne({
      userId: req.user.id,
      type: 'PAN_SERVICE',
      'metadata.psa_id': { $exists: true, $ne: null, $ne: '' },
    }).sort({ createdAt: -1 });

    const psa_id = txn?.metadata?.psa_id || null;

    return res.status(200).json({
      success: true,
      psa_id,
      status: txn?.status || null,
      application_number: txn?.metadata?.application_number || null,
    });
  } catch (error) {
    console.error('Error fetching eSeva PSA ID:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
