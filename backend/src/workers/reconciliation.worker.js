import cron from 'node-cron';
import Transaction from '../models/transaction.model.js';
import { resolveTransaction } from '../utils/wallet.util.js';
import { fetchRechargeStatus } from '../utils/icchhamati.util.js';
import { reconcileIcchhamatiPayout } from '../utils/icchhamatiPayout.js';
import { syncCollectionTransaction } from '../controllers/collect.controller.js';

/**
 * The main Reconciliation Job
 * Runs every 5 minutes
 */
/** How long an unpaid payment link is still asked about. */
const COLLECTION_WATCH_MS = 24 * 60 * 60 * 1000;

export const startReconciliationWorker = () => {
  console.log('CRON: Transaction Reconciliation Worker started.');

  cron.schedule('*/5 * * * *', async () => {
    console.log('CRON: Running pending transactions check...');

    try {
      // Find transactions stuck in PROCESSING for more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Payment links sit in PENDING, not PROCESSING, until the gateway
      // confirms — without the second clause the PG_COLLECTION branch below
      // never runs and a paid link is only credited when the retailer reopens
      // the Collect page.
      //
      // Most payment links are simply never paid, and each one costs a provider
      // call per pass, so they are watched on a back-off: every pass for the
      // first hour, then once an hour (the top-of-hour pass) for a day, then
      // never. A link paid later still settles when the retailer opens Collect.
      const topOfHour = new Date().getMinutes() < 5;
      const collectionWindow = new Date(Date.now() - (topOfHour ? COLLECTION_WATCH_MS : 60 * 60 * 1000));
      const stuckTransactions = await Transaction.find({
        $or: [
          { status: 'PROCESSING' },
          { status: 'PENDING', type: 'PG_COLLECTION', createdAt: { $gt: collectionWindow } },
        ],
        createdAt: { $lt: fiveMinutesAgo },
      });

      if (stuckTransactions.length === 0) {
        return;
      }

      console.log(`CRON: Found ${stuckTransactions.length} stuck transaction(s). Resolving...`);

      for (const txn of stuckTransactions) {
        let finalStatus = 'PROCESSING';

        // AEPS transactions are never auto-FAILED/refunded here: that would
        // refund money the bank may have actually debited. Icchhamati's doAeps
        // takes no client reference to query by, so these wait for an admin.
        const AEPS_TYPES = [
          'AEPS_WITHDRAWAL',
          'AEPS_DEPOSIT',
          'AEPS_DEPOSIT_REFUND',
          'AEPSTOMAIN',
          'AEPS_SETTLEMENT',
        ];

        // Money that has left our wallet on an outward rail with no status
        // endpoint behind it. Auto-failing one of these refunds a retailer for a
        // transfer that may already have landed, so they are never resolved here.
        // An unresolved Aadhaar Pay is an inflow nothing was debited for, so the
        // default's "refund" would hand the retailer money they never paid.
        // A Micro ATM withdrawal the provider did not confirm: the customer's
        // card may have been debited and the cash handed over, so it waits for
        // an admin rather than being "refunded" money that was never debited.
        // DIRECT_PAYOUT (removed service) left nothing pending; any straggler waits too.
        const NO_RECONCILER_TYPES = ['DMT', 'AADHAAR_PAY', 'MATM', 'DIRECT_PAYOUT'];

        // DMT and Trade wallet settlement paid by Icchhamati's /beneficiary-payout:
        // the payout listing is their status. Only a definite SUCCESS / FAILED
        // moves one; a payout the listing still shows pending stays held.
        if (['AEPS_SETTLEMENT', 'DMT'].includes(txn.type) && txn.metadata?.provider === 'ICCHHAMATI') {
          try {
            const { finalStatus: payoutStatus } = await reconcileIcchhamatiPayout(txn);
            if (payoutStatus !== 'PROCESSING') {
              console.log(`CRON: ${txn.type} ${txn.transactionId} resolved as ${payoutStatus}`);
            }
          } catch (error) {
            console.error(`CRON: Payout reconciliation failed for ${txn.transactionId}:`, error.message);
          }
          continue;
        }

        if (AEPS_TYPES.includes(txn.type)) {
          try {
            console.log(
              `CRON: Skipping AEPS transaction ${txn.transactionId} (${txn.type}) — no reconciler wired yet.`
            );
          } catch (error) {
            console.error(
              `CRON: AEPS reconciliation failed for ${txn.transactionId}:`,
              error.message
            );
          }
          continue;
        }

        if (txn.type === 'PG_COLLECTION') {
          // A payment link is only settled while the retailer has the Collect
          // page open — on the gateway's redirect back, or by the poll that runs
          // beside it. Close the tab and a customer's payment was never credited
          // to anyone. /api/pg/verify answers for our own reference id, so it is
          // asked here instead.
          //
          // This is an inflow: nothing is locked and nothing is refunded, so a
          // non-answer costs only another pass. Only a confirmed SUCCESS credits,
          // and it is never auto-FAILED — marking a paid order failed would lose
          // the retailer their money, which falling through to the default below
          // used to risk.
          try {
            const { transaction } = await syncCollectionTransaction(txn);
            console.log(`CRON: Collection ${txn.transactionId} is ${transaction.status}.`);
          } catch (error) {
            console.error(
              `CRON: Collection reconciliation failed for ${txn.transactionId}:`,
              error.message
            );
          }
          continue;
        } else if (txn.type === 'RECHARGE' || txn.type === 'BILL_PAYMENT') {
          // A recharge can sit pending well past five minutes. Falling through to
          // the default below would refund the retailer for a recharge the
          // operator still goes on to deliver, so ask the provider instead.
          const providerTxnId = txn.metadata?.orderId || txn.metadata?.operatorTxnId || txn.transactionId;
          finalStatus = (await fetchRechargeStatus(providerTxnId, txn.metadata?.mode))
            .finalStatus;
        } else if (NO_RECONCILER_TYPES.includes(txn.type)) {
          // The provider publishes no status endpoint for these, and the default
          // below would auto-FAIL them — refunding a retailer for a transfer that
          // has already reached the beneficiary, or for a payment the customer
          // made. They stay PROCESSING until they are settled by hand.
          console.log(
            `CRON: Skipping ${txn.transactionId} (${txn.type}) — no reconciler wired yet.`
          );
          continue;
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
