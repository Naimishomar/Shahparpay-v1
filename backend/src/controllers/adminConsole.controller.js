import mongoose from 'mongoose';
import Retailer from '../models/users/retailer.model.js';
import Distributor from '../models/users/distributor.model.js';
import Transaction from '../models/transaction.model.js';
import MainWallet from '../models/mainWallet.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import AdminWallet from '../models/adminWallet.model.js';
import FundRequest from '../models/fundRequest.model.js';
import SupportTicket from '../models/supportTicket.model.js';
import ActivityLog from '../models/activityLog.model.js';
import { SERVICE_TYPES, ALLOWED_DAYS, windowFor } from './distributorAnalytics.controller.js';
import { parseDisabledServices } from '../utils/services.js';
import { logActivity } from '../utils/activity.js';

const TZ = 'Asia/Kolkata';
const MODELS = { retailer: Retailer, distributor: Distributor };

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** YYYY-MM-DD only; anything else is ignored rather than crashing the query. */
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const parseDays = (v) => (ALLOWED_DAYS.includes(Number(v)) ? Number(v) : 30);
const page = (q) => {
  const limit = Math.min(Math.max(Number(q.limit) || 25, 1), 1000);
  const pageNo = Math.max(Number(q.page) || 1, 1);
  return { limit, pageNo, skip: (pageNo - 1) * limit };
};
const forbid = (req, res) => {
  if (req.user.role === 'admin') return false;
  res.status(403).json({ success: false, message: 'Unauthorized access' });
  return true;
};

const moneySums = {
  volume: { $sum: '$amount' },
  count: { $sum: 1 },
  adminEarned: { $sum: { $ifNull: ['$commissions.adminEarned', 0] } },
  distributorEarned: { $sum: { $ifNull: ['$commissions.distributorEarned', 0] } },
  retailerEarned: { $sum: { $ifNull: ['$commissions.retailerEarned', 0] } },
};
const pickMoney = (row) => ({
  volume: round2(row?.volume),
  count: row?.count || 0,
  adminEarned: round2(row?.adminEarned),
  distributorEarned: round2(row?.distributorEarned),
  retailerEarned: round2(row?.retailerEarned),
});

const walletTotals = async (Model, userModel) => {
  const [row] = await Model.aggregate([
    ...(userModel ? [{ $match: { userModel } }] : []),
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  return round2(row?.total);
};

/**
 * GET /api/admin/console/overview?days=7|30|90
 * Platform-wide health: money, success rate, growth, queues and leaders.
 */
export const getOverview = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const days = parseDays(req.query.days);
    const { since, prevSince, labels } = windowFor(days);
    const service = { type: { $in: SERVICE_TYPES } };

    const [facet] = await Transaction.aggregate([
      { $match: { ...service, createdAt: { $gte: prevSince } } },
      {
        $facet: {
          current: [
            { $match: { createdAt: { $gte: since }, status: 'SUCCESS' } },
            { $group: { _id: null, ...moneySums, active: { $addToSet: '$userId' } } },
          ],
          previous: [
            { $match: { createdAt: { $lt: since }, status: 'SUCCESS' } },
            { $group: { _id: null, ...moneySums } },
          ],
          byStatus: [
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: '$status', count: { $sum: 1 }, volume: { $sum: '$amount' } } },
          ],
          trend: [
            { $match: { createdAt: { $gte: since }, status: 'SUCCESS' } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
                ...moneySums,
              },
            },
          ],
          byService: [
            { $match: { createdAt: { $gte: since }, status: 'SUCCESS' } },
            { $group: { _id: '$type', ...moneySums } },
            { $sort: { volume: -1 } },
          ],
          topRetailers: [
            { $match: { createdAt: { $gte: since }, status: 'SUCCESS' } },
            { $group: { _id: '$userId', ...moneySums } },
            { $sort: { volume: -1 } },
            { $limit: 8 },
            { $lookup: { from: 'retailers', localField: '_id', foreignField: '_id', as: 'r' } },
            { $unwind: '$r' },
            { $project: { volume: 1, count: 1, adminEarned: 1, name: '$r.name', retailerId: '$r.retailerId', distributorId: '$r.distributorId' } },
          ],
          topDistributors: [
            { $match: { createdAt: { $gte: since }, status: 'SUCCESS' } },
            { $lookup: { from: 'retailers', localField: 'userId', foreignField: '_id', as: 'r' } },
            { $unwind: '$r' },
            { $group: { _id: '$r.distributorId', ...moneySums, retailers: { $addToSet: '$userId' } } },
            { $sort: { volume: -1 } },
            { $limit: 8 },
            { $lookup: { from: 'distributors', localField: '_id', foreignField: '_id', as: 'd' } },
            { $unwind: '$d' },
            {
              $project: {
                volume: 1, count: 1, distributorEarned: 1,
                activeRetailers: { $size: '$retailers' },
                name: '$d.name', distributorId: '$d.distributorId',
              },
            },
          ],
        },
      },
    ]);

    const [
      retailers, distributors, newRetailers, newDistributors, kycPending, inactiveRetailers, inactiveDistributors,
      pendingRetailerFunds, pendingDistributorFunds, openTickets, mainFloat, aepsFloat, adminWallet,
    ] = await Promise.all([
      Retailer.countDocuments(),
      Distributor.countDocuments(),
      Retailer.countDocuments({ createdAt: { $gte: since } }),
      Distributor.countDocuments({ createdAt: { $gte: since } }),
      Retailer.countDocuments({ isMerchantKycComplete: { $ne: true } }),
      Retailer.countDocuments({ isActive: false }),
      Distributor.countDocuments({ isActive: false }),
      FundRequest.countDocuments({ status: 'PENDING', requestType: 'RETAILER' }),
      FundRequest.countDocuments({ status: 'PENDING', requestType: 'DISTRIBUTOR' }),
      SupportTicket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
      walletTotals(MainWallet),
      walletTotals(AepsWallet),
      AdminWallet.findOne({ userId: req.user.id }).lean(),
    ]);

    const trendByDay = new Map(facet.trend.map((r) => [r._id, r]));
    const statuses = Object.fromEntries(facet.byStatus.map((r) => [r._id, { count: r.count, volume: round2(r.volume) }]));
    const attempted = facet.byStatus.reduce((n, r) => n + r.count, 0);

    return res.status(200).json({
      success: true,
      data: {
        days,
        totals: { ...pickMoney(facet.current[0]), activeRetailers: facet.current[0]?.active?.length || 0 },
        previous: pickMoney(facet.previous[0]),
        statuses,
        successRate: attempted ? round2(((statuses.SUCCESS?.count || 0) / attempted) * 100) : null,
        trend: labels.map((date) => ({ date, ...pickMoney(trendByDay.get(date)) })),
        byService: facet.byService.map((r) => ({ type: r._id, ...pickMoney(r) })),
        topRetailers: facet.topRetailers.map((r) => ({ ...r, volume: round2(r.volume), adminEarned: round2(r.adminEarned) })),
        topDistributors: facet.topDistributors.map((d) => ({ ...d, volume: round2(d.volume), distributorEarned: round2(d.distributorEarned) })),
        users: {
          retailers, distributors, newRetailers, newDistributors, kycPending,
          inactive: inactiveRetailers + inactiveDistributors,
        },
        queues: { pendingRetailerFunds, pendingDistributorFunds, openTickets },
        wallets: { mainFloat, aepsFloat, adminBalance: round2(adminWallet?.balance) },
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** Transaction filter shared by the explorer list and its totals. */
const transactionMatch = async (q) => {
  const match = {};
  if (q.type) match.type = { $in: String(q.type).split(',') };
  if (q.status) match.status = { $in: String(q.status).split(',') };
  if (isDay(q.from) || isDay(q.to)) {
    match.createdAt = {};
    if (isDay(q.from)) match.createdAt.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (isDay(q.to)) match.createdAt.$lte = new Date(`${q.to}T23:59:59.999+05:30`);
  }

  let userIds = null;
  if (q.retailer && mongoose.isValidObjectId(q.retailer)) userIds = [new mongoose.Types.ObjectId(q.retailer)];
  if (q.distributor && mongoose.isValidObjectId(q.distributor)) {
    const ids = await Retailer.find({ distributorId: q.distributor }).distinct('_id');
    userIds = userIds ? userIds.filter((id) => ids.some((x) => x.equals(id))) : ids;
  }
  if (userIds) match.userId = { $in: userIds };

  const term = String(q.q || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const people = await Retailer.find({ $or: [{ name: rx }, { retailerId: rx }, { businessName: rx }, { contactNumber: rx }] }).distinct('_id');
    match.$or = [{ transactionId: rx }, { 'metadata.utr': rx }, { userId: { $in: people } }];
  }
  return match;
};

/**
 * GET /api/admin/console/transactions
 *   ?page&limit&type&status&from&to (YYYY-MM-DD, IST)&q&retailer&distributor
 */
export const getTransactions = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const { limit, pageNo, skip } = page(req.query);
    const match = await transactionMatch(req.query);

    const [rows, [totals]] = await Promise.all([
      Transaction.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'userId', select: 'name retailerId businessName distributorId', populate: { path: 'distributorId', select: 'name distributorId' } })
        .lean(),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
            success: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
            adminEarned: { $sum: { $ifNull: ['$commissions.adminEarned', 0] } },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        rows,
        page: pageNo,
        limit,
        total: totals?.count || 0,
        summary: {
          volume: round2(totals?.volume),
          success: totals?.success || 0,
          failed: totals?.failed || 0,
          adminEarned: round2(totals?.adminEarned),
        },
      },
    });
  } catch (error) {
    console.error('Admin transactions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const lastLogins = async (ids) => {
  const rows = await ActivityLog.aggregate([
    { $match: { actorId: { $in: ids }, action: 'auth.login' } },
    { $group: { _id: '$actorId', at: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.at]));
};

const balances = async (ids) => {
  const [main, aeps] = await Promise.all([
    MainWallet.find({ userId: { $in: ids } }).select('userId balance').lean(),
    AepsWallet.find({ userId: { $in: ids } }).select('userId balance').lean(),
  ]);
  const map = (list) => new Map(list.map((w) => [String(w.userId), round2(w.balance)]));
  return { main: map(main), aeps: map(aeps) };
};

/**
 * GET /api/admin/console/users?role=retailer|distributor&q&status=active|inactive&kyc=pending|done&distributor&sort=newest|oldest|name&page&limit
 */
export const getUsers = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const role = req.query.role === 'distributor' ? 'distributor' : 'retailer';
    const Model = MODELS[role];
    const { limit, pageNo, skip } = page(req.query);

    const filter = {};
    const term = String(req.query.q || '').trim();
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { contactNumber: rx }, { businessName: rx }, { [role === 'retailer' ? 'retailerId' : 'distributorId']: rx }];
    }
    if (req.query.status === 'active') filter.isActive = { $ne: false };
    if (req.query.status === 'inactive') filter.isActive = false;
    if (role === 'retailer') {
      if (req.query.kyc === 'pending') filter.isMerchantKycComplete = { $ne: true };
      if (req.query.kyc === 'done') filter.isMerchantKycComplete = true;
      if (req.query.distributor && mongoose.isValidObjectId(req.query.distributor)) filter.distributorId = req.query.distributor;
    }
    const sort = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { name: 1 } }[req.query.sort] || { createdAt: -1 };

    const query = Model.find(filter)
      .select('name email contactNumber businessName retailerId distributorId profilePicture isActive isMerchantKycComplete disabledServices createdAt address')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    if (role === 'retailer') query.populate('distributorId', 'name distributorId');
    const [users, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
    const ids = users.map((u) => u._id);

    const [wallets, logins, activity] = await Promise.all([
      balances(ids),
      lastLogins(ids),
      role === 'retailer'
        ? Transaction.aggregate([
            { $match: { userId: { $in: ids }, status: 'SUCCESS', type: { $in: SERVICE_TYPES } } },
            { $group: { _id: '$userId', volume: { $sum: '$amount' }, count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
          ])
        : Retailer.aggregate([
            { $match: { distributorId: { $in: ids } } },
            { $group: { _id: '$distributorId', retailers: { $sum: 1 } } },
          ]),
    ]);
    const extra = new Map(activity.map((r) => [String(r._id), r]));

    return res.status(200).json({
      success: true,
      data: {
        role,
        total,
        page: pageNo,
        limit,
        rows: users.map((u) => {
          const key = String(u._id);
          const x = extra.get(key) || {};
          return {
            ...u,
            mainBalance: wallets.main.get(key) || 0,
            aepsBalance: wallets.aeps.get(key) || 0,
            lastLoginAt: logins.get(key) || null,
            ...(role === 'retailer'
              ? { lifetimeVolume: round2(x.volume), lifetimeCount: x.count || 0, lastTxnAt: x.lastAt || null }
              : { retailerCount: x.retailers || 0 }),
          };
        }),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const parseRoleId = (req, res) => {
  const { role, id } = req.params;
  if (!MODELS[role] || !mongoose.isValidObjectId(id)) {
    res.status(400).json({ success: false, message: 'Invalid user' });
    return null;
  }
  return { role, id, Model: MODELS[role], oid: new mongoose.Types.ObjectId(id) };
};

/** GET /api/admin/console/users/:role/:id — everything about one account. */
export const getUserDetail = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const p = parseRoleId(req, res);
    if (!p) return;

    const query = p.Model.findById(p.id).select('-password');
    if (p.role === 'retailer') query.populate('distributorId', 'name distributorId email contactNumber');
    const user = await query.lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // A distributor's business is its retailers' transactions.
    const network = p.role === 'distributor'
      ? await Retailer.find({ distributorId: p.id })
          .select('name retailerId businessName isActive isMerchantKycComplete createdAt profilePicture')
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const txnUsers = p.role === 'retailer' ? [p.oid] : network.map((r) => r._id);

    const [wallets, [stats], recentTxns, activity, fundRequests, perRetailer] = await Promise.all([
      balances([p.oid]),
      Transaction.aggregate([
        { $match: { userId: { $in: txnUsers }, type: { $in: SERVICE_TYPES } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            success: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
            volume: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
            earned: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'SUCCESS'] },
                  { $ifNull: [p.role === 'retailer' ? '$commissions.retailerEarned' : '$commissions.distributorEarned', 0] },
                  0,
                ],
              },
            },
            lastAt: { $max: '$createdAt' },
          },
        },
      ]),
      Transaction.find({ userId: { $in: txnUsers } })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('userId', 'name retailerId')
        .lean(),
      ActivityLog.find({ $or: [{ actorId: p.oid }, { targetId: p.oid }] }).sort({ createdAt: -1 }).limit(40).lean(),
      FundRequest.find(p.role === 'retailer' ? { retailerId: p.id } : { distributorId: p.id, requestType: 'DISTRIBUTOR' })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      p.role === 'distributor'
        ? Transaction.aggregate([
            { $match: { userId: { $in: txnUsers }, status: 'SUCCESS', type: { $in: SERVICE_TYPES } } },
            { $group: { _id: '$userId', volume: { $sum: '$amount' }, count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
          ])
        : [],
    ]);
    const perMap = new Map(perRetailer.map((r) => [String(r._id), r]));

    return res.status(200).json({
      success: true,
      data: {
        role: p.role,
        user,
        wallets: { main: wallets.main.get(p.id) || 0, aeps: wallets.aeps.get(p.id) || 0 },
        stats: {
          count: stats?.count || 0,
          success: stats?.success || 0,
          failed: stats?.failed || 0,
          volume: round2(stats?.volume),
          earned: round2(stats?.earned),
          lastTxnAt: stats?.lastAt || null,
        },
        recentTransactions: recentTxns,
        activity,
        fundRequests,
        retailers: network.map((r) => {
          const x = perMap.get(String(r._id)) || {};
          return { ...r, volume: round2(x.volume), count: x.count || 0, lastTxnAt: x.lastAt || null };
        }),
      },
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** PATCH /api/admin/console/users/:role/:id/status  { isActive: boolean } */
export const setUserStatus = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const p = parseRoleId(req, res);
    if (!p) return;
    if (typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }
    const user = await p.Model.findByIdAndUpdate(p.id, { $set: { isActive: req.body.isActive } }, { new: true }).select('name isActive');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    logActivity({
      req,
      action: req.body.isActive ? 'user.activate' : 'user.deactivate',
      target: { _id: user._id, role: p.role, name: user.name },
      summary: `${req.body.isActive ? 'Activated' : 'Deactivated'} ${p.role} ${user.name}`,
    });
    return res.status(200).json({ success: true, message: req.body.isActive ? 'Account activated' : 'Account deactivated', data: user });
  } catch (error) {
    console.error('Admin set status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** PUT /api/admin/console/retailers/:id/services  { disabledServices: string[] } */
export const setRetailerServices = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retailer id' });
    const disabledServices = parseDisabledServices(req.body?.disabledServices);
    if (!disabledServices) return res.status(400).json({ success: false, message: 'Invalid services list' });

    const retailer = await Retailer.findByIdAndUpdate(req.params.id, { $set: { disabledServices } }, { new: true }).select('name disabledServices');
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });

    logActivity({
      req,
      action: 'retailer.services',
      target: { _id: retailer._id, role: 'retailer', name: retailer.name },
      summary: disabledServices.length ? `Switched off: ${disabledServices.join(', ')}` : 'All services switched on',
      meta: { disabledServices },
    });
    return res.status(200).json({ success: true, message: 'Services updated', data: retailer });
  } catch (error) {
    console.error('Admin set services error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** GET /api/admin/console/activity?page&limit&role&action&q&from&to&user */
export const getActivity = async (req, res) => {
  try {
    if (forbid(req, res)) return;
    const { limit, pageNo, skip } = page(req.query);
    const filter = {};
    if (req.query.role) filter.actorRole = req.query.role;
    // Exact action, or a group with a trailing '*': 'auth.password*', 'fund_request*'.
    if (req.query.action) {
      const a = String(req.query.action);
      filter.action = a.endsWith('*') ? { $regex: `^${escapeRegex(a.slice(0, -1))}` } : a;
    }
    if (req.query.user && mongoose.isValidObjectId(req.query.user)) {
      filter.$or = [{ actorId: req.query.user }, { targetId: req.query.user }];
    } else if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ actorName: rx }, { targetName: rx }, { summary: rx }];
    }
    if (isDay(req.query.from) || isDay(req.query.to)) {
      filter.createdAt = {};
      if (isDay(req.query.from)) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00+05:30`);
      if (isDay(req.query.to)) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
    }
    const [rows, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, data: { rows, total, page: pageNo, limit } });
  } catch (error) {
    console.error('Admin activity error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
