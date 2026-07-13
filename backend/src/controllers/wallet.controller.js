import AepsWallet from '../models/aepsWallet.model.js';
import MainWallet from '../models/mainWallet.model.js';
import Transaction from '../models/transaction.model.js';
import bcrypt from 'bcrypt';

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
        const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';
        
        const { aepsWallet, mainWallet } = await initializeWallets(userId, userModel);

        return res.status(200).json({
            success: true,
            data: {
                aepsBalance: aepsWallet.balance,
                mainBalance: mainWallet.balance,
                hasPin: !!aepsWallet.pin
            }
        });
    } catch (error) {
        console.error("Get balances error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const setPin = async (req, res) => {
    try {
        const userId = req.user.id;
        const { pin } = req.body;

        if (!pin || pin.toString().length !== 4 || isNaN(Number(pin))) {
            return res.status(400).json({ success: false, message: "A valid 4-digit PIN is required." });
        }

        const userModel = req.user.role === 'distributor' ? 'Distributor' : 'Retailer';
        const { aepsWallet } = await initializeWallets(userId, userModel);

        if (aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "PIN is already set." });
        }

        // Hash the PIN before saving
        const hashedPin = await bcrypt.hash(pin.toString(), 10);
        aepsWallet.pin = hashedPin;
        await aepsWallet.save();

        return res.status(200).json({ success: true, message: "PIN set successfully." });
    } catch (error) {
        console.error("Set PIN error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const transferAepsToMain = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, pin } = req.body;
        
        if (req.user.role !== 'retailer') {
            return res.status(403).json({ success: false, message: "Only retailers can transfer wallet balance." });
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid transfer amount." });
        }

        if (!pin) {
            return res.status(400).json({ success: false, message: "PIN is required." });
        }

        const aepsWallet = await AepsWallet.findOne({ userId });
        const mainWallet = await MainWallet.findOne({ userId });

        if (!aepsWallet || !mainWallet) {
            return res.status(404).json({ success: false, message: "Wallets not initialized." });
        }

        if (!aepsWallet.pin) {
            return res.status(400).json({ success: false, message: "PIN not set. Please set a PIN first." });
        }

        // Verify PIN
        const isPinValid = await bcrypt.compare(pin.toString(), aepsWallet.pin);
        if (!isPinValid) {
            return res.status(401).json({ success: false, message: "Incorrect PIN." });
        }

        const transferAmount = Number(amount);
        const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const User = (await import('../models/user.model.js')).default;
        const user = await User.findById(userId);
        const merchantcode = req.user.role === 'distributor' ? (user.distributorId || userId) : (user.retailerId || userId);

        const { transferAepsToMainWalletApi } = await import('../utils/paysprint.util.js');
        const apiResponse = await transferAepsToMainWalletApi(merchantcode, transferAmount, transactionId);

        if (!apiResponse.success) {
            return res.status(400).json({ success: false, message: `PaySprint Transfer Failed: ${apiResponse.message}` });
        }

        const { transferBetweenWallets } = await import('../utils/wallet.util.js');
        let transaction;
        try {
            transaction = await transferBetweenWallets(userId, 'AEPS', 'MAIN', transferAmount, {
                transactionId,
                userId,
                type: 'AEPSTOMAIN',
                amount: transferAmount,
                status: 'SUCCESS',
                metadata: {
                    operator: 'AEPSTOMAIN',
                    apiRef: apiResponse.data?.ackno || ''
                }
            });
        } catch (error) {
            // Local transfer failed, but PaySprint succeeded! This is critical, we must alert or log heavily
            console.error("CRITICAL Sync Error: PaySprint succeeded but local DB failed!", error);
            return res.status(500).json({ success: false, message: "Funds transferred at PaySprint, but local sync failed." });
        }

        // Fetch fresh balances for response
        const refreshedAeps = await AepsWallet.findOne({ userId });
        const refreshedMain = await MainWallet.findOne({ userId });

        return res.status(200).json({
            success: true,
            message: "Wallet transfer successful.",
            transaction,
            balances: {
                aepsBalance: refreshedAeps.balance,
                mainBalance: refreshedMain.balance
            }
        });

    } catch (error) {
        console.error("Transfer error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getTransferHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const history = await Transaction.find({ 
            userId, 
            type: 'AEPSTOMAIN' 
        }).sort({ createdAt: -1 }).limit(50);

        return res.status(200).json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error("Get history error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
