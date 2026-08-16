import cron from 'node-cron';
import Transaction from '../models/transaction.model.js';
import {
  resolveTransaction,
  applyAepsWithdrawalSuccess,
  applyAepsDepositSuccess,
  queryAepsTransactionStatus,
  queryAepsDepositStatus,
  updateWalletAtomically,
} from '../utils/wallet.util.js';
import axios from 'axios';
import crypto from 'crypto';
import { generatePaySprintToken } from '../utils/paysprint.util.js';

/**
 * PaySprint header generator helper
 */
const getPaySprintHeaders = () => {
  return {
    Token: generatePaySprintToken(),
    Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
    'Content-Type': 'application/json',
  };
};

/**
 * Checks status of a stuck payout transaction
 */
const verifyPayoutStatus = async (transaction) => {
  try {
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';

    // This is a common PaySprint status endpoint pattern.
    // It might need adjustment based on their actual docs.
    const response = await axios.post(
      `${baseUrl}/service/payout/payout/status`,
      {
        reference_id: transaction.transactionId,
      },
      { headers: getPaySprintHeaders() }
    );

    // If PaySprint confirms it's SUCCESS
    if (response.data?.status === true || response.data?.response_code === 1) {
      return 'SUCCESS';
    }

    // If PaySprint explicitly says it failed
    if (response.data?.status === false || response.data?.response_code === 0) {
      return 'FAILED';
    }

    // If status is pending at PaySprint side, keep it PROCESSING here
    return 'PROCESSING';
  } catch (error) {
    // If API fails to respond (e.g. 404/500), we cannot safely refund yet.
    // Must stay PROCESSING until manually resolved or PaySprint API recovers.
    console.error(`Status API failed for ${transaction.transactionId}:`, error.message);
    return 'PROCESSING';
  }
};

/**
 * Resolves a stuck AEPS_WITHDRAWAL transaction against the AEPS status query
 * endpoint. The gateway's original response was ambiguous (bank acknowledged
 * but reported failure), so the bank is the source of truth here.
 *
 * - SUCCESS  -> credit wallets (idempotent — cannot double-credit)
 * - FAILED   -> finalize FAILED (nothing was locked, so no refund)
 * - PROCESSING / query error -> leave PROCESSING for the next run
 *
 * Returns a human-readable result string for the cron log.
 */
const resolveAepsWithdrawal = async (txn) => {
  const reconciled = await queryAepsTransactionStatus(txn.transactionId);

  if (reconciled.status === 'SUCCESS') {
    const paysprintRef =
      txn.metadata?.paysprintRef || reconciled.data?.ackno || reconciled.data?.bankrrn || undefined;
    const credited = await applyAepsWithdrawalSuccess({
      transactionId: txn._id,
      userId: txn.userId,
      amount: txn.amount,
      paysprintRef,
      message: reconciled.data?.message || 'Cash withdrawal successful',
    });
    return credited
      ? `AEPS withdrawal ${txn.transactionId} resolved as SUCCESS — bank debited, wallets credited.`
      : `AEPS withdrawal ${txn.transactionId} already resolved; skipped.`;
  }

  if (reconciled.status === 'FAILED') {
    const reconciledData = reconciled.data || {};
    const updated = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PROCESSING' },
      {
        $set: {
          status: 'FAILED',
          metadata: {
            ...(txn.metadata || {}),
            reconciledAt: new Date().toISOString(),
            reconciledStatus: 'FAILED',
            apiMessage:
              reconciledData.message || 'Resolved by reconciliation cron. AEPS status: FAILED',
            ...(reconciledData.ackno ? { ackno: reconciledData.ackno } : {}),
            ...(reconciledData.bankrrn ? { bankrrn: reconciledData.bankrrn } : {}),
          },
        },
      }
    );
    return updated
      ? `AEPS withdrawal ${txn.transactionId} resolved as FAILED by AEPS status query.`
      : `AEPS withdrawal ${txn.transactionId} already resolved; skipped.`;
  }

  return `AEPS withdrawal ${txn.transactionId} still in process; keeping PROCESSING.`;
};

/**
 * Resolves a stuck AEPS_DEPOSIT transaction against the NSDL Cash Deposit
 * Status Query endpoint. The original gateway response was ambiguous (bank
 * acknowledged but reported failure), so the bank is the source of truth.
 *
 * - SUCCESS  -> finalize SUCCESS (amount already deducted, nothing to credit)
 * - FAILED   -> refund the deducted amount back to the main wallet + finalize FAILED
 * - PROCESSING / query error -> leave PROCESSING for the next run
 *
 * Returns a human-readable result string for the cron log.
 */
const resolveAepsDeposit = async (txn) => {
  const reconciled = await queryAepsDepositStatus(txn.transactionId);

  if (reconciled.status === 'SUCCESS') {
    const reconciledData = reconciled.data || {};
    const credited = await applyAepsDepositSuccess({
      transactionId: txn._id,
      userId: txn.userId,
      amount: txn.amount,
      paysprintRef:
        txn.metadata?.paysprintRef || reconciledData.ackno || reconciledData.bankrrn || undefined,
      message: reconciledData.message || 'Resolved by reconciliation cron. Cash deposit status: SUCCESS',
    });
    if (credited) {
      return `AEPS deposit ${txn.transactionId} resolved as SUCCESS — customer bank credited, deposit commission credited.`;
    }
    const updated = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PROCESSING' },
      {
        $set: {
          status: 'SUCCESS',
          metadata: {
            ...(txn.metadata || {}),
            reconciledAt: new Date().toISOString(),
            reconciledStatus: 'SUCCESS',
            apiMessage:
              reconciledData.message ||
              'Resolved by reconciliation cron. Cash deposit status: SUCCESS',
            ...(reconciledData.ackno ? { ackno: reconciledData.ackno } : {}),
            ...(reconciledData.bankrrn ? { bankrrn: reconciledData.bankrrn } : {}),
          },
        },
      }
    );
    return updated
      ? `AEPS deposit ${txn.transactionId} resolved as SUCCESS — customer bank credited, amount already deducted.`
      : `AEPS deposit ${txn.transactionId} already resolved; skipped.`;
  }

  if (reconciled.status === 'FAILED') {
    const refundAmount = Math.abs(Number(txn.amount));
    await updateWalletAtomically(txn.userId, 'MAIN', refundAmount, {
      transactionId: `REF-${txn.transactionId}`,
      userId: txn.userId,
      type: 'AEPS_DEPOSIT_REFUND',
      amount: refundAmount,
      status: 'SUCCESS',
      metadata: {
        originalTxn: txn.transactionId,
        note: 'Refund for failed Cash Deposit (reconciliation)',
      },
    });

    const reconciledData = reconciled.data || {};
    const updated = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'PROCESSING' },
      {
        $set: {
          status: 'FAILED',
          metadata: {
            ...(txn.metadata || {}),
            reconciledAt: new Date().toISOString(),
            reconciledStatus: 'FAILED',
            apiMessage:
              reconciledData.message ||
              'Resolved by reconciliation cron. Cash deposit status: FAILED',
            ...(reconciledData.ackno ? { ackno: reconciledData.ackno } : {}),
            ...(reconciledData.bankrrn ? { bankrrn: reconciledData.bankrrn } : {}),
          },
        },
      }
    );
    return updated
      ? `AEPS deposit ${txn.transactionId} resolved as FAILED — amount refunded to main wallet.`
      : `AEPS deposit ${txn.transactionId} already resolved; skipped.`;
  }

  return `AEPS deposit ${txn.transactionId} still in process; keeping PROCESSING.`;
};

/**
 * The main Reconciliation Job
 * Runs every 5 minutes
 */
export const startReconciliationWorker = () => {
  console.log('CRON: Transaction Reconciliation Worker started.');

  cron.schedule('*/5 * * * *', async () => {
    console.log('CRON: Running pending transactions check...');

    try {
      // Find transactions stuck in PROCESSING for more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const stuckTransactions = await Transaction.find({
        status: 'PROCESSING',
        createdAt: { $lt: fiveMinutesAgo },
      });

      if (stuckTransactions.length === 0) {
        return;
      }

      console.log(`CRON: Found ${stuckTransactions.length} stuck transaction(s). Resolving...`);

      for (const txn of stuckTransactions) {
        let finalStatus = 'PROCESSING';

        // AEPS transactions are reconciled against the AEPS status
        // query endpoint — never auto-FAILED/refunded here. Auto-FAILING
        // an AEPS withdrawal would wrongly refund money the bank may
        // have actually debited. AEPS_WITHDRAWAL and AEPS_DEPOSIT are
        // fully wired; the remaining AEPS types and UPI_CASHOUT (which
        // resolves via the UPI-CASHOUT webhook) have no reconciler and
        // are skipped so they are never auto-finalized incorrectly.
        const AEPS_TYPES = [
          'AEPS_WITHDRAWAL',
          'AEPS_DEPOSIT',
          'AEPS_DEPOSIT_REFUND',
          'AEPSTOMAIN',
          'AEPS_SETTLEMENT',
          'UPI_CASHOUT',
        ];
        if (AEPS_TYPES.includes(txn.type)) {
          try {
            if (txn.type === 'AEPS_WITHDRAWAL') {
              console.log(`CRON: ${await resolveAepsWithdrawal(txn)}`);
            } else if (txn.type === 'AEPS_DEPOSIT') {
              console.log(`CRON: ${await resolveAepsDeposit(txn)}`);
            } else {
              console.log(
                `CRON: Skipping AEPS transaction ${txn.transactionId} (${txn.type}) — no reconciler wired yet.`
              );
            }
          } catch (error) {
            console.error(
              `CRON: AEPS reconciliation failed for ${txn.transactionId}:`,
              error.message
            );
          }
          continue;
        }

        if (txn.type === 'DIRECT_PAYOUT') {
          finalStatus = await verifyPayoutStatus(txn);
        } else {
          // For local-only transactions or unimplemented API checks, default to failed to prevent money lock forever.
          // Ideally, every type should have a verification function.
          finalStatus = 'FAILED';
        }

        if (finalStatus !== 'PROCESSING') {
          console.log(`CRON: Resolving ${txn.transactionId} as ${finalStatus}`);
          // Resolves and safely refunds if FAILED
          await resolveTransaction(
            txn.transactionId,
            finalStatus,
            `Resolved by reconciliation cron. API returned: ${finalStatus}`,
            'MAIN' // Note: Ensure the correct wallet type (MAIN/AEPS) based on txn type in full implementation
          );
        }
      }
    } catch (error) {
      console.error('CRON Error during reconciliation:', error);
    }
  });
};
