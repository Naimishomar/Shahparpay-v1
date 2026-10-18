import axios from 'axios';
import { hasCallbackKey } from '../utils/callbackKey.js';
import Retailer from '../models/users/retailer.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Transaction from '../models/transaction.model.js';
import {
  getDistributorCommission,
  settleCommissions,
  updateWalletAtomically,
} from '../utils/wallet.util.js';

/**
 * 1. Launch ITR Filing Session (returns redirection URL from eSevaTech)
 */
export const launchItrFiling = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id);
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const partner_unique_id = process.env.ESEVATECH_PARTNER_UNIQUE_ID;
    const secret_key = process.env.ESEVATECH_SECRET_KEY;

    if (!partner_unique_id || !secret_key) {
      return res.status(500).json({
        success: false,
        message:
          'eSevaTech configuration is missing on the server. Please check environment variables.',
      });
    }

    const agent_unique_id = retailer.retailerId;

    const data = {
      partner_unique_id,
      agent_unique_id,
      secret_key,
    };

    console.log(`[ITR Launch] Launching ITR session for Agent ID: ${agent_unique_id}`);

    const response = await axios.post('https://esevatech.in/api/core/main/genLive.php', data, {
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data;

    if (result && result.success) {
      return res.status(200).json({
        success: true,
        redirect_url: result.redirect_url,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to generate redirection URL from eSevaTech',
      });
    }
  } catch (error) {
    console.error('Error launching ITR filing:', error);
    return res.status(500).json({
      success: false,
      message:
        error.response?.data?.message || error.message || 'Internal server error during ITR launch',
    });
  }
};

/**
 * 2. eSevaTech Agent Wallet Check callback
 */
export const checkAgentWallet = async (req, res) => {
  try {
    // eSevaTech calls this unauthenticated; without the shared key anyone could
    // read any retailer's balance. Register the URL with ?key=<ESEVATECH_CALLBACK_KEY>.
    if (!hasCallbackKey(req, 'ESEVATECH_CALLBACK_KEY')) {
      return res.status(401).json({ success: false, sufficient_balance: false, error_code: 'UNAUTHORIZED' });
    }
    const payload = req.method === 'GET' ? req.query : req.body;
    const { partner_unique_id, agent_unique_id, required_amount } = payload;

    if (!agent_unique_id || required_amount === undefined) {
      return res.status(200).json({
        success: true,
        sufficient_balance: false,
        current_balance: 0,
        error_code: 'INVALID_REQUEST',
        message: 'Missing required parameters',
      });
    }

    // Validate Partner ID (an unset env var must not match a missing field)
    if (!process.env.ESEVATECH_PARTNER_UNIQUE_ID || partner_unique_id !== process.env.ESEVATECH_PARTNER_UNIQUE_ID) {
      return res.status(200).json({
        success: true,
        sufficient_balance: false,
        current_balance: 0,
        error_code: 'INVALID_PARTNER',
        message: 'Invalid partner_unique_id',
      });
    }

    // Find agent (retailer) in our DB
    const retailer = await Retailer.findOne({ retailerId: agent_unique_id });
    if (!retailer) {
      return res.status(200).json({
        success: true,
        sufficient_balance: false,
        current_balance: 0,
        error_code: 'AGENT_NOT_FOUND',
        message: 'Agent not found',
      });
    }

    // Get main wallet balance
    const mainWallet = await MainWallet.findOne({ userId: retailer._id });
    const balance = mainWallet ? mainWallet.balance : 0;

    const isSufficient = balance >= Number(required_amount);

    console.log(
      `[ITR Wallet Check] Agent: ${agent_unique_id}, Balance: ${balance}, Required: ${required_amount}, Sufficient: ${isSufficient}`
    );

    return res.status(200).json({
      success: true,
      sufficient_balance: isSufficient,
      current_balance: balance,
    });
  } catch (error) {
    console.error('Error in checkAgentWallet:', error);
    return res.status(200).json({
      success: true,
      sufficient_balance: false,
      current_balance: 0,
      error_code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error during wallet check',
    });
  }
};

/**
 * 3. eSevaTech Webhook (Handles Form Submitted / Refunded events)
 */
export const itrWebhook = async (req, res) => {
  try {
    // This endpoint debits and credits wallets, so it must prove it is eSevaTech.
    if (!hasCallbackKey(req, 'ESEVATECH_CALLBACK_KEY')) {
      return res.status(401).json({ success: false, message: 'Unauthorized callback' });
    }
    const payload = req.body;
    const event = req.headers['x-esevatech-event'] || payload.event || '';
    const service_type = payload.service_type || 'ITR';

    console.log(
      `[ITR Webhook] Received Event: "${event}" for service "${service_type}". Payload:`,
      payload
    );

    // 0. WALLET CHECK FLOW
    // If eSevaTech only uses a single webhook URL, wallet checks will arrive here.
    // We can identify a wallet check request by the presence of `required_amount`.
    if (payload.required_amount !== undefined) {
      console.log(
        `[ITR Webhook] Delegating to checkAgentWallet because required_amount is present.`
      );
      return checkAgentWallet(req, res);
    }

    // 1. REFUND FLOW (Credit agent wallet)
    if (event === 'application_refunded') {
      const agent_unique_id = trimString(payload.agent_unique_id);
      const application_id = Number(payload.application_id);
      const agent_charge_amount = Number(payload.agent_charge_amount);

      if (
        !agent_unique_id ||
        !application_id ||
        isNaN(agent_charge_amount) ||
        agent_charge_amount <= 0
      ) {
        return res.status(400).json({ success: false, message: 'Invalid refund data' });
      }

      const retailer = await Retailer.findOne({ retailerId: agent_unique_id });
      if (!retailer) {
        return res.status(404).json({ success: false, message: 'Retailer not found' });
      }

      // A refund must reverse a debit we actually made for this retailer, exactly
      // once, and never for more than was charged.
      const refundTxnId = `REF-ITR-${application_id}`;
      const originalTxn = await Transaction.findOneAndUpdate(
        {
          $or: [
            { transactionId: `${service_type}-${application_id}` },
            { 'metadata.application_id': application_id, type: service_type },
          ],
          userId: retailer._id,
          status: 'SUCCESS',
        },
        { $set: { status: 'REFUNDED' } },
        { new: true }
      );
      if (!originalTxn) {
        return res
          .status(200)
          .json({ success: true, message: 'No refundable debit for this application (already refunded or unknown)' });
      }
      const refundAmount = Math.min(agent_charge_amount, Number(originalTxn.amount) || 0);

      // Credit retailer wallet atomically
      await updateWalletAtomically(retailer._id, 'MAIN', refundAmount, {
        transactionId: refundTxnId,
        userId: retailer._id,
        type: service_type,
        amount: refundAmount,
        status: 'REFUNDED',
        metadata: {
          application_id,
          refund_amount: payload.refund_amount,
          agent_charge_amount,
          service_type,
          applicant_name: payload.applicant_name,
          pan_number: payload.pan_number,
          timestamp: payload.timestamp,
          message: payload.message || 'eSevaTech Application Refund',
        },
      });

      console.log(
        `[ITR Webhook] Refund successful. Credited ₹${refundAmount} to Retailer ${agent_unique_id}`
      );

      return res.status(200).json({
        success: true,
        message: 'Agent wallet credited for refund',
      });
    }

    // 2. SUBMIT FLOW (Debit agent wallet)
    if (event === 'application_submitted' || event === '') {
      const agent_unique_id = trimString(payload.agent_unique_id);
      const application_id = Number(payload.application_id);
      const total_amount = Number(payload.total_amount);

      if (!agent_unique_id || !application_id || isNaN(total_amount) || total_amount < 0) {
        return res.status(400).json({ success: false, message: 'Invalid application submit data' });
      }

      const retailer = await Retailer.findOne({ retailerId: agent_unique_id });
      if (!retailer) {
        return res.status(404).json({ success: false, message: 'Retailer not found' });
      }

      // Prevent duplicate submit debit
      const transactionId = `${service_type}-${application_id}`;
      const existingTxn = await Transaction.findOne({ transactionId });
      if (existingTxn) {
        return res.status(200).json({ success: true, message: 'Data received' });
      }

      // Debit retailer wallet atomically
      await updateWalletAtomically(retailer._id, 'MAIN', -total_amount, {
        transactionId,
        userId: retailer._id,
        type: service_type,
        amount: total_amount,
        status: 'SUCCESS',
        metadata: {
          application_id,
          eseva_fee: payload.eseva_fee,
          partner_margin: payload.partner_margin,
          gst_amount: payload.gst_amount,
          late_fee: payload.late_fee,
          timestamp: payload.timestamp,
          status: payload.status || 'Submitted',
        },
      });

      // The retailer sets their own price to the customer; only the partner
      // (distributor) is paid on the rate card.
      const split = await settleCommissions({
        retailerId: retailer._id,
        distributorGross: getDistributorCommission(service_type, total_amount),
      });
      if (split.distributorEarned > 0) {
        await Transaction.updateOne(
          { transactionId },
          {
            $set: {
              'commissions.distributorEarned': split.distributorEarned,
              'commissions.distributorTds': split.distributorTds,
            },
          }
        );
      }

      console.log(
        `[ITR Webhook] Submit successful. Debited ₹${total_amount} from Retailer ${agent_unique_id}`
      );

      return res.status(200).json({
        success: true,
        message: 'Data received',
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event' });
  } catch (error) {
    console.error('Error in itrWebhook:', error);
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Internal server error in webhook' });
  }
};

/**
 * 4. Get Agent's ITR transaction history
 */
export const getItrHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user.id,
      type: 'ITR',
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      transactions,
      data: transactions, // every other list endpoint uses `data`
    });
  } catch (error) {
    console.error('Error fetching ITR history:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Helper utility
const trimString = (val) => {
  return typeof val === 'string' ? val.trim() : '';
};
