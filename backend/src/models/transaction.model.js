import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        required: true
    }, // Bank Txn ID
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Retailer', 
        required: true 
    }, // Retailer who did it
    type: { 
        type: String, 
        enum: ['AEPS_WITHDRAWAL', 'BILL_PAYMENT', 'WALLET_TOPUP', 'RECHARGE', 'AEPSTOMAIN', 'AEPS_SETTLEMENT', 'DMT'], 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    commissions: {
        chargeDeducted: { 
            type: Number, 
            default: 0 
        },
        retailerEarned: { 
            type: Number, 
            default: 0 
        },
        distributorEarned: { 
            type: Number, 
            default: 0 
        }
    },
    status: { 
        type: String, 
        enum: ['PENDING', 'SUCCESS', 'FAILED'], 
        default: 'PENDING' 
    },
    metadata: { 
        type: mongoose.Schema.Types.Mixed 
    } // Stores dynamic data like Aadhaar ending, Bill numbers
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;