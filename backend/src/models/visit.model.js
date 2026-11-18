import mongoose from 'mongoose';

/**
 * One page view on the public site or portal, for the admin's visitor stats.
 * `vid` is a daily-rotating hash of IP + user agent: counts unique visitors per
 * day without storing the IP or setting a cookie.
 */
const visitSchema = new mongoose.Schema(
  {
    day: { type: String, required: true }, // YYYY-MM-DD, IST
    vid: { type: String, required: true },
    path: { type: String, required: true },
    ref: { type: String }, // referring host, external only
    device: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    country: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

visitSchema.index({ day: 1 });
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });

const Visit = mongoose.models.Visit || mongoose.model('Visit', visitSchema);
export default Visit;
