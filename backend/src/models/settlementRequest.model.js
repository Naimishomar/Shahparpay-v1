import mongoose from "mongoose";

const settlementRequestSchema = new mongoose.Schema({
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
    bankAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 100
    },
    status: {
        type: String,
        enum: ['PROCESSING', 'SUCCESS', 'FAILED'],
        default: 'PROCESSING'
    },
    bankRRN: {
        type: String,
        default: null
    },
    remarks: {
        type: String,
        default: ""
    }
}, { timestamps: true });

const SettlementRequest = mongoose.model("SettlementRequest", settlementRequestSchema);
export default SettlementRequest;
