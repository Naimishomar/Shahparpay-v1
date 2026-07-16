import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'userModel'
    },
    userModel: {
        type: String,
        required: true,
        enum: ['Retailer', 'Distributor', 'Admin']
    },
    refid: {
        type: String,
        required: true,
        unique: true
    },
    merchantcode: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    mobile_no: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    product: {
        type: String,
        required: true,
        enum: ['PL', 'BL', 'IL', 'CC', 'SA']
    },
    pincode: {
        type: String
    },
    state: {
        type: String
    },
    executive_status: {
        type: String,
        default: 'PENDING' // Can be updated to APPROVED, REJECTED, NOT_INTERESTED, etc.
    },
    executive_remarks: {
        type: String
    },
    executive_updated_date: {
        type: String
    },
    url: {
        type: String // The PaySprint application URL
    }
}, { timestamps: true });

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
