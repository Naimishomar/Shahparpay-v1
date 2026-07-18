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
        }).sort({ createdAt: -1 }).lean();

        let stats = {
            DMT: 0,
            RECHARGE: 0,
            AEPS_WITHDRAWAL: 0,
            AEPS_SETTLEMENT: 0,
            DIRECT_PAYOUT: 0,
            BILL_PAYMENT: 0,
            WALLET_TOPUP: 0, // UPI is sometimes wallet topup
            TotalCommission: 0,
            TotalCustomers: 0,
            TotalTransactionsAmount: 0
        };

        let totalTransactionsAmount = 0;
        let uniqueCustomers = new Set();
        let recentSales = [];
        
        const startTime = (dateFilter.createdAt?.$gte || new Date(0)).getTime();
        const endTime = (dateFilter.createdAt?.$lte || new Date()).getTime();
        const binSize = Math.max((endTime - startTime) / 12, 1);
        const graphData = new Array(12).fill(0);

        transactions.forEach(txn => {
            const isRefund = txn.transactionId && txn.transactionId.startsWith('REF-');
            if (txn.status === 'SUCCESS' && !isRefund) {
                if (stats[txn.type] !== undefined) {
                    stats[txn.type] += txn.amount;
                }
                
                stats.TotalCommission += (txn.commissions?.retailerEarned || 0);
                totalTransactionsAmount += txn.amount;
                
                // Group graph data
                const txnTime = new Date(txn.createdAt).getTime();
                let binIndex = Math.floor((txnTime - startTime) / binSize);
                if (binIndex >= 12) binIndex = 11;
                if (binIndex >= 0) graphData[binIndex] += txn.amount;
                
                // Track unique customers based on available metadata
                let identifier = txn.metadata?.aadhaar || txn.metadata?.beneficiaryAccount || txn.metadata?.caNumber || txn.metadata?.mobile;
                if (identifier) {
                    uniqueCustomers.add(identifier);
                }
            }

            if (recentSales.length < 5) {
                let service = "Unknown";
                let details = "N/A";
                let name = txn.metadata?.name || txn.metadata?.customerName || txn.metadata?.beneficiaryName || "Customer";

                if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT') {
                    service = `Recharge / BBPS`;
                    details = `Operator: ${txn.metadata?.operator || 'Unknown'}, No: ${txn.metadata?.caNumber || "N/A"}`;
                } else if (txn.type === 'DMT') {
                    service = "DMT";
                    details = `A/C: ${txn.metadata?.beneficiaryAccount || "N/A"}`;
                } else if (txn.type === 'AEPS_WITHDRAWAL') {
                    service = "AEPS";
                    details = `Aadhaar: *${txn.metadata?.aadhaar ? txn.metadata.aadhaar.slice(-4) : "N/A"}`;
                } else if (txn.type === 'AEPS_SETTLEMENT') {
                    service = "AEPS Settlement";
                    details = `A/C: ${txn.metadata?.bankAccount || txn.metadata?.accountNumber || "N/A"}`;
                } else if (txn.type === 'DIRECT_PAYOUT') {
                    service = "Direct Payout";
                    details = `A/C: ${txn.metadata?.bankAccount || txn.metadata?.accountNumber || "N/A"}`;
                } else if (txn.type === 'WALLET_TOPUP') {
                    service = "Wallet Topup";
                    details = `Ref: ${txn.metadata?.utr || "N/A"}`;
                }

                recentSales.push({
                    service,
                    details,
                    name,
                    amount: `₹${txn.amount.toFixed(2)}`,
                    status: txn.status,
                    date: txn.createdAt
                });
            }
        });

        stats.TotalCustomers = uniqueCustomers.size;
        stats.TotalTransactionsAmount = totalTransactionsAmount;
        stats.graphData = graphData;

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
        const role = req.user.role;
        const { type, limit, startDate, endDate } = req.query;
        
        let query = {};
        if (role !== 'admin') {
            query.userId = userId;
        }

        if (type) {
            query.type = { $regex: new RegExp('^' + type) };
        }
        
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: end
            };
        }

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 10)
            .populate('userId', 'name businessName retailerId')
            .lean();

        return res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("Fetch transactions error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

