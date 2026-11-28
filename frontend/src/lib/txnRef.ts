/**
 * The id Icchhamati gave this transaction — the one their portal and support
 * know it by (payout MVTXN…, recharge/BBPS order id, UPI cash withdrawal id).
 * Our own reference where the provider has none (AEPS and PG already use theirs).
 */
export const txnRef = (tx: any): string => {
  const m = tx?.metadata ?? {};
  return String(m.providerTxnId || m.apiResponse?.data?.transaction_id || m.orderId || tx?.transactionId || tx?._id || '');
};
