import cron from 'node-cron';
import Setting from '../models/setting.model.js';
import Notification from '../models/notification.model.js';
import Admin from '../models/users/admin.model.js';
import { fetchWallets, readLowBalance, LOW_BALANCE_KEY } from '../controllers/adminIcchhamati.controller.js';

/**
 * Which wallets just crossed below their alert line, and the new `alerted` map.
 * One alert per drop: a wallet stays alerted until it is back above its line.
 */
export const lowBalanceChanges = (wallets, { thresholds, alerted }, now = new Date()) => {
  const next = { ...alerted };
  const crossed = [];
  for (const w of wallets) {
    const line = Number(thresholds[w.id]);
    if (!line) {
      delete next[w.id];
    } else if (w.available < line) {
      if (!next[w.id]) {
        next[w.id] = now.toISOString();
        crossed.push({ ...w, line });
      }
    } else {
      delete next[w.id];
    }
  }
  return { crossed, alerted: next };
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const checkBalances = async () => {
  const settings = await readLowBalance();
  if (!Object.keys(settings.thresholds).length) return;
  const { wallets, error } = await fetchWallets();
  if (error) return console.error('Icchhamati balance watch:', error);

  const { crossed, alerted } = lowBalanceChanges(wallets, settings);
  if (crossed.length) {
    // Notifications need an author; the first admin account stands in for the system.
    const admin = await Admin.findOne().select('_id').lean();
    if (!admin) return;
    await Notification.insertMany(crossed.map((w) => ({
      title: `Icchhamati ${w.name} is low`,
      message: `${w.name} has ${inr(w.available)} available, below the ${inr(w.line)} alert line. Top it up before retailer transactions start failing.`,
      kind: 'urgent',
      targetRoles: ['admin'],
      createdBy: admin._id,
    })));
  }
  await Setting.updateOne({ key: LOW_BALANCE_KEY }, { $set: { 'value.alerted': alerted } });
};

export const startIcchhamatiBalanceWatch = () => {
  cron.schedule('*/10 * * * *', () => checkBalances().catch((e) => console.error('Icchhamati balance watch failed:', e.message)));
};
