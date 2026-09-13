import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    kind: { type: String, enum: ['info', 'success', 'warning', 'urgent'], default: 'info' },
    targetRoles: {
      type: [{ type: String, enum: ['retailer', 'distributor', 'admin'] }],
      default: ['retailer', 'distributor'],
    },
    showInTicker: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    readBy: { type: [String], default: [] },
  },
  { timestamps: true }
);

notificationSchema.index({ active: 1, createdAt: -1 });
notificationSchema.index({ showInTicker: 1, active: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
