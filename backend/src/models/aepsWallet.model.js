import mongoose from "mongoose";

const AepsWalletSchema = new mongoose.Schema({
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
    pin:{
        type: Number,
        required: true,
        minLength:[4 , "Pin must be of 4 digits"],
        maxLength:[4 , "Pin must be of 4 digits"]
    }
}, { timestamps: true })

const AepsWallet = mongoose.model("AepsWallet", AepsWalletSchema);
export default AepsWallet