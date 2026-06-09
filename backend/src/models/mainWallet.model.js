import mongoose from "mongoose";

const mainWalletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "userModel",
        required: true
    },
    userModel: {
        type: String,
        required: true,
        enum: ['Retailer', 'Distributor']
    },
    balance: {
        type: Number,
        default: 0
    },
}, { timestamps: true })

const MainWallet = mongoose.model("MainWallet", mainWalletSchema);
export default MainWallet