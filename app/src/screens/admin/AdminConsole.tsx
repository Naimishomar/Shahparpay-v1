import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Linking, Platform } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorBanner, Segmented, SkeletonRows, SuccessBanner } from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useInterval } from '@/hooks';
import { labelFor } from '@/screens/transactionText';
import api from '@/services/api';

/**
 * The web admin's Overview, Visitors and Server pages (frontend/src/components/admin/
 * AdminOverview.tsx, SiteAnalytics.tsx, ServerConsole.tsx) for the app, on the same
 * /api/admin/console and /api/admin/system endpoints.
 */

const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

const num = (n: number) => (Number(n) || 0).toLocaleString('en-IN');
const inr = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** ₹1.2L / ₹3.4Cr, as the web's inrShort. */
const inrShort = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return inr(v);
};
/** Percent change against the previous period; null when there is nothing to compare. */
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const failure = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;

/** GET that throws the server's message, so useAsync shows it. */
const fetchData = async (url: string, params?: Record<string, any>) => {
  try {
    const res = await api.get(url, params);
    if (res && res.success === false) throw new Error(res.message);
    return res?.data;
  } catch (err) {
    throw new Error(failure(err, 'Could not load this.'));
  }
};

// ---------------------------------------------------------------- shared bits

const Delta: React.FC<{ value: number | null }> = ({ value }) =>
  value === null ? null : (
    <Text style={[styles.delta, { color: value >= 0 ? colors.success : colors.destructive }]}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(value)}%
    </Text>
  );

const Tiles: React.FC<{ items: { label: string; value: string; hint?: string; change?: number | null; dot?: boolean | null; meter?: [number, number] }[] }> = ({ items }) => (
  <View style={styles.tiles}>
    {items.map((it) => (
      <View key={it.label} style={styles.tile}>
        <View style={styles.tileHead}>
          {it.dot !== undefined && it.dot !== null && (
            <View style={[styles.dot, { backgroundColor: it.dot ? colors.success : colors.destructive }]} />
          )}
          <Text style={styles.tileLabel} numberOfLines={1}>{it.label}</Text>
        </View>
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{it.value}</Text>
        <View style={styles.tileFoot}>
          {it.change !== undefined && <Delta value={it.change} />}
          {!!it.hint && <Text style={styles.hint} numberOfLines={1}>{it.hint}</Text>}
        </View>
        {it.meter && <Meter used={it.meter[0]} total={it.meter[1]} />}
      </View>
    ))}
  </View>
);

const Meter: React.FC<{ used: number; total: number }> = ({ used, total }) => {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct > 85 ? colors.destructive : pct > 70 ? colors.warning : colors.success;
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: tone }]} />
    </View>
  );
};

const ShareBar: React.FC<{ value: number; max: number }> = ({ value, max }) => (
  <View style={styles.meterTrack}>
    <View style={[styles.meterFill, { width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, backgroundColor: colors.foreground }]} />
  </View>
);

/** Daily bars; tap one to read its day. */
const Bars: React.FC<{ points: { date: string; value: number; caption: string }[] }> = ({ points }) => {
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return <Text style={styles.hint}>No data in this range.</Text>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const shown = picked ?? points.length - 1;
  return (
    <View>
      <Text style={styles.barCaption}>
        {dayLabel(points[shown].date)} · {points[shown].caption}
      </Text>
      <View style={styles.bars}>
        {points.map((p, i) => (
          <Pressable key={p.date} style={styles.barSlot} onPress={() => setPicked(i)} hitSlop={4}>
            <View
              style={[
                styles.bar,
                { height: `${Math.max(2, (p.value / max) * 100)}%`, opacity: i === shown ? 1 : 0.3 },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.barAxis}>
        <Text style={styles.hint}>{dayLabel(points[0].date)}</Text>
        <Text style={styles.hint}>{dayLabel(points[points.length - 1].date)}</Text>
      </View>
    </View>
  );
};

const Section: React.FC<{ title: string; note?: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, note, right, children }) => (
  <View style={styles.card}>
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!note && <Text style={styles.hint}>{note}</Text>}
      </View>
      {right}
    </View>
    {children}
  </View>
);

const TopList: React.FC<{ title: string; rows: { key: string; label: string; sub?: string; value: number; display: string }[]; empty: string }> = ({ title, rows, empty }) => {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <Text style={styles.hint}>{empty}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.key} style={styles.listRow}>
            <View style={styles.listHead}>
              <Text style={styles.listLabel} numberOfLines={1}>{r.label}</Text>
              <Text style={styles.listValue}>{r.display}</Text>
            </View>
            {!!r.sub && <Text style={styles.hint} numberOfLines={1}>{r.sub}</Text>}
            <ShareBar value={r.value} max={max} />
          </View>
        ))
      )}
    </Section>
  );
};

// ---------------------------------------------------------------- Overview

type Money = { volume: number; count: number; adminEarned: number; distributorEarned: number; retailerEarned: number };

/** The web admin Overview: KPIs, what needs attention, trend, wallets, service mix and leaders. */
export const OverviewPanel: React.FC<{ onTab: (tab: string) => void }> = ({ onTab }) => {
  const [days, setDays] = useState('30');
  const [metric, setMetric] = useState<'volume' | 'count' | 'adminEarned'>('volume');
  const overview = useAsync<any>(() => fetchData('/api/admin/console/overview', { days }), [days]);
  const d = overview.data;
  const failed = d?.statuses?.FAILED?.count || 0;

  const queues = d
    ? [
        { title: 'retailer fund requests', count: d.queues.pendingRetailerFunds, tab: 'requests' },
        { title: 'distributor fund requests', count: d.queues.pendingDistributorFunds, tab: 'requests' },
        { title: 'open tickets', count: d.queues.openTickets },
        { title: 'KYC pending', count: d.users.kycPending },
        { title: 'failed transactions', count: failed },
        { title: 'inactive accounts', count: d.users.inactive },
      ].filter((q) => q.count > 0)
    : [];

  const services: (Money & { type: string })[] = d?.byService ?? [];
  const serviceMax = Math.max(...services.map((s) => s.volume), 0);

  return (
    <>
      <Segmented options={RANGES} value={days} onChange={setDays} />
      {!!overview.error && <ErrorBanner message={overview.error} onRetry={overview.reload} />}
      {overview.loading && !d ? (
        <SkeletonRows count={6} />
      ) : d ? (
        <>
          {queues.length === 0 ? (
            <Text style={styles.hint}>Nothing waiting on you.</Text>
          ) : (
            <View style={styles.chips}>
              {queues.map((q) => (
                <Pressable
                  key={q.title}
                  onPress={q.tab ? () => onTab(q.tab!) : undefined}
                  disabled={!q.tab}
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.chipText}>
                    <Text style={{ fontWeight: '700' }}>{num(q.count)}</Text> {q.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Tiles
            items={[
              { label: 'Transaction volume', value: inrShort(d.totals.volume), change: delta(d.totals.volume, d.previous.volume), hint: `${num(d.totals.count)} successful` },
              { label: 'Platform earnings', value: inr(d.totals.adminEarned), change: delta(d.totals.adminEarned, d.previous.adminEarned), hint: 'Admin commission' },
              { label: 'Success rate', value: d.successRate === null ? '—' : `${d.successRate}%`, hint: `${num(failed)} failed` },
              { label: 'Active retailers', value: `${d.totals.activeRetailers}/${d.users.retailers}`, hint: 'Transacted in range' },
            ]}
          />

          <Section title="Daily trend">
            <Segmented
              options={[
                { key: 'volume', label: 'Volume' },
                { key: 'count', label: 'Txns' },
                { key: 'adminEarned', label: 'Earnings' },
              ]}
              value={metric}
              onChange={(k) => setMetric(k as typeof metric)}
            />
            <Bars
              points={(d.trend ?? []).map((p: any) => ({
                date: p.date,
                value: p[metric],
                caption: metric === 'count' ? `${num(p.count)} txns` : inr(p[metric]),
              }))}
            />
          </Section>

          <Tiles
            items={[
              { label: 'Retailers', value: num(d.users.retailers), hint: `+${d.users.newRetailers} new` },
              { label: 'Distributors', value: num(d.users.distributors), hint: `+${d.users.newDistributors} new` },
              { label: 'Admin wallet', value: inrShort(d.wallets.adminBalance), hint: 'Your balance' },
              { label: 'Utility float', value: inrShort(d.wallets.mainFloat), hint: 'All users' },
              { label: 'Trade float', value: inrShort(d.wallets.aepsFloat), hint: 'All users' },
              { label: 'Paid to network', value: inrShort(d.totals.distributorEarned + d.totals.retailerEarned), hint: `Last ${days} days` },
            ]}
          />

          <Section title="Service mix">
            {services.length === 0 ? (
              <Text style={styles.hint}>No transactions in this range.</Text>
            ) : (
              services.slice(0, 8).map((s) => (
                <View key={s.type} style={styles.listRow}>
                  <View style={styles.listHead}>
                    <Text style={styles.listLabel} numberOfLines={1}>{labelFor(s.type)}</Text>
                    <Text style={styles.listValue}>{inrShort(s.volume)}</Text>
                  </View>
                  <ShareBar value={s.volume} max={serviceMax} />
                  <Text style={styles.hint}>{num(s.count)} txns · {inr(s.adminEarned)} earned</Text>
                </View>
              ))
            )}
          </Section>

          <TopList
            title="Top distributors"
            empty="No activity in this range."
            rows={(d.topDistributors ?? []).map((r: any) => ({ key: r._id, label: r.name, sub: `${r.distributorId} · ${r.activeRetailers} active retailers`, value: r.volume, display: inrShort(r.volume) }))}
          />
          <TopList
            title="Top retailers"
            empty="No activity in this range."
            rows={(d.topRetailers ?? []).map((r: any) => ({ key: r._id, label: r.name, sub: `${r.retailerId} · ${r.count} txns`, value: r.volume, display: inrShort(r.volume) }))}
          />
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- Visitors

const COUNTRY = typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'
  ? new (Intl as any).DisplayNames(['en'], { type: 'region' })
  : null;
const countryName = (code: string) => {
  try {
    return COUNTRY?.of(code) || code;
  } catch {
    return code;
  }
};

/** Who visits shahparpay.in and the portal. Bots and admin pages are left out. */
export const VisitorsPanel: React.FC = () => {
  const [days, setDays] = useState('30');
  const analytics = useAsync<any>(() => fetchData('/api/admin/system/analytics', { days }), [days]);
  const d = analytics.data;
  const list = (rows: { key: string; count: number }[] = [], label = (k: string) => k) =>
    rows.map((r) => ({ key: r.key, label: label(r.key), value: r.count, display: num(r.count) }));

  return (
    <>
      <Segmented options={RANGES} value={days} onChange={setDays} />
      <Text style={styles.hint}>Who visits shahparpay.in and the portal. Bots and admin pages are left out.</Text>
      {!!analytics.error && <ErrorBanner message={analytics.error} onRetry={analytics.reload} />}
      {analytics.loading && !d ? (
        <SkeletonRows count={6} />
      ) : d ? (
        <>
          <Tiles
            items={[
              { label: 'Unique visitors', value: num(d.totals.visitors), change: delta(d.totals.visitors, d.previous.visitors) },
              { label: 'Page views', value: num(d.totals.views), change: delta(d.totals.views, d.previous.views) },
              { label: 'Visitors today', value: num(d.today.visitors) },
              { label: 'On the site now', value: num(d.liveNow), dot: true },
            ]}
          />
          <Section title="Daily visitors">
            <Bars points={(d.trend ?? []).map((p: any) => ({ date: p.date, value: p.visitors, caption: `${num(p.visitors)} visitors · ${num(p.views)} views` }))} />
          </Section>
          <TopList title="Top pages" rows={list(d.pages)} empty="No page views yet." />
          <TopList title="Where they come from" rows={list(d.referrers)} empty="Everyone came directly so far." />
          <TopList title="Devices" rows={list(d.devices, (k) => k[0].toUpperCase() + k.slice(1))} empty="No data yet." />
          <TopList title="Countries" rows={list(d.countries, countryName)} empty="No data yet." />
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- Server

const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
const mb = (b: number) => `${Math.round(b / 1024 ** 2)} MB`;
const duration = (sec: number) => {
  const dd = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return dd ? `${dd}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Restart and deploy ask for an emailed code first: a stolen session alone cannot take the server down. */
const ConfirmAction: React.FC<{ action: 'restart' | 'deploy'; onDone: (message: string) => void; onCancel: () => void }> = ({ action, onDone, onCancel }) => {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const send = useAction(async () => {
    try {
      const res = await api.post('/api/admin/system/otp');
      if (!res?.success) throw new Error(res?.message);
      setSent(true);
      return res;
    } catch (err) {
      throw new Error(failure(err, 'Could not send the code.'));
    }
  });
  const confirm = useAction(async () => {
    try {
      const res = await api.post(`/api/admin/system/${action}`, { otp });
      if (!res?.success) throw new Error(res?.message);
      onDone(res.message || 'Done.');
      return res;
    } catch (err) {
      throw new Error(failure(err, 'Failed.'));
    }
  });
  return (
    <View style={styles.confirm}>
      <Text style={styles.sectionTitle}>{action === 'restart' ? 'Restart the backend server?' : 'Deploy the latest code on main?'}</Text>
      <Text style={styles.hint}>
        {action === 'restart'
          ? 'The portal and app stop answering for about 10 seconds. Transactions in progress may fail.'
          : 'Takes 2–3 minutes. The server restarts once at the end.'}
      </Text>
      {!!(send.error || confirm.error) && <ErrorBanner message={(send.error || confirm.error)!} />}
      {sent ? (
        <>
          <Input label="6-digit code" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="Code from your email" />
          <Button onPress={() => confirm.run()} loading={confirm.pending} disabled={otp.length !== 6} fullWidth>Confirm</Button>
        </>
      ) : (
        <Button onPress={() => send.run()} loading={send.pending} fullWidth>Email me a code</Button>
      )}
      <Button variant="ghost" onPress={onCancel} fullWidth>Cancel</Button>
    </View>
  );
};

type LogLine = { seq: number; at: number; level: 'log' | 'warn' | 'error'; line: string };

const LiveLogs: React.FC = () => {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const since = useRef(0);
  const box = useRef<ScrollView>(null);
  const busy = useRef(false);

  const poll = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await api.get('/api/admin/system/logs', { since: since.current });
      const fresh: LogLine[] = res?.data?.lines || [];
      if (fresh.length) {
        // A restart starts the counter again: lines below what we have mean a fresh process.
        const restarted = fresh[0].seq <= since.current;
        since.current = fresh[fresh.length - 1].seq;
        setLines((prev) => (restarted ? fresh : [...prev, ...fresh]).slice(-500));
      }
    } catch {
      // The next poll tries again.
    } finally {
      busy.current = false;
    }
  };
  useEffect(() => {
    poll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(poll, paused ? null : 3000);

  const shown = errorsOnly ? lines.filter((l) => l.level !== 'log') : lines;
  return (
    <Section
      title="Live logs"
      note="Server console since the last restart. Refreshes every 3 seconds."
      right={
        <View style={styles.logActions}>
          <Pressable onPress={() => setErrorsOnly(!errorsOnly)} hitSlop={6}>
            <Text style={[styles.link, errorsOnly && { color: colors.destructive }]}>Errors</Text>
          </Pressable>
          <Pressable onPress={() => setPaused(!paused)} hitSlop={6}>
            <Text style={styles.link}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView
        ref={box}
        style={styles.logBox}
        nestedScrollEnabled
        onContentSizeChange={() => box.current?.scrollToEnd({ animated: false })}
      >
        {shown.length === 0 ? (
          <Text style={styles.logLine}>{lines.length ? 'No error lines.' : 'Waiting for logs…'}</Text>
        ) : (
          shown.map((l) => (
            <Text key={l.seq} style={[styles.logLine, l.level === 'error' && { color: '#F87171' }, l.level === 'warn' && { color: '#FCD34D' }]}>
              <Text style={{ color: '#71717A' }}>{new Date(l.at).toLocaleTimeString('en-IN', { hour12: false })}  </Text>
              {l.line}
            </Text>
          ))
        )}
      </ScrollView>
    </Section>
  );
};

/** Health, deploys, platform-wide service switches and live logs for the backend. */
export const ServerPanel: React.FC = () => {
  const health = useAsync<any>(() => fetchData('/api/admin/system/health'), []);
  const deploys = useAsync<any>(() => fetchData('/api/admin/system/deploys'), []);
  const services = useAsync<any[]>(() => fetchData('/api/admin/system/services'), []);
  const [confirming, setConfirming] = useState<'restart' | 'deploy' | null>(null);
  const [notice, setNotice] = useState('');

  const running = (deploys.data?.runs ?? []).some((r: any) => r.status !== 'completed');
  useInterval(() => health.refresh(), 15000);
  useInterval(() => deploys.refresh(), running ? 20000 : null);

  const toggle = useAction(async (s: { key: string; label: string; enabled: boolean }) => {
    try {
      const res = await api.put(`/api/admin/system/services/${s.key}`, { enabled: !s.enabled });
      if (!res?.success) throw new Error(res?.message);
      setNotice(`${s.label} ${s.enabled ? 'paused for all retailers' : 'is live again'}`);
      services.refresh();
      return res;
    } catch (err) {
      throw new Error(failure(err, 'Could not change it.'));
    }
  });

  const h = health.data;
  const up = !!h && !health.error;
  const tiles = h
    ? [
        { label: 'Server', value: up ? 'Online' : 'Not answering', hint: `Up ${duration(h.uptimeSec)} · Node ${String(h.node).replace('v', '')}`, dot: up },
        { label: 'Database', value: h.db.state === 'connected' ? `${h.db.pingMs ?? '—'} ms` : h.db.state, hint: h.db.stats ? `${num(h.db.stats.objects)} records · ${mb(h.db.stats.dataSize)}` : 'No stats', dot: h.db.state === 'connected' },
        { label: 'CPU load', value: Number(h.machine.load[0]).toFixed(2), hint: `${h.machine.cpus} cores · 1-min average`, dot: h.machine.load[0] < h.machine.cpus, meter: [h.machine.load[0], h.machine.cpus] as [number, number] },
        { label: 'Memory', value: gb(h.machine.totalMem - h.machine.freeMem), hint: `of ${gb(h.machine.totalMem)} · app ${mb(h.process.rss)}`, dot: h.machine.freeMem / h.machine.totalMem > 0.1, meter: [h.machine.totalMem - h.machine.freeMem, h.machine.totalMem] as [number, number] },
        ...(h.disk ? [{ label: 'Disk', value: gb(h.disk.total - h.disk.free), hint: `of ${gb(h.disk.total)} · ${gb(h.disk.free)} free`, dot: h.disk.free / h.disk.total > 0.1, meter: [h.disk.total - h.disk.free, h.disk.total] as [number, number] }] : []),
      ]
    : [];

  return (
    <>
      {!!h && <Text style={styles.hint}>{h.machine.hostname} · {h.env}</Text>}
      {!!notice && <SuccessBanner message={notice} />}
      {!!health.error && <ErrorBanner message={health.error} onRetry={health.reload} />}
      {health.loading && !h ? <SkeletonRows count={4} /> : <Tiles items={tiles} />}

      <Section title="Deploys" note="Every push to main ships the backend automatically.">
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button variant="outline" icon="restart" onPress={() => setConfirming('restart')} fullWidth>Restart</Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button icon="rocket-launch-outline" onPress={() => setConfirming('deploy')} disabled={!deploys.data?.configured} fullWidth>Deploy now</Button>
          </View>
        </View>
        {confirming && (
          <ConfirmAction
            key={confirming}
            action={confirming}
            onCancel={() => setConfirming(null)}
            onDone={(message) => {
              const what = confirming;
              setConfirming(null);
              setNotice(message);
              setTimeout(() => (what === 'deploy' ? deploys.refresh() : health.refresh()), 4000);
            }}
          />
        )}
        {deploys.data && !deploys.data.configured ? (
          <Text style={styles.hint}>To deploy and see deploy history from here, add GITHUB_TOKEN to the server's backend/.env.</Text>
        ) : deploys.loading && !deploys.data ? (
          <SkeletonRows count={3} />
        ) : !!deploys.error ? (
          <ErrorBanner message={deploys.error} onRetry={deploys.reload} />
        ) : (deploys.data?.runs ?? []).length === 0 ? (
          <EmptyState title="No deploys yet" />
        ) : (
          (deploys.data?.runs ?? []).map((r: any) => {
            const state = r.status !== 'completed' ? 'Running' : r.conclusion === 'success' ? 'Live' : r.conclusion === 'cancelled' ? 'Cancelled' : 'Failed';
            const tone = state === 'Live' ? colors.success : state === 'Running' ? colors.warning : state === 'Cancelled' ? colors.mutedForeground : colors.destructive;
            return (
              <Pressable key={r.id} onPress={() => r.url && Linking.openURL(r.url).catch(() => {})} style={styles.deployRow}>
                <View style={[styles.dot, { backgroundColor: tone }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.listLabel} numberOfLines={1}>{r.commit || 'Manual deploy'}</Text>
                  <Text style={styles.hint} numberOfLines={1}>{state} · {r.sha} · {r.author} · {ago(r.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </Section>

      <Section title="Services" note="Pause one for every retailer, e.g. when a provider is down.">
        {!!toggle.error && <ErrorBanner message={toggle.error} />}
        {services.loading && !services.data ? (
          <SkeletonRows count={5} />
        ) : (
          (services.data ?? []).map((s: any) => (
            <View key={s.key} style={styles.switchRow}>
              <Text style={[styles.listLabel, !s.enabled && { color: colors.mutedForeground }]}>
                {s.label}{!s.enabled ? ' · paused' : ''}
              </Text>
              <Switch
                value={!!s.enabled}
                onValueChange={() => toggle.run(s)}
                disabled={toggle.pending}
                accessibilityLabel={`${s.label} for all retailers`}
              />
            </View>
          ))
        )}
      </Section>

      <LiveLogs />
    </>
  );
};

const styles = themed((c) => ({
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.border, gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sectionTitle: { fontSize: t.body, fontWeight: '600', color: c.foreground },
  hint: { fontSize: t.caption, color: c.mutedForeground },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, backgroundColor: c.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: c.border, gap: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontSize: t.caption, color: c.mutedForeground, flexShrink: 1 },
  tileValue: { fontSize: t.title, fontWeight: '600', color: c.foreground, fontVariant: ['tabular-nums'] },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  delta: { fontSize: t.caption, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meterTrack: { height: 4, borderRadius: 2, backgroundColor: c.surfaceAlt, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.surfaceAlt },
  chipText: { fontSize: t.caption, color: c.warning },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 2, marginTop: space.sm },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: c.foreground },
  barCaption: { fontSize: t.small, fontWeight: '500', color: c.foreground },
  barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  listRow: { gap: 2 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  listLabel: { flex: 1, fontSize: t.small, color: c.foreground },
  listValue: { fontSize: t.small, fontWeight: '600', color: c.foreground, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm },
  confirm: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  deployRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  logActions: { flexDirection: 'row', gap: space.md },
  link: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  logBox: { height: 360, borderRadius: radius.md, backgroundColor: '#0E0D18', padding: space.md },
  logLine: { fontSize: 11, lineHeight: 16, color: '#D4D4D8', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
}));
