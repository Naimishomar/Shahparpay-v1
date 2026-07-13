import cron from 'node-cron';
import Transaction from '../models/transaction.model.js';
import { resolveTransaction } from '../utils/wallet.util.js';
import axios from 'axios';
import crypto from 'crypto';
import { generatePaySprintToken } from '../utils/paysprint.util.js';

/**
 * PaySprint header generator helper
 */
const getPaySprintHeaders = () => {
    return {
        'Token': generatePaySprintToken(),
        'Authorisedkey': process.env.PAYSPRINT_AUTHORISED_KEY,
        'Content-Type': 'application/json'
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
        const response = await axios.post(`${baseUrl}/service/payout/payout/status`, {
            reference_id: transaction.transactionId
        }, { headers: getPaySprintHeaders() });

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
 * The main Reconciliation Job
 * Runs every 5 minutes
 */
export const startReconciliationWorker = () => {
    console.log("CRON: Transaction Reconciliation Worker started.");
    
    cron.schedule('*/5 * * * *', async () => {
        console.log("CRON: Running pending transactions check...");
        
        try {
            // Find transactions stuck in PROCESSING for more than 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const stuckTransactions = await Transaction.find({
                status: 'PROCESSING',
                createdAt: { $lt: fiveMinutesAgo }
            });

            if (stuckTransactions.length === 0) {
                return;
            }

            console.log(`CRON: Found ${stuckTransactions.length} stuck transaction(s). Resolving...`);

            for (const txn of stuckTransactions) {
                let finalStatus = 'PROCESSING';

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
            console.error("CRON Error during reconciliation:", error);
        }
    });
};
