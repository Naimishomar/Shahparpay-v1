import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // Document will be automatically deleted after 5 minutes (300 seconds)
    }
});

// Avoid recompiling the model if it already exists
const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

export default Otp;
