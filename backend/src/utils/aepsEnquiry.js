import Transaction from '../models/transaction.model.js';
import { makeReferenceId } from './icchhamati.util.js';

// Balance enquiry and mini statement move no money; they are recorded at
// ₹0 so the retailer's AEPS report shows every customer visit.
export const ENQUIRY_TYPES = ['AEPS_BALANCE_ENQUIRY', 'AEPS_MINI_STATEMENT'];

/**
 * Records one enquiry, whatever its outcome. Never throws: the customer has
 * already been served, and a failed write must not turn that into an error.
 */
export const recordAepsEnquiry = async ({ userId, kind, ok, message, metadata }) => {
  try {
    const raw = metadata?.bankBalance;
    const balance = raw === '' || raw == null ? NaN : Number(raw);
    return await Transaction.create({
      transactionId: makeReferenceId(kind === 'MS' ? 'AMS' : 'ABE'),
      userId,
      type: kind === 'MS' ? 'AEPS_MINI_STATEMENT' : 'AEPS_BALANCE_ENQUIRY',
      amount: 0,
      status: ok ? 'SUCCESS' : 'FAILED',
      metadata: {
        ...metadata,
        bankBalance: Number.isFinite(balance) ? balance : undefined,
        gatewayMessage: message,
      },
    });
  } catch (error) {
    console.error('AEPS enquiry record error:', error.message);
    return null;
  }
};
