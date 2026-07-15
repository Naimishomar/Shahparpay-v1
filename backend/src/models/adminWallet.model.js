import mongoose from "mongoose";

const adminWalletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const AdminWallet = mongoose.model("AdminWallet", adminWalletSchema);
export default AdminWallet;
