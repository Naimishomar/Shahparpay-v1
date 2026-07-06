import mongoose from "mongoose";

const fundRequestSchema = new mongoose.Schema({
    requestType: {
        type: String,
        enum: ['RETAILER', 'DISTRIBUTOR'],
        required: true
    },
    retailerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Retailer',
        required: function() { return this.requestType === 'RETAILER'; }
    },
    distributorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Distributor',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: function() { return this.requestType === 'DISTRIBUTOR'; }
    },
    transactionMode: {
        type: String,
        required: true,
        enum: ['IMPS', 'NEFT', 'RTGS', 'UPI', 'Cash Deposit', 'Cheque']
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    bankUtr: {
        type: String,
        required: true,
        trim: true
    },
    depositDate: {
        type: Date,
        required: true
    },
    depositSlipUrl: {
        type: String
    },
    remarks: {
        type: String,
        trim: true
    },
    adminRemarks: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    }
}, { timestamps: true });

// Prevent duplicate UTRs
fundRequestSchema.index({ bankUtr: 1 }, { unique: true });

const FundRequest = mongoose.model("FundRequest", fundRequestSchema);
export default FundRequest;
