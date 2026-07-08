import mongoose from "mongoose";
import bcrypt from "bcrypt";

const distributorSchema = new mongoose.Schema({
    distributorId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minLength:[3,'Name must be at least 3 characters long']
    },
    prefix: { type: String, default: 'Mr' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String },
    
    // Packages
    dmtPackage: { type: String },
    rechargePackage: { type: String },
    aepsPackage: { type: String },
    bbpsPackage: { type: String },
    payoutPackage: { type: String },
    cmsPackage: { type: String },
    ccpayPackage: { type: String },
    payinPackage: { type: String },
    upiPackage: { type: String },

    // Branding / Info
    website: { type: String },
    brandName: { type: String },
    companyRegisterName: { type: String },
    supportEmail: { type: String },
    supportMobile: { type: String },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
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
    address: {
        city: { type: String, required: true },
        landmark: { type: String },
        district: { type: String, required: true },
        state: { type: String, required: true },
    },
    businessName: { type: String, required: true },
    businessAddress: { type: String, required: true },
    aadhaarNumber: { 
        type: String, 
        required: true, 
        unique: true,
        match: [/^[2-9]{1}[0-9]{11}$/, 'Please enter a valid Aadhar number']
    },
    aadhaarPicture: { type: String, required: true }, // Cloudinary URL
    panNumber: { 
        type: String, 
        required: true, 
        unique: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    panPicture: { type: String, required: true }, // Cloudinary URL
    hasGst: { type: Boolean, default: false },
    gstNumber: { type: String },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isMerchantKycComplete: {
        type: Boolean,
        default: false
    },
    role:{
        type: String,
        default: 'distributor'
    },
    profilePicture: { 
        type: String, 
        default: null 
    },
    retailers:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Retailer'
    }],
    bank:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount'
    },
}, { timestamps: true });


distributorSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

const Distributor = mongoose.model("Distributor", distributorSchema);
export default Distributor;