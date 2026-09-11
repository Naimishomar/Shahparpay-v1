import { icchhamatiPost, isOk, normaliseStatus, providerMessage, makeReferenceId } from '../utils/icchhamati.util.js';
import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';

const getRetailer = async (req) => Retailer.findById(req.user.id).select('retailerId contactNumber');

const providerTransactionId = (data, fallback) =>
  String(data?.data?.merchantTransactionId || data?.data?.fpTransactionId || data?.data?.bankRRN || fallback);

/** Initialize Icchhamati's MATM terminal configuration for this retailer. */
export const getMatmConfig = async (req, res) => {
  try {
    const retailer = await getRetailer(req);
    if (!retailer?.retailerId) {
      return res.status(404).json({ success: false, message: 'Retailer outlet ID is not configured' });
    }

    const data = await icchhamatiPost('/api/v2/matm-config', {
      outletId: String(retailer.retailerId),
      type: 'doTransaction',
    });

    if (!isOk(data)) {
      return res.status(400).json({
        success: false,
        message: providerMessage(data, 'Could not initialize MATM configuration.'),
        data,
      });
    }

    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'MATM configuration loaded.'),
      data: data.data || data,
    });
  } catch (error) {
    console.error('MATM Config Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to initialize MATM' });
  }
};

/** Submit a terminal MATM transaction and record its provider result. */
export const processMatm = async (req, res) => {
  try {
    const retailer = await getRetailer(req);
    if (!retailer?.retailerId) {
      return res.status(404).json({ success: false, message: 'Retailer outlet ID is not configured' });
    }

    const mobile = String(req.body?.mobile || retailer.contactNumber || '').replace(/\D/g, '');
    const inputData = req.body?.data;
    if (!inputData || typeof inputData !== 'object' || Array.isArray(inputData)) {
      return res.status(400).json({ success: false, message: 'MATM transaction data is required' });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }

    const amount = Number(inputData.transactionAmount);
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: 'A valid transaction amount is required' });
    }

    const merchantTransactionId = String(
      inputData.merchantTransactionId || makeReferenceId('MATM')
    );
    const transactionData = {
      ...inputData,
      transactionAmount: amount,
      merchantTransactionId,
      requestTransactionTime: inputData.requestTransactionTime || new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      }).replace(',', ''),
    };

    const existing = await Transaction.findOne({
      transactionId: merchantTransactionId,
      userId: req.user.id,
      type: 'MATM',
    });
    if (existing) {
      return res.status(200).json({
        success: existing.status === 'SUCCESS',
        message: 'This MATM transaction was already submitted.',
        data: { transactionId: existing.transactionId, status: existing.status },
      });
    }

    await Transaction.create({
      transactionId: merchantTransactionId,
      userId: req.user.id,
      type: 'MATM',
      amount,
      status: 'PENDING',
      metadata: {
        outletId: String(retailer.retailerId),
        mobile,
        terminalId: transactionData.terminalId || null,
        transactionType: transactionData.transactionType || 'WDLS',
        provider: 'ICCHHAMATI',
      },
    });

    let data;
    try {
      data = await icchhamatiPost('/api/v2/matm-request', {
        outletId: String(retailer.retailerId),
        mobile,
        data: transactionData,
      });
    } catch (providerError) {
      console.error('MATM Provider Transport Error:', providerError?.response?.data || providerError?.message);
      return res.status(202).json({
        success: true,
        pending: true,
        message: 'MATM request submitted; provider status is pending confirmation.',
        data: { transactionId: merchantTransactionId, status: 'PENDING' },
      });
    }

    const status = isOk(data)
      ? normaliseStatus(data?.data?.transactionStatus || data?.data?.status || data?.status)
      : 'FAILED';
    const finalStatus = status === 'SUCCESS' ? 'SUCCESS' : status === 'PENDING' ? 'PENDING' : 'FAILED';
    await Transaction.findOneAndUpdate(
      { transactionId: merchantTransactionId, userId: req.user.id, type: 'MATM' },
      {
        $set: {
          status: finalStatus,
          'metadata.bankRRN': data?.data?.bankRRN || transactionData.bankRRN || null,
          'metadata.fpTransactionId': data?.data?.fpTransactionId || transactionData.fpTransactionId || null,
          'metadata.apiResponse': data,
        },
      }
    );

    return res.status(finalStatus === 'FAILED' ? 400 : 200).json({
      success: finalStatus === 'SUCCESS',
      pending: finalStatus === 'PENDING',
      message: providerMessage(
        data,
        finalStatus === 'SUCCESS'
          ? 'MATM transaction successful.'
          : finalStatus === 'PENDING'
            ? 'MATM transaction is pending.'
            : 'MATM transaction failed.'
      ),
      data: {
        ...(data?.data || {}),
        transactionId: merchantTransactionId,
        providerTransactionId: providerTransactionId(data, merchantTransactionId),
        status: finalStatus,
      },
    });
  } catch (error) {
    console.error('MATM Process Error:', error?.response?.data || error?.message);
    return res.status(500).json({ success: false, message: 'Failed to process MATM transaction' });
  }
};

export const getMatmHistory = async (req, res) => {
  try {
    const history = await Transaction.find({ userId: req.user.id, type: 'MATM' })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('MATM History Error:', error?.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch MATM history' });
  }
};
