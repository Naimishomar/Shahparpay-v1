import SupportTicket from '../models/supportTicket.model.js';

const isAdmin = (req) => req.user?.role === 'admin';
const userModelFor = (role) => role === 'retailer' ? 'Retailer' : 'Distributor';
const ownerFilter = (req) => ({ userId: req.user._id || req.user.id, userModel: userModelFor(req.user.role) });
const populateOwner = (query) => query.populate('userId', 'name firstName lastName retailerId distributorId contactNumber businessName');

export const listTickets = async (req, res) => {
  try {
    const query = isAdmin(req) ? {} : ownerFilter(req);
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
    if (!subject || !description) return res.status(400).json({ success: false, message: 'Subject and description are required' });
    const ticket = await SupportTicket.create({ ...ownerFilter(req), subject, description, messages: [{ senderRole: 'user', senderName: req.user.name || '', message: description }] });
    return res.status(201).json({ success: true, message: 'Support ticket created', data: ticket });
  } catch (error) {
    console.error('Create support ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create support ticket' });
  }
};

const findVisibleTicket = async (req) => isAdmin(req)
  ? SupportTicket.findById(req.params.id)
  : SupportTicket.findOne({ _id: req.params.id, ...ownerFilter(req) });

export const addTicketMessage = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const ticket = await findVisibleTicket(req);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    if (['RESOLVED', 'CLOSED'].includes(ticket.status) && !isAdmin(req)) return res.status(400).json({ success: false, message: 'This ticket is closed. Create a new ticket for more help.' });
    ticket.messages.push({ senderRole: isAdmin(req) ? 'admin' : 'user', senderName: req.user.name || '', message });
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
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin access required' });
    const status = String(req.body.status || '').toUpperCase();
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid ticket status' });
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    return res.json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update support ticket' });
  }
};
