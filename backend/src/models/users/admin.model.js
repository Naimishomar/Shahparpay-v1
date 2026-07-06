import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
    adminId:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minLength:[3,'Name must be at least 3 characters long']
    },
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
    isActive:{
        type: Boolean,
        default: true
    },
    role:{
        type: String,
        default: 'admin'
    },
    profilePicture: { 
        type: String, 
        default: null 
    },
    distributors:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Distributor'
    }],
    bank:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount'
    },
    
},{timestamps:true})

adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    // next() is optional/handled by promise resolution in newer mongoose when using async
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;