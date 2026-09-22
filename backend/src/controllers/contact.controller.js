import ContactEnquiry from '../models/contactEnquiry.model.js';
import { sendContactEnquiryEmail } from '../utils/email.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Anyone on the internet can post here and every accepted post sends mail, so
// the same number cannot flood the inbox. Counted in the database rather than in
// memory because the container restarts on every deploy and an in-process
// counter would reset with it.
const MAX_PER_MOBILE_PER_HOUR = 3;

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/** Validates and records a public contact-form enquiry. */
export const submitEnquiry = async (req, res) => {
  try {
    const name = clean(req.body?.name, 100);
    const mobile = clean(req.body?.mobile, 15).replace(/\D/g, '');
    const email = clean(req.body?.email, 120).toLowerCase();
    const city = clean(req.body?.city, 100);
    const message = clean(req.body?.message, 2000);

    if (name.length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter your name.' });
    }
    if (!MOBILE_RE.test(mobile)) {
      return res
        .status(400)
        .json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (message.length < 10) {
      return res
        .status(400)
        .json({ success: false, message: 'Please tell us a little more — at least 10 characters.' });
    }

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await ContactEnquiry.countDocuments({ mobile, createdAt: { $gte: anHourAgo } });
    if (recent >= MAX_PER_MOBILE_PER_HOUR) {
      return res.status(429).json({
        success: false,
        message: 'We already have your enquiry. Our team will call you shortly.',
      });
    }

    const enquiry = await ContactEnquiry.create({
      name,
      mobile,
      email,
      city,
      message,
      sourceIp: req.ip || '',
    });

    // Stored first, notified second: a mail failure must not cost us the enquiry
    // or show the submitter an error for something already safely recorded.
    sendContactEnquiryEmail(enquiry).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Thanks — we have your details and will get back to you shortly.',
    });
  } catch (error) {
    console.error('[Contact] submitEnquiry failed:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Could not send your message. Please try again.' });
  }
};

/** Admin-only list of enquiries, newest first. */
export const listEnquiries = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = req.query.status ? { status: req.query.status } : {};

    const [items, total] = await Promise.all([
      ContactEnquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ContactEnquiry.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, data: items, total, page, limit });
  } catch (error) {
    console.error('[Contact] listEnquiries failed:', error);
    return res.status(500).json({ success: false, message: 'Could not load enquiries.' });
  }
};

/** Admin-only status change, so answered enquiries stop showing as new. */
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['NEW', 'CONTACTED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status.' });
    }

    const updated = await ContactEnquiry.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('[Contact] updateEnquiryStatus failed:', error);
    return res.status(500).json({ success: false, message: 'Could not update the enquiry.' });
  }
};
