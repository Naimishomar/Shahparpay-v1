import mongoose from "mongoose";

const schemeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    serviceType: { 
        type: String,
        enum: ['AEPS', 'ELECTRICITY', 'CREDIT_CARD'],
        required: true
    },
    slabs: [{
        fromAmount: {
            type: Number,
            required: true
        },
        toAmount: {
            type: Number,
            required: true
        },
        charge: { 
            type: Number, 
            required: true, 
            default: 0 
        },
        retailerCommission: { 
            type: Number, 
            required: true, 
            default: 0 
        },
        distributorCommission: { 
            type: Number, 
            required: true, 
            default: 0 
        }
    }]
}, { timestamps: true });

const Scheme = mongoose.model("Scheme", schemeSchema);
export default Scheme;
