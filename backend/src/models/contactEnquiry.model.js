import mongoose from 'mongoose';

/**
 * An enquiry from the public contact form.
 *
 * Deliberately not a SupportTicket: that model requires a userId pointing at a
 * Retailer or Distributor, and the whole point of this form is that the person
 * filling it in does not have an account yet.
 */
const contactEnquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, maxlength: 15 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 120 },
    city: { type: String, default: '', trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'CLOSED'],
      default: 'NEW',
    },
    // Kept for abuse investigation only; never shown back to the submitter.
    sourceIp: { type: String, default: '' },
  },
  { timestamps: true }
);

// The admin list is "newest first", and the abuse check counts recent rows per
// mobile number, so both reads are covered here.
contactEnquirySchema.index({ createdAt: -1 });
contactEnquirySchema.index({ mobile: 1, createdAt: -1 });

export default mongoose.model('ContactEnquiry', contactEnquirySchema);
