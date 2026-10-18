import mongoose from 'mongoose';

const AepsWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'userModel',
      required: true,
    },
    userModel: {
      type: String,
      required: true,
      enum: ['Retailer', 'Distributor'],
    },
    balance: {
      type: Number,
      default: 0,
    },
    pin: {
      type: String,
      default: null,
    },
    // Wrong-PIN lockout: a 4-digit PIN is only 10,000 guesses without it.
    pinFailedAttempts: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

const AepsWallet = mongoose.model('AepsWallet', AepsWalletSchema);
export default AepsWallet;
