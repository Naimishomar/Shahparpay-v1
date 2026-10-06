import mongoose from 'mongoose';
import Retailer from '../models/users/retailer.model.js';
import Transaction from '../models/transaction.model.js';

const DAY = 86400000;
const TZ = 'Asia/Kolkata';

/**
 * Customer-facing services a retailer sells. Wallet plumbing (top-ups, fund
 * requests, internal transfers, settlements, platform charges, refunds) is
 * left out so "volume" means business the retailer actually did.
 */
export const SERVICE_TYPES = [
  'AEPS_WITHDRAWAL',
  'AEPS_DEPOSIT',
  'AADHAAR_PAY',
  'MATM',
  'DMT',
  'DIRECT_PAYOUT',
  'RECHARGE',
  'BILL_PAYMENT',
  'PAN_CARD',
  'STD_PAN_CARD',
  'PAN_SERVICE',
  'PAN_COUPON',
  'ITR',
  'GST_REGISTRATION',
  'PG_COLLECTION',
  'LEAD',
];

export const ALLOWED_DAYS = [7, 30, 90];

const istDate = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

/**
 * The window is whole IST days ending today, so the first bar on the chart is
 * a full day rather than whatever slice of it `now - N days` lands on.
 */
export const windowFor = (days, now = new Date()) => {
  const todayStart = new Date(`${istDate(now)}T00:00:00+05:30`);
  const since = new Date(todayStart.getTime() - (days - 1) * DAY);
  const prevSince = new Date(since.getTime() - days * DAY);
  const labels = Array.from({ length: days }, (_, i) => istDate(new Date(since.getTime() + i * DAY)));
  return { since, prevSince, labels };
};

const sums = {
  earned: { $sum: { $ifNull: ['$commissions.distributorEarned', 0] } },
  volume: { $sum: '$amount' },
  count: { $sum: 1 },
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pick = (row) => ({
  earned: round2(row?.earned),
  volume: round2(row?.volume),
  count: row?.count || 0,
});

/** Totals, previous-period totals, daily trend, service mix and per-retailer rows. */
const analyticsFor = async (ids, days) => {
  const { since, prevSince, labels } = windowFor(days);
  const current = { $match: { createdAt: { $gte: since } } };

  const [facet] = await Transaction.aggregate([
    {
      $match: {
        userId: { $in: ids },
        status: 'SUCCESS',
        type: { $in: SERVICE_TYPES },
        createdAt: { $gte: prevSince },
      },
    },
    {
      $facet: {
        current: [current, { $group: { _id: null, ...sums, active: { $addToSet: '$userId' } } }],
        previous: [{ $match: { createdAt: { $lt: since } } }, { $group: { _id: null, ...sums } }],
        trend: [
          current,
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
              ...sums,
            },
          },
        ],
        byService: [current, { $group: { _id: '$type', ...sums } }, { $sort: { volume: -1 } }],
        byRetailer: [
          current,
          { $group: { _id: '$userId', ...sums, lastAt: { $max: '$createdAt' } } },
        ],
      },
    },
  ]);

  const trendByDay = new Map(facet.trend.map((row) => [row._id, row]));
  return {
    since,
    totals: { ...pick(facet.current[0]), activeRetailers: facet.current[0]?.active?.length || 0 },
    previous: pick(facet.previous[0]),
    // Days with no business still get a point, so the chart shows the gap.
    trend: labels.map((date) => ({ date, ...pick(trendByDay.get(date)) })),
    byService: facet.byService.map((row) => ({ type: row._id, ...pick(row) })),
    byRetailer: new Map(
      facet.byRetailer.map((row) => [String(row._id), { ...pick(row), lastAt: row.lastAt }])
    ),
  };
};

/** Lifetime commission and last activity per retailer, in one pass. */
export const lifetimeFor = async (ids) => {
  const rows = await Transaction.aggregate([
    { $match: { userId: { $in: ids }, status: 'SUCCESS', type: { $in: SERVICE_TYPES } } },
    {
      $group: {
        _id: '$userId',
        earned: sums.earned,
        lastActiveAt: { $max: '$createdAt' },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

const recentFor = (ids, limit) =>
  Transaction.find({ userId: { $in: ids }, type: { $in: SERVICE_TYPES } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('transactionId type amount status createdAt userId commissions.distributorEarned')
    .lean();

const parseDays = (value) => {
  const days = Number(value);
  return ALLOWED_DAYS.includes(days) ? days : 30;
};

/**
 * GET /api/distributor/analytics?days=7|30|90
 * Network-wide performance for the signed-in distributor.
 */
export const getNetworkAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'distributor') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    const days = parseDays(req.query.days);

    const retailers = await Retailer.find({ distributorId: req.user.id })
      .select('name retailerId businessName profilePicture isMerchantKycComplete createdAt')
      .lean();
    const ids = retailers.map((r) => r._id);

    const [analytics, lifetime, recent] = await Promise.all([
      analyticsFor(ids, days),
      lifetimeFor(ids),
      recentFor(ids, 12),
    ]);

    const byId = new Map(retailers.map((r) => [String(r._id), r]));
    let lifetimeEarned = 0;
    const rows = retailers.map((r) => {
      const key = String(r._id);
      const life = lifetime.get(key);
      lifetimeEarned += life?.earned || 0;
      return {
        ...r,
        ...(analytics.byRetailer.get(key) || { earned: 0, volume: 0, count: 0, lastAt: null }),
        lifetimeEarned: round2(life?.earned),
        lastActiveAt: life?.lastActiveAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        days,
        since: analytics.since,
        totals: { ...analytics.totals, totalRetailers: retailers.length },
        previous: analytics.previous,
        lifetimeEarned: round2(lifetimeEarned),
        trend: analytics.trend,
        byService: analytics.byService,
        retailers: rows,
        recent: recent.map((t) => {
          const r = byId.get(String(t.userId));
          return { ...t, retailer: r ? { _id: r._id, name: r.name, retailerId: r.retailerId } : null };
        }),
      },
    });
  } catch (error) {
    console.error('Distributor analytics error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/distributor/retailers/:id/performance?days=7|30|90
 * One retailer's trend, service mix and latest transactions — only for a
 * retailer that belongs to the signed-in distributor.
 */
export const getRetailerPerformance = async (req, res) => {
  try {
    if (req.user.role !== 'distributor') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid retailer id' });
    }
    const retailer = await Retailer.exists({ _id: id, distributorId: req.user.id });
    if (!retailer) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    const days = parseDays(req.query.days);
    const ids = [new mongoose.Types.ObjectId(id)];
    const [analytics, lifetime, recent] = await Promise.all([
      analyticsFor(ids, days),
      lifetimeFor(ids),
      recentFor(ids, 25),
    ]);
    const life = lifetime.get(id);

    return res.status(200).json({
      success: true,
      data: {
        days,
        since: analytics.since,
        totals: analytics.totals,
        previous: analytics.previous,
        lifetimeEarned: round2(life?.earned),
        lastActiveAt: life?.lastActiveAt || null,
        trend: analytics.trend,
        byService: analytics.byService,
        recent,
      },
    });
  } catch (error) {
    console.error('Retailer performance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
