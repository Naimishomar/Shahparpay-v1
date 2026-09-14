import AepsWallet from '../models/aepsWallet.model.js';
import MainWallet from '../models/mainWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import QrWallet from '../models/qrWallet.model.js';
import Transaction from '../models/transaction.model.js';
import bcrypt from 'bcrypt';
import { transferBetweenWallets } from '../utils/wallet.util.js';
import Otp from '../models/otp.model.js';

// Helper to initialize wallets if they don't exist
const initializeWallets = async (userId, userModel) => {
  let aepsWallet = await AepsWallet.findOne({ userId });
  let mainWallet = await MainWallet.findOne({ userId });
  let qrWallet = await QrWallet.findOne({ userId });

  if (!aepsWallet) {
    aepsWallet = await AepsWallet.create({ userId, userModel, balance: 0 });
  }
  if (!mainWallet) {
    mainWallet = await MainWallet.create({ userId, userModel, balance: 0 });
  }
  if (!qrWallet) {
    qrWallet = await QrWallet.create({ userId, userModel, balance: 0 });
  }

  return { aepsWallet, mainWallet, qrWallet };
};

export const getBalances = async (req, res) => {
  try {
    const userId = req.user.id;

    // Handle admin separately
    if (req.user.role === 'admin') {
      const adminWallet = await AdminWallet.findOne({ userId });
      return res.status(200).json({
        success: true,
        data: {
          adminBalance: adminWallet ? adminWallet.balance : 0,
        },
      });
    }

    const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';

    const { aepsWallet, mainWallet, qrWallet } = await initializeWallets(userId, userModel);

    return res.status(200).json({
      success: true,
      data: {
        aepsBalance: aepsWallet.balance,
        mainBalance: mainWallet.balance,
        qrBalance: qrWallet.balance,
        hasPin: !!aepsWallet.pin,
      },
    });
  } catch (error) {
    console.error('Get balances error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const setPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    if (!pin || pin.toString().length !== 4 || isNaN(Number(pin))) {
      return res.status(400).json({ success: false, message: 'A valid 4-digit PIN is required.' });
    }

    const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';
    const { aepsWallet } = await initializeWallets(userId, userModel);

    if (aepsWallet.pin) {
      return res.status(400).json({ success: false, message: 'PIN is already set.' });
    }

    // Hash the PIN before saving
    const hashedPin = await bcrypt.hash(pin.toString(), 10);
    aepsWallet.pin = hashedPin;
    await aepsWallet.save();

    return res.status(200).json({ success: true, message: 'PIN set successfully.' });
  } catch (error) {
    console.error('Set PIN error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Changes the wallet PIN of the signed-in user. The old PIN is deliberately
 * NOT required — a retailer who has forgotten it still needs a way back in —
 * so the email OTP is the whole authorisation. Request one from
 * POST /api/auth/send-password-otp first; it is sent to the address on the
 * access token, never to an address supplied here.
 * @route POST /api/wallet/change-pin
 */
export const changePin = async (req, res) => {
  try {
    const { otp, newPin } = req.body;
    const email = req.user?.email;

    if (!otp || !newPin) {
      return res.status(400).json({ success: false, message: 'OTP and new PIN are required.' });
    }
    const pin = String(newPin);
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'A valid 4-digit PIN is required.' });
    }
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'No email on file for this account.' });
    }

    if (!(await Otp.consume(email, otp))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';
    const { aepsWallet } = await initializeWallets(req.user.id, userModel);

    aepsWallet.pin = await bcrypt.hash(pin, 10);
    await aepsWallet.save();

    return res.status(200).json({ success: true, message: 'PIN changed successfully.' });
  } catch (error) {
    console.error('Change PIN error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const transferQrToMain = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, pin } = req.body;

    if (req.user.role !== 'retailer') {
      return res
        .status(403)
        .json({ success: false, message: 'Only retailers can transfer wallet balance.' });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid transfer amount.' });
    }

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required.' });
    }

    const qrWallet = await QrWallet.findOne({ userId });
    const mainWallet = await MainWallet.findOne({ userId });

    if (!qrWallet || !mainWallet) {
      return res.status(404).json({ success: false, message: 'Wallets not initialized.' });
    }

    // The transfer PIN remains the retailer's existing secure wallet PIN.
    const pinWallet = await AepsWallet.findOne({ userId });
    if (!pinWallet?.pin) {
      return res
        .status(400)
        .json({ success: false, message: 'PIN not set. Please set a PIN first.' });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin.toString(), pinWallet.pin);
    if (!isPinValid) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN.' });
    }

    const transferAmount = Number(amount);
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    let transaction;
    try {
      transaction = await transferBetweenWallets(userId, 'QR', 'MAIN', transferAmount, {
        transactionId,
        userId,
        type: 'QRTO_MAIN',
        amount: transferAmount,
        status: 'SUCCESS',
        metadata: {
          operator: 'QRTO_MAIN',
          source: 'LOCAL_WALLET_TRANSFER',
        },
      });
    } catch (error) {
      console.error('Local wallet transfer failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Wallet transfer failed. No external provider was charged.',
      });
    }

    // Fetch fresh balances for response
    const refreshedQr = await QrWallet.findOne({ userId });
    const refreshedMain = await MainWallet.findOne({ userId });

    return res.status(200).json({
      success: true,
      message: 'Wallet transfer successful.',
      transaction,
      balances: {
        qrBalance: refreshedQr.balance,
        mainBalance: refreshedMain.balance,
      },
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTransferHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const history = await Transaction.find({
      userId,
      type: { $in: ['QRTO_MAIN', 'AEPSTOMAIN'] },
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
