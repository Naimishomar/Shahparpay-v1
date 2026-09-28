import mongoose from 'mongoose';

/**
 * Who did what, for the admin console. Money movement lives in Transaction;
 * this records account-level events: sign-ins, onboarding, edits, service and
 * status changes, password changes and fund-request decisions.
 */
const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // e.g. 'auth.login', 'retailer.create'
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorRole: { type: String, enum: ['admin', 'distributor', 'retailer', 'system'] },
    actorName: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetRole: { type: String, enum: ['admin', 'distributor', 'retailer'] },
    targetName: { type: String },
    summary: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ targetId: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
