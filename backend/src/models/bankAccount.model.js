import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema({
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
    accountHolderName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    ifscCode: {
        type: String,
        required: true,
        trim: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code']
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'REJECTED'],
        default: 'PENDING'
    },
    balance:{
        type: Number,
        default: 0
    },
    beneId: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const BankAccount = mongoose.model("BankAccount", bankAccountSchema);
export default BankAccount;
