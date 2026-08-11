import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const Retailer = (await import('../src/models/users/retailer.model.js')).default;
const MainWallet = (await import('../src/models/mainWallet.model.js')).default;
const AepsWallet = (await import('../src/models/aepsWallet.model.js')).default;
const Transaction = (await import('../src/models/transaction.model.js')).default;

const toNumber = (v) => { if (v === null || v === undefined || v === '') return 0; const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (v) => Math.round(toNumber(v) * 100) / 100;

const MONEY_MOVING_STATUSES = ['SUCCESS', 'REFUNDED', 'APPROVED'];
const CREDIT_WITH_COMMISSION = new Set(['AEPS_WITHDRAWAL']);
const CREDIT_AMOUNT_ONLY = new Set(['AADHAAR_PAY', 'WALLET_TOPUP', 'DIRECT_PAYOUT_REFUND', 'AEPS_DEPOSIT_REFUND', 'FUND_REQUEST', 'REFUND']);
const isRefundTxnId = (id) => /^REF(UND)?-/.test(String(id || ''));

// Mirrors the fixed getCommissionSplit in walletLedger.controller.js: the
// commission ACTUALLY credited is the stored retailerEarned, not a slab recompute.
const getCommissionSplit = (tx) => {
    const gross = round2(toNumber(tx.commissions?.retailerEarned));
    const gst = round2(gross * 0.18);
    const net = round2(gross - gst);
    return { gross, gst, net };
};

// Mirrors the fixed getWalletDeltas in walletLedger.controller.js.
const getWalletDeltas = (tx) => {
    const amount = toNumber(tx.amount);
    const { net } = getCommissionSplit(tx);
    const isRefund = isRefundTxnId(tx.transactionId);

    if (isRefund) {
        if (tx.type === 'AEPS_WITHDRAWAL' || tx.type === 'AADHAAR_PAY' || tx.type === 'AEPS_SETTLEMENT') {
            return { main: 0, aeps: round2(amount) };
        }
        return { main: round2(amount), aeps: 0 };
    }
    if (tx.type === 'AEPSTOMAIN') return { main: round2(amount), aeps: round2(-amount) };
    if (CREDIT_WITH_COMMISSION.has(tx.type)) return { main: 0, aeps: round2(amount + net) };
    if (tx.type === 'AADHAAR_PAY') return { main: 0, aeps: round2(amount) };
    if (tx.type === 'AEPS_SETTLEMENT') return { main: 0, aeps: round2(-amount) };
    if (tx.type === 'PAN_SERVICE') {
        return { main: round2(-amount + toNumber(tx.commissions?.retailerEarned)), aeps: 0 };
    }
    if (CREDIT_AMOUNT_ONLY.has(tx.type)) return { main: round2(amount), aeps: 0 };
    return { main: round2(-amount + net), aeps: 0 };
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const retailer = await Retailer.findOne({ retailerId: 'A2ZB1004' }).lean();
    if (!retailer) { console.log('Retailer not found'); process.exit(1); }
    const main = await MainWallet.findOne({ userId: retailer._id }).lean();
    const aeps = await AepsWallet.findOne({ userId: retailer._id }).lean();
    const currentMain = round2(main?.balance || 0);
    const currentAeps = round2(aeps?.balance || 0);

    console.log('Actual MainWallet.balance =', currentMain, '| AepsWallet.balance =', currentAeps);

    // Same ledgerSource construction as the fixed controller: money-moving rows
    // + failed/pending locks (incl. AEPS_DEPOSIT) + synthesized resolveTransaction
    // refunds (those create NO transaction row).
    const txns = await Transaction.find({ userId: retailer._id, status: { $in: MONEY_MOVING_STATUSES } }).sort({ createdAt: 1 }).lean();
    const refRows = await Transaction.find({ userId: retailer._id, transactionId: /^REF(UND)?-/ }).lean();
    const refOriginalIds = new Set();
    for (const r of refRows) {
        if (r.metadata?.originalTxn) refOriginalIds.add(String(r.metadata.originalTxn));
        refOriginalIds.add(String(r.transactionId).replace(/^REF(UND)?-/, ''));
    }
    const pendingLocks = await Transaction.find({
        userId: retailer._id,
        type: { $in: ['AEPS_SETTLEMENT', 'DIRECT_PAYOUT', 'AEPS_DEPOSIT'] },
        status: { $nin: MONEY_MOVING_STATUSES }
    }).sort({ createdAt: 1 }).lean();

    const ledgerSource = [...txns];
    for (const t of pendingLocks) {
        ledgerSource.push(t);
        const refundedViaResolve = t.metadata?.refundStatus === 'COMPLETED' && !refOriginalIds.has(String(t.transactionId));
        if (refundedViaResolve) {
            ledgerSource.push({
                ...t,
                transactionId: `REF-${t.transactionId}`,
                amount: Math.abs(toNumber(t.amount)),
                status: 'REFUNDED',
                metadata: { ...(t.metadata || {}), originalTxn: t.transactionId },
                createdAt: new Date(new Date(t.createdAt).getTime() + 1)
            });
        }
    }
    ledgerSource.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let totalMain = 0, totalAeps = 0;
    const typeNet = {};
    for (const t of ledgerSource) {
        const { main, aeps: a } = getWalletDeltas(t);
        totalMain += main; totalAeps += a;
        typeNet[t.type] = typeNet[t.type] || { main: 0, aeps: 0 };
        typeNet[t.type].main += main;
        typeNet[t.type].aeps += a;
        if (isRefundTxnId(t.transactionId) || t.type === 'ITR' || t.type === 'AEPS_DEPOSIT' || t.type === 'PAN_SERVICE') {
            console.log(
                t.createdAt.toISOString(), '|', t.type.padEnd(20),
                '|', String(t.status).padEnd(10),
                '| amt', toNumber(t.amount).toFixed(2).padStart(8),
                '| txnId', String(t.transactionId).padEnd(24),
                '| mainDelta', main.toFixed(2).padStart(9),
                '| aepsDelta', a.toFixed(2).padStart(9)
            );
        }
    }

    console.log('\nReconstructed MAIN net =', round2(totalMain), '=> implied opening MAIN =', round2(currentMain - totalMain));
    console.log('Reconstructed AEPS net =', round2(totalAeps), '=> implied opening AEPS =', round2(currentAeps - totalAeps));
    console.log('\nPer-type MAIN/AEPS deltas:');
    for (const k of Object.keys(typeNet).sort()) {
        console.log('  ', k.padEnd(22), 'main', round2(typeNet[k].main).toFixed(2).padStart(9), '| aeps', round2(typeNet[k].aeps).toFixed(2).padStart(9));
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
