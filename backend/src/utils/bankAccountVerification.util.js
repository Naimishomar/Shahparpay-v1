import { icchhamatiPost, isOk, providerMessage } from './icchhamati.util.js';

const cleanName = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const nameMatches = (entered, returned) => {
  const left = cleanName(entered);
  const right = cleanName(returned);
  if (!left || !right) return false;
  if (left === right) return true;
  const returnedTokens = new Set(right.split(' '));
  return left.split(' ').every((token) => returnedTokens.has(token));
};

export const verifyBankAccountWithProvider = async ({ name, accountNumber, ifsc }) => {
  const response = await icchhamatiPost('/api/v2/verify/bank-account', {
    accountno: accountNumber,
    ifsccode: ifsc,
  });
  const providerData = response?.data || null;
  const accountMatches = String(providerData?.AccountNumber || '').replace(/\D/g, '') === accountNumber;
  const nameMatch = nameMatches(name, providerData?.AccountName);
  const providerValid =
    isOk(response) &&
    String(providerData?.status || '').toUpperCase() === 'SUCCESS' &&
    String(providerData?.accountStatus || '').toUpperCase() === 'VALID';

  return {
    response,
    providerData,
    accountMatches,
    nameMatch,
    verified: Boolean(providerValid && accountMatches && nameMatch),
    message: providerMessage(response, 'Bank account verification failed.'),
  };
};
