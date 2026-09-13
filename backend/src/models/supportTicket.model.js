import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel',
    },
    userModel: {
      type: String,
      required: true,
      enum: ['Retailer', 'Distributor'],
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
    adminResponse: {
      type: String,
      default: '',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, default: null, refPath: 'assignedToModel' },
    assignedToModel: { type: String, enum: ['Admin', 'Distributor'], default: 'Admin' },
    messages: {
      type: [{
        senderRole: { type: String, enum: ['user', 'support', 'admin'], required: true },
        senderName: { type: String, default: '' },
        message: { type: String, required: true, trim: true, maxlength: 2000 },
        attachments: [{ url: String, name: String, mimeType: String }],
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
