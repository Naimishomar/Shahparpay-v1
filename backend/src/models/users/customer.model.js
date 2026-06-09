import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    username:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    phone: {
        type: Number,
        required: true,
        trim: true,
        unique: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    zip: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    bankAccount:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "BankAccount"
    },
    aadharCard:{
        type: String,
        required: true,
        unique: true
    },
    panCard:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    role:{
        type: String,
        default: 'customer'
    },
    bank:{
        type: mongoose.ObjectId.Schema.ObjectId,
        ref: 'BankAccount'
    }
}, {timestamps: true})

const Customer = mongoose.model("Customer", customerSchema);
export default Customer