import mongoose from "mongoose";

const moneyTransferSchema = new mongoose.Schema({
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
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    },
    
});

const MoneyTransfer = mongoose.model("MoneyTransfer", moneyTransferSchema);
export default MoneyTransfer