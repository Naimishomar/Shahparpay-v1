import Transaction from '../models/transaction.model.js';
import mongoose from 'mongoose';
import { retailerNetCommission } from '../utils/wallet.util.js';

/**
 * Retailers are in India, and "today's earnings" has to mean their today. The
 * server may well run in UTC, where a 9pm IST sale falls on tomorrow and the
 * day a retailer is reading reads short.
 */
const IST = 'Asia/Kolkata';

/** A refund reverses a sale whose commission was already counted. */
const REFUND_PREFIX = /^REF(UND)?-/;

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
          $lte: end,
        },
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
          $lte: endOfDay,
        },
      };
    }

    const transactions = await Transaction.find({
      userId,
      ...dateFilter,
    })
      .sort({ createdAt: -1 })
      .lean();

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
      TotalTransactionsAmount: 0,
    };

    let totalTransactionsAmount = 0;
    let uniqueCustomers = new Set();
    let recentSales = [];

    const startTime = (dateFilter.createdAt?.$gte || new Date(0)).getTime();
    const endTime = (dateFilter.createdAt?.$lte || new Date()).getTime();
    const binSize = Math.max((endTime - startTime) / 12, 1);
    const graphData = new Array(12).fill(0);

    transactions.forEach((txn) => {
      const isRefund = txn.transactionId && REFUND_PREFIX.test(String(txn.transactionId));
      if (txn.status === 'SUCCESS' && !isRefund) {
        if (stats[txn.type] !== undefined) {
          stats[txn.type] += txn.amount;
        }

        // Net of TDS: retailerEarned is the gross figure, and the wallet is
        // credited net, so reporting the gross overstates what was earned.
        stats.TotalCommission += retailerNetCommission(txn);
        totalTransactionsAmount += txn.amount;

        // Group graph data
        const txnTime = new Date(txn.createdAt).getTime();
        let binIndex = Math.floor((txnTime - startTime) / binSize);
        if (binIndex >= 12) binIndex = 11;
        if (binIndex >= 0) graphData[binIndex] += txn.amount;

        // Track unique customers based on available metadata
        let identifier =
          txn.metadata?.aadhaar ||
          txn.metadata?.beneficiaryAccount ||
          txn.metadata?.caNumber ||
          txn.metadata?.mobile;
        if (identifier) {
          uniqueCustomers.add(identifier);
        }
      }

      if (recentSales.length < 5) {
        let service = 'Unknown';
        let details = 'N/A';
        let name =
          txn.metadata?.name ||
          txn.metadata?.customerName ||
          txn.metadata?.beneficiaryName ||
          'Customer';

        if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT') {
          service = `Recharge / BBPS`;
          details = `Operator: ${txn.metadata?.operator || 'Unknown'}, No: ${txn.metadata?.caNumber || 'N/A'}`;
        } else if (txn.type === 'DMT') {
          service = 'DMT';
          details = `A/C: ${txn.metadata?.beneficiaryAccount || 'N/A'}`;
        } else if (txn.type === 'AEPS_WITHDRAWAL') {
          service = 'AEPS';
          details = `Aadhaar: *${txn.metadata?.aadhaar ? txn.metadata.aadhaar.slice(-4) : 'N/A'}`;
        } else if (txn.type === 'AEPS_SETTLEMENT') {
          service = 'AEPS Settlement';
          details = `A/C: ${txn.metadata?.bankAccount || txn.metadata?.accountNumber || 'N/A'}`;
        } else if (txn.type === 'DIRECT_PAYOUT') {
          service = 'Direct Payout';
          details = `A/C: ${txn.metadata?.bankAccount || txn.metadata?.accountNumber || 'N/A'}`;
        } else if (txn.type === 'WALLET_TOPUP') {
          service = 'Wallet Topup';
          details = `Ref: ${txn.metadata?.utr || 'N/A'}`;
        }

        recentSales.push({
          service,
          details,
          name,
          amount: `₹${txn.amount.toFixed(2)}`,
          status: txn.status,
          date: txn.createdAt,
        });
      }
    });

    stats.TotalCommission = Math.round(stats.TotalCommission * 100) / 100;
    stats.TotalCustomers = uniqueCustomers.size;
    stats.TotalTransactionsAmount = totalTransactionsAmount;
    stats.graphData = graphData;

    return res.status(200).json({
      success: true,
      data: {
        stats,
        recentSales,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Commission earned per day, for the home screen's day strip.
 *
 * Deliberately not derived from the recent-transactions list: that call is
 * capped at a row limit and sorted newest first, so a busy retailer's earlier
 * days silently read zero once the cap is hit. This aggregates every matching
 * row in the window instead, so the figure cannot be truncated.
 *
 * Days are IST days and the amounts are net of TDS, which is what actually
 * reached the wallet.
 */
export const getCommissionByDay = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);

    // One extra day of slack: the window is cut on the server's clock but
    // grouped by IST day, and the caller picks the keys it wants.
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const match = {
      status: 'SUCCESS',
      createdAt: { $gte: start },
      transactionId: { $not: REFUND_PREFIX },
    };
    if (req.user.role !== 'admin') {
      match.userId = new mongoose.Types.ObjectId(String(req.user.id));
    }

    const rows = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST } },
          gross: { $sum: { $ifNull: ['$commissions.retailerEarned', 0] } },
          // The same netting rule as retailerNetCommission: prefer the TDS that
          // was actually stored, fall back to 2% for rows predating the field,
          // and never deduct any from cash-deposit commission.
          tds: {
            $sum: {
              $let: {
                vars: { gross: { $ifNull: ['$commissions.retailerEarned', 0] } },
                in: {
                  $cond: [
                    { $eq: ['$type', 'AEPS_DEPOSIT'] },
                    0,
                    {
                      $ifNull: [
                        '$commissions.retailerTds',
                        { $multiply: ['$$gross', 0.02] },
                      ],
                    },
                  ],
                },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const byDay = {};
    for (const row of rows) {
      byDay[row._id] = {
        commission: Math.round((row.gross - row.tds) * 100) / 100,
        count: row.count,
      };
    }

    return res.status(200).json({ success: true, data: byDay });
  } catch (error) {
    console.error('Commission by day error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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
      // A report can ask for more than one type: recharges and bill payments are
      // one screen. Prefixes are kept (AEPS still matches AEPS_WITHDRAWAL), and
      // each one is escaped — `type` is a query parameter, not something we
      // control, and it is being compiled into a regular expression.
      const prefixes = String(type)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (prefixes.length) {
        query.type = { $regex: new RegExp(`^(${prefixes.join('|')})`) };
      }
    }

    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: end,
      };
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 10)
      .populate('userId', 'name businessName retailerId')
      .lean();

    // A failed transaction can be fully refunded after the provider rejects it.
    // Reports must show the final wallet outcome, otherwise retailers see a
    // debit-looking FAILED row even though the held amount was returned.
    const reportTransactions = transactions.map((transaction) => {
      const isRefunded =
        transaction.metadata?.refundStatus === 'COMPLETED' &&
        ['FAILED', 'REFUNDED'].includes(transaction.status);
      return isRefunded
        ? { ...transaction, status: 'REFUNDED', reportStatus: 'REFUNDED' }
        : transaction;
    });

    return res.status(200).json({ success: true, data: reportTransactions });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
