import mongoose from "mongoose";

const dmtTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    retailerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Retailer",
        required: true
    },
    remitterMobile: {
        type: String,
        required: true
    },
    beneficiaryAccount: {
        type: String,
        required: true
    },
    beneficiaryIfsc: {
        type: String,
        required: true
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
    apiReference: {
        type: String,
        default: null
    },
    apiResponse: {
        type: Object,
        default: {}
    }
}, { timestamps: true });

const DmtTransaction = mongoose.model("DmtTransaction", dmtTransactionSchema);
export default DmtTransaction;
