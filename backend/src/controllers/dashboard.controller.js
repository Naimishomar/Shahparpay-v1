import Transaction from '../models/transaction.model.js';
import mongoose from 'mongoose';

export const getRetailerStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            // Include entire end date by setting time to 23:59:59.999
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: end
                }
            };
        } else {
            // Default to today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            dateFilter = {
                createdAt: {
                    $gte: today,
                    $lte: endOfDay
                }
            };
        }

        const transactions = await Transaction.find({
            userId,
            ...dateFilter
        }).sort({ createdAt: -1 });

        let stats = {
            DMT: 0,
            RECHARGE: 0,
            AEPS_WITHDRAWAL: 0,
            AEPS_SETTLEMENT: 0,
            BILL_PAYMENT: 0,
            WALLET_TOPUP: 0, // UPI is sometimes wallet topup
            TotalCommission: 0,
            TotalCustomers: 0,
            TotalTransactionsAmount: 0
        };

        let totalTransactionsAmount = 0;
        let uniqueCustomers = new Set();
        let recentSales = [];

        transactions.forEach(txn => {
            if (txn.status === 'SUCCESS') {
                if (stats[txn.type] !== undefined) {
                    stats[txn.type] += txn.amount;
                }
                
                stats.TotalCommission += (txn.commissions?.retailerEarned || 0);
                totalTransactionsAmount += txn.amount;
                
                // Track unique customers based on available metadata
                let identifier = txn.metadata?.caNumber || txn.metadata?.mobile || txn.metadata?.beneficiaryAccount || txn.metadata?.aadhaar;
                if (identifier) {
                    uniqueCustomers.add(identifier);
                }
            }

            if (recentSales.length < 5) {
                // Determine a display name based on txn type or metadata
                let name = "Unknown";
                let email = "N/A";
                if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT') {
                    name = `Service: ${txn.metadata?.operator || 'Unknown'}`;
                    email = txn.metadata?.caNumber || "N/A";
                } else if (txn.type === 'DMT') {
                    name = "Money Transfer";
                    email = txn.metadata?.beneficiaryAccount || "N/A";
                } else if (txn.type === 'AEPS_WITHDRAWAL') {
                    name = "AEPS Withdrawal";
                    email = txn.metadata?.aadhaar ? `Aadhaar ending in ${txn.metadata.aadhaar.slice(-4)}` : "N/A";
                } else if (txn.type === 'AEPS_SETTLEMENT') {
                    name = "Wallet Settlement";
                    email = txn.metadata?.accountNumber || "N/A";
                }

                recentSales.push({
                    name,
                    email,
                    amount: `₹${txn.amount.toFixed(2)}`,
                    status: txn.status,
                    date: txn.createdAt
                });
            }
        });

        stats.TotalCustomers = uniqueCustomers.size;
        stats.TotalTransactionsAmount = totalTransactionsAmount;

        return res.status(200).json({
            success: true,
            data: {
                stats,
                recentSales
            }
        });

    } catch (error) {
        console.error("Dashboard error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getRecentTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, limit } = req.query;
        
        let query = { userId };
        if (type) {
            query.type = { $regex: new RegExp('^' + type) };
        }

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 10);

        return res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("Fetch transactions error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

