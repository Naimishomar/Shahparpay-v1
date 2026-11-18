import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import mongoose from 'mongoose';
import Visit from '../models/visit.model.js';
import Setting from '../models/setting.model.js';
import Otp from '../models/otp.model.js';
import { readLogs } from '../utils/logBuffer.js';
import { sendEmailOTP } from '../utils/email.js';
import { logActivity } from '../utils/activity.js';
import { SERVICES, SERVICE_KEYS } from '../utils/services.js';
import { getPlatformDisabled, setPlatformDisabled } from '../middlewares/service.middleware.js';

const TZ = 'Asia/Kolkata';
const istDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i;

const adminOnly = (req, res) => {
  if (req.user?.role === 'admin') return false;
  res.status(403).json({ success: false, message: 'Unauthorized access' });
  return true;
};

/* ---------------------------------------------------------------- visitors */

const deviceOf = (ua) => (/iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop');
const refHost = (ref) => {
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return /(^|\.)shahparpay\.(in|com)$/.test(host) ? undefined : host.slice(0, 100);
  } catch {
    return undefined;
  }
};

/**
 * POST /api/track { path, ref } — public, one call per page view.
 * Answers 204 whatever happens: a tracking failure must never show on the site.
 */
export const trackVisit = async (req, res) => {
  res.status(204).end();
  try {
    const ua = String(req.headers['user-agent'] || '');
    const path = String(req.body?.path || '');
    if (!ua || BOT.test(ua) || !path.startsWith('/') || path.length > 200) return;
    const day = istDay();
    // Rotates daily with the date in the hash, so a visitor cannot be followed across days.
    const vid = crypto.createHash('sha256').update(`${process.env.JWT_SECRET}|${day}|${req.ip}|${ua}`).digest('hex').slice(0, 20);
    const country = String(req.headers['cf-ipcountry'] || '').slice(0, 2) || undefined;
    await Visit.create({ day, vid, path: path.split('?')[0], ref: refHost(req.body?.ref), device: deviceOf(ua), country });
  } catch (error) {
    console.error('[track] could not record visit:', error.message);
  }
};

const daysBack = (n, end = new Date()) =>
  Array.from({ length: n }, (_, i) => istDay(new Date(end.getTime() - (n - 1 - i) * 86400000)));

/** Unique visitors and page views over a set of days. */
const totalsFor = async (days) => {
  const [row] = await Visit.aggregate([
    { $match: { day: { $in: days } } },
    { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: { $concat: ['$day', '$vid'] } } } },
    { $project: { views: 1, visitors: { $size: '$visitors' } } },
  ]);
  return { visitors: row?.visitors || 0, views: row?.views || 0 };
};

const topBy = (match, field, unique = false) =>
  Visit.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ''] } } },
    unique
      ? { $group: { _id: `$${field}`, ids: { $addToSet: { $concat: ['$day', '$vid'] } } } }
      : { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ...(unique ? [{ $project: { count: { $size: '$ids' } } }] : []),
    { $sort: { count: -1 } },
    { $limit: 8 },
    { $project: { _id: 0, key: '$_id', count: 1 } },
  ]);

/** GET /api/admin/system/analytics?days=7|30|90 */
export const getAnalytics = async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const n = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const days = daysBack(n);
    const previous = daysBack(n, new Date(Date.now() - n * 86400000));
    const match = { day: { $in: days } };

    const [daily, totals, prev, today, live, pages, referrers, devices, countries] = await Promise.all([
      Visit.aggregate([
        { $match: match },
        { $group: { _id: '$day', views: { $sum: 1 }, ids: { $addToSet: '$vid' } } },
        { $project: { views: 1, visitors: { $size: '$ids' } } },
      ]),
      totalsFor(days),
      totalsFor(previous),
      totalsFor([istDay()]),
      Visit.distinct('vid', { createdAt: { $gte: new Date(Date.now() - 5 * 60000) } }),
      topBy(match, 'path'),
      topBy(match, 'ref', true),
      topBy(match, 'device', true),
      topBy(match, 'country', true),
    ]);

    const byDay = Object.fromEntries(daily.map((d) => [d._id, d]));
    const trend = days.map((date) => ({ date, visitors: byDay[date]?.visitors || 0, views: byDay[date]?.views || 0 }));
    return res.status(200).json({
      success: true,
      data: { days: n, totals, previous: prev, today, liveNow: live.length, trend, pages, referrers, devices, countries },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ------------------------------------------------------------------ server */

const startedAt = Date.now();
const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** GET /api/admin/system/health — process, machine, disk and database at a glance. */
export const getHealth = async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const pingStart = Date.now();
    let dbPingMs = null;
    let dbStats = null;
    try {
      await mongoose.connection.db.admin().ping();
      dbPingMs = Date.now() - pingStart;
      const s = await mongoose.connection.db.stats();
      dbStats = { collections: s.collections, objects: s.objects, dataSize: s.dataSize, storageSize: s.storageSize };
    } catch {
      /* reported as down below */
    }
    let disk = null;
    try {
      const s = await fs.statfs('/');
      disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
    } catch {
      /* statfs is missing on some platforms */
    }
    const mem = process.memoryUsage();
    return res.status(200).json({
      success: true,
      data: {
        startedAt,
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        process: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
        machine: {
          hostname: os.hostname(),
          cpus: os.cpus().length,
          load: os.loadavg(),
          totalMem: os.totalmem(),
          freeMem: os.freemem(),
          uptimeSec: Math.round(os.uptime()),
        },
        disk,
        db: { state: mongoStates[mongoose.connection.readyState] || 'unknown', pingMs: dbPingMs, stats: dbStats },
      },
    });
  } catch (error) {
    console.error('Admin health error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** GET /api/admin/system/logs?since=<seq> — server console lines since the last poll. */
export const getLogs = (req, res) => {
  if (adminOnly(req, res)) return;
  const lines = readLogs(Number(req.query.since) || 0);
  return res.status(200).json({ success: true, data: { lines: lines.slice(-1000) } });
};

/* -------------------------------------------------- confirmed (OTP) actions */

/** POST /api/admin/system/otp — mails the admin a code to confirm a restart or deploy. */
export const sendActionOtp = async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    if (!req.user.email) return res.status(400).json({ success: false, message: 'Your admin account has no email.' });
    const otp = await Otp.issue(req.user.email);
    const sent = await sendEmailOTP(req.user.email, req.user.name || 'Admin', otp);
    if (!sent) return res.status(500).json({ success: false, message: 'Could not send the code.' });
    return res.status(200).json({ success: true, message: `Code sent to ${req.user.email}` });
  } catch (error) {
    console.error('Admin action OTP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const confirmed = async (req, res) => {
  if (adminOnly(req, res)) return false;
  const otp = String(req.body?.otp || '');
  if (!/^\d{6}$/.test(otp) || !(await Otp.consume(req.user.email, otp))) {
    res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    return false;
  }
  return true;
};

/**
 * POST /api/admin/system/restart { otp }
 * Exits the process; Docker's `restart: unless-stopped` starts a fresh one in seconds.
 */
export const restartServer = async (req, res) => {
  try {
    if (!(await confirmed(req, res))) return;
    logActivity({ req, action: 'system.restart', summary: `${req.user.name} restarted the backend server` });
    console.warn(`[system] restart requested by ${req.user.name}`);
    res.status(200).json({ success: true, message: 'Restarting. Back in a few seconds.' });
    // Give the activity log and the response time to leave.
    setTimeout(() => process.exit(0), 1500);
  } catch (error) {
    console.error('Admin restart error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Deploys run in GitHub Actions (.github/workflows/deploy-backend.yml). GITHUB_TOKEN is a
// fine-grained token with Actions read/write on this one repository only.
const REPO = process.env.GITHUB_REPO || 'Naimishomar/Shahparpay-v1';
const WORKFLOW = 'deploy-backend.yml';
const github = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

/** GET /api/admin/system/deploys — the last deploy runs and the commit each shipped. */
export const getDeploys = async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    if (!process.env.GITHUB_TOKEN) return res.status(200).json({ success: true, data: { configured: false, runs: [] } });
    const r = await github(`/actions/workflows/${WORKFLOW}/runs?per_page=10`);
    if (!r.ok) return res.status(502).json({ success: false, message: `GitHub answered ${r.status}` });
    const json = await r.json();
    const runs = (json.workflow_runs || []).map((w) => ({
      id: w.id,
      status: w.status,
      conclusion: w.conclusion,
      event: w.event,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      commit: w.head_commit?.message?.split('\n')[0] || '',
      sha: w.head_sha?.slice(0, 7),
      author: w.head_commit?.author?.name || w.actor?.login,
      url: w.html_url,
    }));
    return res.status(200).json({ success: true, data: { configured: true, runs } });
  } catch (error) {
    console.error('Admin deploys error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** POST /api/admin/system/deploy { otp } — ships the latest main to the server. */
export const triggerDeploy = async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) return res.status(400).json({ success: false, message: 'GITHUB_TOKEN is not set on the server.' });
    if (!(await confirmed(req, res))) return;
    const r = await github(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
    if (!r.ok) return res.status(502).json({ success: false, message: `GitHub answered ${r.status}` });
    logActivity({ req, action: 'system.deploy', summary: `${req.user.name} started a backend deploy` });
    return res.status(200).json({ success: true, message: 'Deploy started. It takes 2–3 minutes; the server restarts at the end.' });
  } catch (error) {
    console.error('Admin deploy error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ------------------------------------------------------ platform switches */

/** GET /api/admin/system/services — every service and whether it is paused for all. */
export const getPlatformServices = (req, res) => {
  if (adminOnly(req, res)) return;
  const off = getPlatformDisabled();
  return res.status(200).json({
    success: true,
    data: SERVICE_KEYS.map((key) => ({ key, label: SERVICES[key], enabled: !off.includes(key) })),
  });
};

/** PUT /api/admin/system/services/:key { enabled } — pause or resume a service for every retailer. */
export const setPlatformService = async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const { key } = req.params;
    if (!SERVICE_KEYS.includes(key) || typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Unknown service or missing `enabled`.' });
    }
    const off = new Set(getPlatformDisabled());
    if (req.body.enabled) off.delete(key);
    else off.add(key);
    const list = [...off];
    await Setting.findOneAndUpdate({ key: 'disabledServices' }, { value: list }, { upsert: true });
    setPlatformDisabled(list);
    logActivity({
      req,
      action: 'system.service',
      summary: `${req.user.name} ${req.body.enabled ? 'resumed' : 'paused'} ${SERVICES[key]} for all retailers`,
      meta: { key, enabled: req.body.enabled },
    });
    return res.status(200).json({ success: true, data: { key, enabled: req.body.enabled } });
  } catch (error) {
    console.error('Admin service switch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
