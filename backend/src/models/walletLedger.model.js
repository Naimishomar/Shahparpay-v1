import mongoose from "mongoose";

const walletLedgerSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        refPath: 'userModel' 
    },
    userModel: { 
        type: String, 
        enum: ['Retailer', 'Distributor'], 
        required: true 
    },
    transactionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Transaction', 
        default: null 
    },
    type: { 
        type: String, 
        enum: ['CREDIT', 'DEBIT'], 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true,
        min: 0.01
    },
    balanceBefore: { 
        type: Number, 
        required: true 
    },
    balanceAfter: { 
        type: Number, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    }
}, { timestamps: true });

const WalletLedger = mongoose.model("WalletLedger", walletLedgerSchema);
export default WalletLedger;
