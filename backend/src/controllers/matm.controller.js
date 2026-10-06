import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import {
  getApiCommission,
  getDistributorCommission,
  getMatmCommission,
  setCommissions,
  settleCommissions,
} from '../utils/wallet.util.js';
import {
  generatePaySprintToken,
  paySprintMatmThreeWay,
  paySprintMatmStatusQuery,
} from '../utils/paysprint.util.js';

const makeReferenceId = (prefix = 'MATM') =>
  `${prefix}${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

const getRetailer = async (req) =>
  Retailer.findById(req.user.id).select(
    'retailerId merchantcode contactNumber email name businessName'
  );

/**
 * Initialise PaySprint MATM parameters for mobile SDK / app initiation.
 */
export const getMatmConfig = async (req, res) => {
  try {
    const retailer = await getRetailer(req);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer account not found' });
    }

    const jwtKeyBase64 = process.env.PAYSPRINT_JWT_KEY || '';
    const secret = Buffer.from(jwtKeyBase64, 'base64').toString('utf8');
    const partnerId = secret.substring(0, 8) || process.env.PAYSPRINT_PARTNER_ID || 'PS001';

    const token = generatePaySprintToken();
    const merchantCode = retailer.merchantcode || retailer.retailerId;
    const referenceId = makeReferenceId('MATM');

    return res.status(200).json({
      success: true,
      message: 'PaySprint MATM parameters loaded.',
      data: {
        partnerId,
        partnerApiKey: token,
        token,
        submerchantid: merchantCode,
        merchantCode,
        mobile: retailer.contactNumber || '',
        referenceId,
        txnid: referenceId,
      },
    });
  } catch (error) {
    console.error('MATM Config Error:', error?.message);
    return res.status(500).json({ success: false, message: 'Failed to initialize PaySprint MATM' });
  }
};

/**
 * Settle a withdrawal from PaySprint's own status (status query or callback),
 * never from what the app reports. txnstatus: 1 = success, 3 = failed, 2 = pending.
 * The status flip is atomic so the callback and a status check racing each
 * other credit the wallet once.
 */
export const settleMatmWithdrawal = async (transaction, param) => {
  const txnStatus = Number(param?.txnstatus);
  const extra = {
    'metadata.bankRRN': param?.bankrrn || transaction.metadata?.bankRRN || null,
    'metadata.cardNumber': param?.cardnumber || transaction.metadata?.cardNumber || null,
    'metadata.bankName': param?.bankName || transaction.metadata?.bankName || null,
    'metadata.ackNo': param?.ackno || transaction.metadata?.ackNo || null,
  };

  if (txnStatus === 1) {
    const amount = Number(param.amount || transaction.amount || 0);
    const flipped = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: { $ne: 'SUCCESS' } },
      { $set: { status: 'SUCCESS', amount, ...extra } },
      { new: true }
    );
    if (flipped && amount > 0) {
      await AepsWallet.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { balance: amount } },
        { upsert: true, new: true }
      );
      // Only the request that flipped the status gets here, so this is paid once.
      const split = await settleCommissions({
        retailerId: transaction.userId,
        retailerGross: getMatmCommission(amount),
        distributorGross: getDistributorCommission('MATM', amount),
        pool: getApiCommission('MATM', amount),
        retailerWallet: AepsWallet,
        distributorWallet: AepsWallet,
      });
      setCommissions(flipped, split);
      await flipped.save();
    }
    await paySprintMatmThreeWay({ reference: transaction.transactionId, status: 'success' });
    return 'SUCCESS';
  }

  if (txnStatus === 3) {
    await Transaction.updateOne(
      { _id: transaction._id, status: { $nin: ['SUCCESS', 'FAILED'] } },
      { $set: { status: 'FAILED', ...extra } }
    );
    await paySprintMatmThreeWay({ reference: transaction.transactionId, status: 'failed' });
    return 'FAILED';
  }

  return 'PENDING';
};

const settledResponse = (res, status, transaction, message) => {
  if (status === 'SUCCESS') {
    return res
      .status(200)
      .json({
        success: true,
        status,
        message: message || 'MATM cash withdrawal successful. Wallet credited.',
        data: transaction,
      });
  }
  if (status === 'FAILED') {
    return res
      .status(400)
      .json({
        success: false,
        status,
        message: message || 'MATM cash withdrawal failed.',
        data: transaction,
      });
  }
  return res.status(202).json({
    success: true,
    pending: true,
    status,
    message: 'MATM transaction is pending with the bank. Check status again shortly.',
    data: transaction,
  });
};

/**
 * Record the result the PaySprint MATM SDK handed back to the app.
 * The app's result is only a hint: withdrawals are settled from PaySprint's
 * status query (or the callback), so a forged "success" cannot credit a wallet.
 */
export const processMatm = async (req, res) => {
  try {
    const retailer = await getRetailer(req);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer account not found' });
    }

    const mobile = String(req.body?.mobile || retailer.contactNumber || '').replace(/\D/g, '');
    const inputData = req.body?.data || req.body;
    const referenceId = String(inputData?.txnid || inputData?.referenceId || '').trim();
    if (!referenceId) {
      return res
        .status(400)
        .json({ success: false, message: 'MATM reference (txnid) is required' });
    }

    const transactionType = String(
      inputData.ttype || inputData.transactionType || 'ATMCW'
    ).toUpperCase();
    const sdkStatus = String(inputData.status ?? '').toLowerCase();
    const sdkFailed = ['false', 'failed', 'decline', '3'].includes(sdkStatus);

    let transaction = await Transaction.findOne({ transactionId: referenceId, type: 'MATM' });
    if (transaction && String(transaction.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (!transaction) {
      transaction = await Transaction.create({
        transactionId: referenceId,
        userId: req.user.id,
        type: 'MATM',
        amount: Number(inputData.amount || 0),
        status: 'PENDING',
        metadata: {
          provider: 'PAYSPRINT',
          mobile,
          transactionType,
          sdkMessage: inputData.message || null,
          bankRRN: inputData.bankrrn || inputData.bankRRN || null,
          cardNumber: inputData.cardnumber || inputData.cardNumber || null,
          bankName: inputData.bankName || null,
          cardType: inputData.cardType || null,
        },
      });
    }

    if (transactionType !== 'ATMCW') {
      // Balance enquiry moves no money; the SDK result is enough.
      transaction.status = sdkFailed ? 'FAILED' : 'SUCCESS';
      await transaction.save();
      return res.status(sdkFailed ? 400 : 200).json({
        success: !sdkFailed,
        status: transaction.status,
        message: sdkFailed
          ? inputData.message || 'Balance enquiry failed.'
          : 'Balance enquiry successful.',
        data: {
          ...transaction.toObject(),
          balance: inputData.balAmount || inputData.balance || null,
        },
      });
    }

    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
      return settledResponse(
        res,
        transaction.status,
        transaction,
        `This MATM transaction is already ${transaction.status.toLowerCase()}.`
      );
    }

    const queryRes = await paySprintMatmStatusQuery({ reference: referenceId });
    const status =
      queryRes?.status === true ? await settleMatmWithdrawal(transaction, queryRes) : 'PENDING';
    const fresh = await Transaction.findById(transaction._id);
    return settledResponse(res, status, fresh, status === 'FAILED' ? queryRes?.message : undefined);
  } catch (error) {
    console.error('MATM Process Error:', error?.message);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to process PaySprint MATM transaction' });
  }
};

/**
 * Check status of a pending PaySprint MATM transaction via Status Query API.
 */
export const checkMatmStatus = async (req, res) => {
  try {
    const { transactionId } = req.body || req.query;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'transactionId is required' });
    }

    const transaction = await Transaction.findOne({
      transactionId,
      userId: req.user.id,
      type: 'MATM',
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
      return settledResponse(
        res,
        transaction.status,
        transaction,
        `Transaction is already ${transaction.status.toLowerCase()}.`
      );
    }

    const queryRes = await paySprintMatmStatusQuery({ reference: transactionId });
    if (!queryRes) {
      return res
        .status(500)
        .json({ success: false, message: 'Could not fetch transaction status from PaySprint.' });
    }

    const status =
      queryRes.status === true ? await settleMatmWithdrawal(transaction, queryRes) : 'PENDING';
    const fresh = await Transaction.findById(transaction._id);
    return settledResponse(res, status, fresh, status === 'FAILED' ? queryRes.message : undefined);
  } catch (error) {
    console.error('MATM Status Check Error:', error?.message);
    return res.status(500).json({ success: false, message: 'Failed to check MATM status' });
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
