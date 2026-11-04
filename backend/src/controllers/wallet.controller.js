import AepsWallet from '../models/aepsWallet.model.js';
import MainWallet from '../models/mainWallet.model.js';
import QrWallet from '../models/qrWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import Transaction from '../models/transaction.model.js';
import bcrypt from 'bcrypt';
import Otp from '../models/otp.model.js';
import { transferBetweenWallets } from '../utils/wallet.util.js';
import { checkWalletPin } from '../utils/walletPin.js';

// Helper to initialize wallets if they don't exist
const initializeWallets = async (userId, userModel) => {
  let aepsWallet = await AepsWallet.findOne({ userId });
  let mainWallet = await MainWallet.findOne({ userId });

  if (!aepsWallet) {
    aepsWallet = await AepsWallet.create({ userId, userModel, balance: 0 });
  }
  if (!mainWallet) {
    mainWallet = await MainWallet.create({ userId, userModel, balance: 0 });
  }

  return { aepsWallet, mainWallet };
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

    const { aepsWallet, mainWallet } = await initializeWallets(userId, userModel);
    const qrWallet = await QrWallet.findOne({ userId }).select('balance');

    return res.status(200).json({
      success: true,
      data: {
        aepsBalance: aepsWallet.balance,
        mainBalance: mainWallet.balance,
        qrBalance: qrWallet?.balance ?? 0,
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
    // A verified OTP reset also clears any wrong-PIN lockout.
    aepsWallet.pinFailedAttempts = 0;
    aepsWallet.pinLockedUntil = null;
    await aepsWallet.save();

    return res.status(200).json({ success: true, message: 'PIN changed successfully.' });
  } catch (error) {
    console.error('Change PIN error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Retailer self-transfer: leftover legacy QR wallet money into Utility (MAIN).
// Trade -> Utility is gone: Icchhamati does not offer it. Old AEPSTOMAIN rows
// still show in history and the ledger.
const TRANSFERS = {
  QR: { to: 'MAIN', type: 'QRTO_MAIN', prefix: 'QRM', done: 'Moved to your Utility Wallet.' },
};

/**
 * Moves money between a retailer's own wallets, behind the wallet PIN.
 * Body: { amount, pin, from?: 'QR' } (defaults to QR).
 * @route POST /api/wallet/transfer
 */
export const transferQrToMain = async (req, res) => {
  try {
    const userId = req.user.id;
    if (req.user.role !== 'retailer') {
      return res.status(403).json({ success: false, message: 'Only retailers can transfer wallet balance.' });
    }
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: 'Invalid transfer amount.' });
    }
    if (!req.body?.pin) {
      return res.status(400).json({ success: false, message: 'Transaction PIN is required.' });
    }
    const pinError = await checkWalletPin(await AepsWallet.findOne({ userId }), req.body.pin);
    if (pinError) return res.status(pinError.status).json({ success: false, message: pinError.message });

    const from = String(req.body?.from || 'QR').toUpperCase();
    const route = TRANSFERS[from];
    if (!route) return res.status(400).json({ success: false, message: 'Unsupported wallet transfer.' });

    let transaction;
    try {
      transaction = await transferBetweenWallets(userId, from, route.to, amount, {
        transactionId: `${route.prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`,
        userId,
        type: route.type,
        amount,
        status: 'SUCCESS',
        // walletType tells the ledger which wallet the credit side landed in.
        metadata: { operator: route.type, source: 'LOCAL_WALLET_TRANSFER', walletType: route.to },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Wallet transfer failed.' });
    }
    return res.status(200).json({ success: true, message: route.done, transaction });
  } catch (error) {
    console.error('QR transfer error:', error);
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
