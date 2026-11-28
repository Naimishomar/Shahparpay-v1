import Transaction from '../models/transaction.model.js';
import DmtTransaction from '../models/dmtTransaction.model.js';
import { fetchPayoutStatus } from './icchhamati.util.js';
import { resolveTransaction } from './wallet.util.js';

/**
 * Settles a held Icchhamati payout (DMT or Trade wallet settlement) from the
 * payout listing, the only place Icchhamati publishes where a payout ended up.
 * SUCCESS keeps the debit, FAILED refunds it; anything else leaves the funds
 * held for the next check. Safe to call twice: resolveTransaction only moves a
 * PROCESSING row.
 */
export const reconcileIcchhamatiPayout = async (txn) => {
  // The listing is keyed by Icchhamati's own id (MVTXN...), returned as
  // data.transaction_id when the payout is accepted; our SETTLE/DMT reference
  // is not searchable there. Older rows only carry it inside apiResponse.
  const providerId = txn.metadata?.providerTxnId || txn.metadata?.apiResponse?.data?.transaction_id;
  const { finalStatus, data: row } = await fetchPayoutStatus(providerId || txn.metadata?.refid || txn.transactionId);
  if (finalStatus !== 'SUCCESS' && finalStatus !== 'FAILED') return { finalStatus: 'PROCESSING', row };

  if (row?.utr === 'NA') row.utr = null;
  if (row?.utr) await Transaction.updateOne({ _id: txn._id }, { $set: { 'metadata.utr': row.utr } });
  await resolveTransaction(txn.transactionId, finalStatus, row?.message || `Payout ${finalStatus.toLowerCase()}`, 'AEPS');
  if (txn.type === 'DMT') {
    await DmtTransaction.updateOne(
      { transactionId: txn.transactionId },
      { $set: { status: finalStatus, ...(row?.utr ? { apiReference: String(row.utr) } : {}) } }
    );
  }
  return { finalStatus, row };
};
