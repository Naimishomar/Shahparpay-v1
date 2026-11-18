import mongoose from 'mongoose';

/** Platform-wide switches the admin flips from the portal, one document per key. */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
export default Setting;
