import mongoose from 'mongoose';

const qrWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'userModel',
      required: true,
      unique: true,
    },
    userModel: {
      type: String,
      required: true,
      enum: ['Retailer', 'Distributor'],
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const QrWallet = mongoose.model('QrWallet', qrWalletSchema);
export default QrWallet;
