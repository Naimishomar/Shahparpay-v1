import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const adminSchema = new mongoose.Schema({
    adminId:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    username:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength:[3,'Username must be at least 3 characters long'],
        maxLength:[20,'Username must be at most 20 characters long']
    },
    email:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    contactNumber:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password:{
        type: String,
        required: true,
        trim: true,
        match: [/^[a-zA-Z0-9]{3,30}$/, 'Password must be 3-30 alphanumeric characters']
    },
    isActive:{
        type: Boolean,
        default: true
    },
    role:{
        type: String,
        default: 'admin'
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
    next();
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;