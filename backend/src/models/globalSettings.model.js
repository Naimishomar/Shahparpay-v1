import mongoose from "mongoose";

const globalSettingsSchema = new mongoose.Schema({
    aepsCommission: {
        retailerPercentage: {
            type: Number,
            required: true,
            default: 0
        },
        distributorPercentage: {
            type: Number,
            required: true,
            default: 0
        },
        // The total PaySprint API commission is ~0.45%
        // Admin gets the remaining (0.45 - retailer - distributor)
        totalApiPercentage: {
            type: Number,
            required: true,
            default: 0.45
        }
    }
}, { timestamps: true });

const GlobalSettings = mongoose.model("GlobalSettings", globalSettingsSchema);
export default GlobalSettings;
