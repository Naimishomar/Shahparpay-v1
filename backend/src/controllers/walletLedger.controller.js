import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import Transaction from '../models/transaction.model.js';

// Credit types where the wallet receives the transaction amount PLUS the
// retailer's commission (verified against applyAepsWithdrawalSuccess).
const CREDIT_WITH_COMMISSION = new Set(['AEPS_WITHDRAWAL']);

// Credit types where the wallet receives only the transaction amount
// (topups, refunds and AadhaarPay never earn commission on the ledger).
const CREDIT_AMOUNT_ONLY = new Set([
    'AADHAAR_PAY',
    'WALLET_TOPUP',
    'DIRECT_PAYOUT_REFUND',
    'AEPS_DEPOSIT_REFUND',
    'FUND_REQUEST',
    'REFUND'
]);

const TRANSFER_TYPES = new Set(['AEPSTOMAIN']);

const MONEY_MOVING_STATUSES = ['SUCCESS', 'REFUNDED', 'APPROVED'];

// Which wallet each transaction actually moves money in/out of.
// Verified against the controllers: daily auth (MAIN), PAN (debitMainWallet),
// ITR (MAIN), GST_REGISTRATION (MAIN), AEPS_SETTLEMENT (AEPS), etc.
const WALLET_LABELS = {
    AEPS_WITHDRAWAL: 'AEPS',
    AADHAAR_PAY: 'AEPS',
    AEPS_SETTLEMENT: 'AEPS',
    AEPSTOMAIN: 'AEPS→Main',
};

const getWalletLabel = (tx) => WALLET_LABELS[tx.type] || 'Main';

const TXNTYPE_LABELS = {
    AEPS_WITHDRAWAL: 'AEPS Wallet',
    AADHAAR_PAY: 'AadhaarPay',
    WALLET_TOPUP: 'Wallet Topup',
    RECHARGE: 'Recharge',
    BILL_PAYMENT: 'BBPS',
    DMT: 'DMT',
    AEPS_SETTLEMENT: 'Settlement',
    DIRECT_PAYOUT: 'Direct Payout',
    AEPS_DEPOSIT: 'AEPS Deposit',
    PAN_CARD: 'PAN Card',
    PAN_SERVICE: 'PAN Service',
    PAN_COUPON: 'PAN Coupon',
    ITR: 'ITR',
    GST_REGISTRATION: 'GST Registration',
    DAILY_AUTH_CHARGE: 'Daily Auth',
    AEPSTOMAIN: 'Wallet Transfer',
    DIRECT_PAYOUT_REFUND: 'Refund',
    AEPS_DEPOSIT_REFUND: 'Refund',
    FUND_REQUEST: 'Fund Request',
    FUND_TRANSFER: 'Fund Transfer',
    STD_PAN_CARD: 'PAN Card'
};

const toNumber = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(toNumber(v) * 100) / 100;

const getNarration = (tx) => {
    const m = tx.metadata || {};
    const isRefund = tx.transactionId && String(tx.transactionId).startsWith('REF-');
    if (isRefund) return `Refund ${m.originalTxn ? 'for ' + m.originalTxn : 'for failed transaction'}`;

    switch (tx.type) {
        case 'AEPS_WITHDRAWAL':
        case 'AADHAAR_PAY':
            return `Aadhaar *${m.aadhaar ? String(m.aadhaar).slice(-4) : 'N/A'} withdrawal`;
        case 'WALLET_TOPUP':
            return `Wallet Top-up ${m.utr ? 'UTR ' + m.utr : ''}`.trim();
        case 'RECHARGE':
            return `${m.operator || 'Recharge'} ${m.caNumber || ''}`.trim();
        case 'BILL_PAYMENT':
            return `Bill Payment ${m.caNumber || ''}`.trim();
        case 'DMT':
            return `DMT A/C ${m.beneficiaryAccount || 'N/A'}`;
        case 'AEPS_SETTLEMENT':
            return `AEPS Settlement A/C ${m.bankAccount || m.accountNumber || 'N/A'}`;
        case 'DIRECT_PAYOUT':
            return `Direct Payout A/C ${m.bankAccount || m.accountNumber || 'N/A'}`;
        case 'AEPS_DEPOSIT':
            return `AEPS Deposit ${m.aadhaar ? '*' + String(m.aadhaar).slice(-4) : ''}`.trim() || 'AEPS Deposit';
        case 'PAN_CARD':
        case 'PAN_SERVICE':
        case 'PAN_COUPON':
        case 'STD_PAN_CARD':
            return `PAN Application ${m.name || ''}`.trim();
        case 'ITR':
            return `ITR Filing ${m.name || ''}`.trim();
        case 'GST_REGISTRATION':
            return `GST Registration ${m.name || ''}`.trim();
        case 'DAILY_AUTH_CHARGE':
            return 'Daily 2FA Auth Charge';
        case 'AEPSTOMAIN':
            return 'AEPS → Main Transfer';
        default:
            return tx.type ? String(tx.type).replace(/_/g, ' ') : 'Transaction';
    }
};

/**
 * Net effect of a transaction on the combined (Main + AEPS) wallet.
 * Positive = money in, negative = money out, zero = internal transfer.
 */
const getWalletDelta = (tx) => {
    const amount = toNumber(tx.amount);
    const commission = toNumber(tx.commissions?.retailerEarned);
    const isRefund = tx.transactionId && String(tx.transactionId).startsWith('REF-');

    // Refund entries always credit the wallet back.
    if (isRefund) return round2(amount);

    if (TRANSFER_TYPES.has(tx.type)) return 0;

    if (CREDIT_WITH_COMMISSION.has(tx.type)) {
        return round2(amount + commission);
    }

    if (CREDIT_AMOUNT_ONLY.has(tx.type)) {
        return round2(amount);
    }

    // Debit types: money leaves, retailer commission (if any) is credited back.
    return round2(-amount + commission);
};

export const getWalletLedger = async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate, limit } = req.query;

        const mainWallet = await MainWallet.findOne({ userId });
        const aepsWallet = await AepsWallet.findOne({ userId });
        const currentCombined = round2((mainWallet?.balance || 0) + (aepsWallet?.balance || 0));

        const query = {
            userId,
            status: { $in: MONEY_MOVING_STATUSES }
        };

        // Balance reconstruction always runs over the full history so the
        // opening/closing balances stay correct when a date window is applied.
        const transactions = await Transaction.find(query)
            .sort({ createdAt: 1 })
            .lean();

        // Reconstruct running balance: walk forward from an implied opening
        // balance that lands exactly on the current combined wallet balance.
        const deltas = transactions.map(tx => ({ tx, delta: getWalletDelta(tx) }));
        const totalMovement = deltas.reduce((sum, d) => sum + d.delta, 0);
        let running = round2(currentCombined - totalMovement);

        const rows = deltas.map(({ tx, delta }) => {
            const opening = running;
            running = round2(running + delta);

            const commission = round2(toNumber(tx.commissions?.retailerEarned));
            const tds = round2(commission * 0.02);
            const gst = round2(commission * 0.18);
            const type = delta > 0 ? 'credit' : delta < 0 ? 'debit' : 'transfer';
        const isRefundRow = tx.transactionId && String(tx.transactionId).startsWith('REF-');
        const txntype = isRefundRow
            ? 'Refund'
            : (TXNTYPE_LABELS[tx.type] || String(tx.type || '').replace(/_/g, ' '));

        return {
            SNO: String(tx.transactionId || tx._id || ''),
            UTR: String(tx.transactionId || tx._id || ''),
            USERNAME: req.user.retailerId || req.user.distributorId || '',
            WALLET: getWalletLabel(tx),
            OPENING: opening,
            AMOUNT: round2(toNumber(tx.amount)),
            COMMISSION: commission,
            TDS: tds,
            GST: gst,
            CLOSING: running,
            TYPE: type,
            NARRATION: getNarration(tx),
            remarks: tx.status || '',
            TXNTYPE: txntype,
            DATE: tx.createdAt ? new Date(tx.createdAt).toISOString() : ''
        };
        });

        // Apply date window (balances already account for full history).
        let filtered = rows;
        if (startDate && endDate) {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const endMs = end.getTime();
            filtered = rows.filter(r => {
                const d = new Date(r.DATE).getTime();
                return d >= start && d <= endMs;
            });
        }

        // Newest first for display.
        filtered = filtered.sort((a, b) => (a.DATE < b.DATE ? 1 : a.DATE > b.DATE ? -1 : 0));

        if (limit) {
            filtered = filtered.slice(0, Number(limit) || filtered.length);
        }

        return res.status(200).json({
            success: true,
            currentCombined,
            total: filtered.length,
            data: filtered
        });
    } catch (error) {
        console.error("Wallet ledger error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
