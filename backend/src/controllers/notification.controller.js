import Notification from '../models/notification.model.js';

const isAdmin = (req) => req.user?.role === 'admin';
const userKey = (req) => `${req.user.role}:${req.user._id || req.user.id}`;
const activeQuery = (role) => ({
  active: true,
  ...(role === 'admin' ? {} : { targetRoles: role }),
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const listNotifications = async (req, res) => {
  try {
    const rows = await Notification.find(activeQuery(req.user.role)).sort({ createdAt: -1 }).limit(50).lean();
    const key = userKey(req);
    return res.json({
      success: true,
      data: rows.map((row) => ({ ...row, isRead: row.readBy?.includes(key) || false })),
      unreadCount: rows.filter((row) => !row.readBy?.includes(key)).length,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

export const listTickerUpdates = async (req, res) => {
  try {
    const rows = await Notification.find({ ...activeQuery(req.user.role), showInTicker: true })
      .sort({ createdAt: -1 }).limit(20).select('title message kind createdAt').lean();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('List ticker updates error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load latest updates' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    await Notification.updateOne({ _id: req.params.id }, { $addToSet: { readBy: userKey(req) } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};

export const createNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin access required' });
    const { title, message, kind, showInTicker, expiresAt } = req.body;
    if (!String(title || '').trim() || !String(message || '').trim()) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }
    const notification = await Notification.create({
      title: String(title).trim(),
      message: String(message).trim(),
      kind: ['info', 'success', 'warning', 'urgent'].includes(kind) ? kind : 'info',
      showInTicker: Boolean(showInTicker),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id || req.user.id,
    });
    return res.status(201).json({ success: true, message: 'Notification published', data: notification });
  } catch (error) {
    console.error('Create notification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish notification' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Admin access required' });
    await Notification.findByIdAndUpdate(req.params.id, { active: false });
    return res.json({ success: true, message: 'Notification archived' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to archive notification' });
  }
};
