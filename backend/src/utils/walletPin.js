import bcrypt from 'bcrypt';
import AepsWallet from '../models/aepsWallet.model.js';

export const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

/**
 * Checks a transaction PIN with a lockout: five wrong PINs lock the wallet's
 * PIN for 30 minutes. Returns null when the PIN is correct, otherwise
 * { status, message } ready to send.
 */
export const checkWalletPin = async (wallet, pin) => {
  if (!wallet || !wallet.pin) return { status: 400, message: 'Please set your wallet PIN first.' };
  if (wallet.pinLockedUntil && wallet.pinLockedUntil > new Date()) {
    return { status: 423, message: 'Too many wrong PIN attempts. Try again after 30 minutes.' };
  }
  if (await bcrypt.compare(String(pin ?? ''), wallet.pin)) {
    if (wallet.pinFailedAttempts) {
      await AepsWallet.updateOne({ _id: wallet._id }, { $set: { pinFailedAttempts: 0, pinLockedUntil: null } });
    }
    return null;
  }
  const updated = await AepsWallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { pinFailedAttempts: 1 } },
    { new: true }
  );
  if (updated.pinFailedAttempts >= MAX_PIN_ATTEMPTS) {
    await AepsWallet.updateOne(
      { _id: wallet._id },
      { $set: { pinFailedAttempts: 0, pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } }
    );
    return { status: 423, message: 'Too many wrong PIN attempts. Try again after 30 minutes.' };
  }
  return { status: 401, message: `Incorrect PIN. ${MAX_PIN_ATTEMPTS - updated.pinFailedAttempts} attempts left.` };
}
