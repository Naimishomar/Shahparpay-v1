import Transaction from '../models/transaction.model.js';
import Retailer from '../models/users/retailer.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import {
  generatePaySprintToken,
  paySprintMatmThreeWay,
  paySprintMatmStatusQuery,
} from '../utils/paysprint.util.js';

const makeReferenceId = (prefix = 'MATM') =>
  `${prefix}${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

const getRetailer = async (req) =>
  Retailer.findById(req.user.id).select('retailerId merchantcode contactNumber email name businessName');

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
 * Submit or confirm a PaySprint MATM transaction result.
 * Executes mandatory 3-Way Recon with PaySprint and credits retailer AEPS wallet on withdrawal success.
 */
export const processMatm = async (req, res) => {
  try {
    const retailer = await getRetailer(req);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer account not found' });
    }

    const mobile = String(req.body?.mobile || retailer.contactNumber || '').replace(/\D/g, '');
    const inputData = req.body?.data || req.body;
    if (!inputData || typeof inputData !== 'object') {
      return res.status(400).json({ success: false, message: 'MATM transaction data is required' });
    }

    const referenceId = String(
      inputData.txnid || inputData.referenceId || inputData.merchantTransactionId || makeReferenceId('MATM')
    );
    const amount = Number(inputData.amount || inputData.transactionAmount || 0);
    const transactionType = String(inputData.ttype || inputData.transactionType || 'ATMCW').toUpperCase();
    const submittedStatus = String(inputData.status || inputData.transactionStatus || 'success').toLowerCase();

    const existing = await Transaction.findOne({
      transactionId: referenceId,
      userId: req.user.id,
      type: 'MATM',
    });

    if (existing && existing.status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        message: 'This MATM transaction was already processed.',
        data: { transactionId: existing.transactionId, status: existing.status },
      });
    }

    const isSuccess = submittedStatus === 'success' || submittedStatus === 'successful' || submittedStatus === '1';
    const isFailed = submittedStatus === 'failed' || submittedStatus === 'decline' || submittedStatus === '3';
    const initialStatus = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING';

    const transactionRecord = existing || (await Transaction.create({
      transactionId: referenceId,
      userId: req.user.id,
      type: 'MATM',
      amount,
      status: initialStatus,
      metadata: {
        provider: 'PAYSPRINT',
        mobile,
        transactionType,
        bankRRN: inputData.bankRRN || inputData.bankrrn || null,
        cardNumber: inputData.cardNumber || inputData.cardnumber || null,
        bankName: inputData.bankName || null,
        cardType: inputData.cardType || null,
        ackNo: inputData.ackNo || inputData.ackno || null,
        fpTransactionId: inputData.fpTransactionId || inputData.txnrefrenceNo || null,
      },
    }));

    if (transactionType === 'ATMCW') {
      if (isSuccess) {
        // Hit 3-Way Recon API with 'success'
        const reconRes = await paySprintMatmThreeWay({ reference: referenceId, status: 'success' });

        transactionRecord.status = 'SUCCESS';
        transactionRecord.metadata = {
          ...transactionRecord.metadata,
          threeWayStatus: reconRes?.status ?? true,
          threeWayMessage: reconRes?.message || 'Transaction Marked',
        };
        await transactionRecord.save();

        // Credit Retailer's AEPS Wallet
        await AepsWallet.findOneAndUpdate(
          { userId: req.user.id },
          { $inc: { balance: amount } },
          { upsert: true, new: true }
        );

        return res.status(200).json({
          success: true,
          message: 'MATM cash withdrawal successful. Wallet credited.',
          data: {
            transactionId: referenceId,
            status: 'SUCCESS',
            amount,
            bankRRN: transactionRecord.metadata.bankRRN,
            transactionType,
          },
        });
      } else if (isFailed) {
        // Hit 3-Way Recon API with 'failed'
        const reconRes = await paySprintMatmThreeWay({ reference: referenceId, status: 'failed' });

        transactionRecord.status = 'FAILED';
        transactionRecord.metadata = {
          ...transactionRecord.metadata,
          threeWayStatus: reconRes?.status ?? false,
          threeWayMessage: reconRes?.message || 'Transaction Marked Failed',
        };
        await transactionRecord.save();

        return res.status(400).json({
          success: false,
          message: inputData.message || 'MATM cash withdrawal failed.',
          data: {
            transactionId: referenceId,
            status: 'FAILED',
            transactionType,
          },
        });
      }
    } else {
      // Balance Enquiry (ATMBE)
      transactionRecord.status = isFailed ? 'FAILED' : 'SUCCESS';
      await transactionRecord.save();
      return res.status(200).json({
        success: !isFailed,
        message: isFailed ? 'Balance enquiry failed.' : 'Balance enquiry successful.',
        data: {
          transactionId: referenceId,
          status: transactionRecord.status,
          balance: inputData.balanceAmount || inputData.balance || 0,
          transactionType,
        },
      });
    }

    return res.status(202).json({
      success: true,
      pending: true,
      message: 'MATM request submitted; provider status is pending.',
      data: { transactionId: referenceId, status: 'PENDING' },
    });
  } catch (error) {
    console.error('MATM Process Error:', error?.message);
    return res.status(500).json({ success: false, message: 'Failed to process PaySprint MATM transaction' });
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
      return res.status(200).json({
        success: transaction.status === 'SUCCESS',
        status: transaction.status,
        message: `Transaction is already ${transaction.status.toLowerCase()}.`,
        data: transaction,
      });
    }

    const queryRes = await paySprintMatmStatusQuery({ reference: transactionId });
    if (!queryRes) {
      return res.status(500).json({ success: false, message: 'Could not fetch transaction status from PaySprint.' });
    }

    const txnStatus = queryRes.txnstatus; // 1 = success, 3 = failed, 2 = pending

    if (txnStatus === 1 || (queryRes.status === true && txnStatus === 1)) {
      await paySprintMatmThreeWay({ reference: transactionId, status: 'success' });
      transaction.status = 'SUCCESS';
      transaction.metadata = {
        ...transaction.metadata,
        bankRRN: queryRes.bankrrn || transaction.metadata?.bankRRN,
        cardNumber: queryRes.cardnumber || transaction.metadata?.cardNumber,
        ackNo: queryRes.ackno || transaction.metadata?.ackNo,
      };
      await transaction.save();

      await AepsWallet.findOneAndUpdate(
        { userId: req.user.id },
        { $inc: { balance: transaction.amount } },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        message: 'MATM transaction verified successful.',
        data: transaction,
      });
    } else if (txnStatus === 3) {
      await paySprintMatmThreeWay({ reference: transactionId, status: 'failed' });
      transaction.status = 'FAILED';
      await transaction.save();

      return res.status(400).json({
        success: false,
        status: 'FAILED',
        message: queryRes.message || 'MATM transaction failed.',
        data: transaction,
      });
    }

    return res.status(200).json({
      success: true,
      pending: true,
      status: 'PENDING',
      message: 'MATM transaction is still pending.',
      data: transaction,
    });
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
