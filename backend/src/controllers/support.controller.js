import SupportTicket from '../models/supportTicket.model.js';
import Retailer from '../models/users/retailer.model.js';
import { uploadOnR2 } from '../utils/r2.js';

const isAdmin = (req) => req.user?.role === 'admin';
const userModelFor = (role) => role === 'retailer' ? 'Retailer' : 'Distributor';
const ownerFilter = (req) => ({ userId: req.user._id || req.user.id, userModel: userModelFor(req.user.role) });
const populateOwner = (query) => query.populate('userId', 'name firstName lastName retailerId distributorId contactNumber businessName');
const attachmentFromRequest = async (req) => {
  if (!req.file) return [];
  const uploaded = await uploadOnR2(req.file.path);
  return uploaded?.url ? [{ url: uploaded.url, name: req.file.originalname, mimeType: req.file.mimetype }] : [];
};
const assignedForUser = async (req, recipient = 'distributor') => {
  if (recipient === 'admin') return { assignedToModel: 'Admin' };
  if (req.user.role === 'retailer') {
    const retailer = await Retailer.findById(req.user._id || req.user.id).select('distributorId');
    return retailer?.distributorId ? { assignedTo: retailer.distributorId, assignedToModel: 'Distributor' } : {};
  }
  return { assignedToModel: 'Admin' };
};

export const listTickets = async (req, res) => {
  try {
    let query = isAdmin(req) ? {} : ownerFilter(req);
    if (req.user.role === 'distributor') {
      query = { $or: [ownerFilter(req), { assignedTo: req.user._id || req.user.id, assignedToModel: 'Distributor' }] };
    }
    const tickets = await populateOwner(SupportTicket.find(query).sort({ updatedAt: -1 }).limit(100)).lean();
    return res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('List support tickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load support tickets' });
  }
};

export const createTicket = async (req, res) => {
  try {
    if (!['retailer', 'distributor'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Only retailers and distributors can create tickets' });
    const subject = String(req.body.subject || '').trim();
    const description = String(req.body.description || '').trim();
    const attachments = await attachmentFromRequest(req);
    if (!subject || (!description && !attachments.length)) return res.status(400).json({ success: false, message: 'Add a subject and message or photo' });
    const recipient = req.user.role === 'retailer' && req.body.recipient === 'admin' ? 'admin' : 'distributor';
    const ticket = await SupportTicket.create({ ...ownerFilter(req), ...(await assignedForUser(req, recipient)), subject, description: description || 'Photo attachment', messages: [{ senderRole: 'user', senderName: req.user.name || '', message: description || 'Photo attachment', attachments }] });
    return res.status(201).json({ success: true, message: 'Support ticket created', data: ticket });
  } catch (error) {
    console.error('Create support ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create support ticket' });
  }
};

const findVisibleTicket = async (req) => {
  if (isAdmin(req)) return SupportTicket.findById(req.params.id);
  if (req.user.role === 'distributor') return SupportTicket.findOne({ _id: req.params.id, $or: [ownerFilter(req), { assignedTo: req.user._id || req.user.id, assignedToModel: 'Distributor' }] });
  return SupportTicket.findOne({ _id: req.params.id, ...ownerFilter(req) });
};

export const addTicketMessage = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const ticket = await findVisibleTicket(req);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    if (['RESOLVED', 'CLOSED'].includes(ticket.status) && !isAdmin(req)) return res.status(400).json({ success: false, message: 'This ticket is closed. Create a new ticket for more help.' });
    const attachments = await attachmentFromRequest(req);
    if (!message && !attachments.length) return res.status(400).json({ success: false, message: 'Add a message or photo' });
    ticket.messages.push({ senderRole: isAdmin(req) ? 'admin' : req.user.role === 'distributor' ? 'support' : 'user', senderName: req.user.name || '', message: message || 'Photo attachment', attachments });
    if (isAdmin(req)) { ticket.adminResponse = message; ticket.status = 'IN_PROGRESS'; }
    await ticket.save();
    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Add support message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send support message' });
  }
};

export const updateTicket = async (req, res) => {
  try {
    if (!isAdmin(req) && req.user.role !== 'distributor') return res.status(403).json({ success: false, message: 'Support access required' });
    const status = String(req.body.status || '').toUpperCase();
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid ticket status' });
    const visibleTicket = await findVisibleTicket(req);
    if (!visibleTicket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    visibleTicket.status = status;
    await visibleTicket.save();
    const ticket = visibleTicket;
    return res.json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update support ticket' });
  }
};
