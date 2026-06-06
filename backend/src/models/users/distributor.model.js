import mongoose from "mongoose";
import bcrypt from "bcrypt";

const distributorSchema = new mongoose.Schema({
    distributorId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        trim: true,
        minLength: [3,'Username must be at least 3 characters long'],
        maxLength: [20,'Username must be at most 20 characters long']
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    contactNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    kyc: {
        panNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
        },
        aadharNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^[2-9]{1}[0-9]{11}$/, 'Please enter a valid Aadhar number']
        },
        gstNumber: {
            type: String,
            unique: true,
            trim: true,
            match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
        },
        businessName: {
            type: String,
            required: true,
        }
    },
    wallet: {
        balance: { 
            type: Number, 
            default: 0 
        }
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    role:{
        type: String,
        default: 'distributor'
    }
}, { timestamps: true });


distributorSchema.pre('save', async function(next) {
    if(!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

const Distributor = mongoose.model("Distributor", distributorSchema);
export default Distributor;