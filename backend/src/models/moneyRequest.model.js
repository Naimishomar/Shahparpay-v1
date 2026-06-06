import mongoose from "mongoose";

const moneyRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'userModel'
    },
    userModel: {
        type: String,
        required: true,
        enum: ['Retailer', 'Distributor']
    },
    paymentMode: {
        type: String,
        required: true,
        enum: ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH_DEPOSIT', 'OTHER']
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    paymentDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    receiptImage: {
        type: String,
        required: true
    },
    remarks: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    adminRemarks: {
        type: String,
        default: ""
    }
}, { timestamps: true });

const MoneyRequest = mongoose.model("MoneyRequest", moneyRequestSchema);
export default MoneyRequest;
