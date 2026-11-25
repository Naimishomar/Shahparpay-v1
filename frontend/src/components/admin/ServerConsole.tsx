import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Pause, Play, RefreshCcw, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_QUIET, FIELD, ago, useApiGet } from '../distributor/shared';
import { PageHeader, Panel, Skeleton } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';

type Health = {
    startedAt: number;
    uptimeSec: number;
    node: string;
    env: string;
    process: { rss: number; heapUsed: number; heapTotal: number };
    machine: { hostname: string; cpus: number; load: number[]; totalMem: number; freeMem: number; uptimeSec: number };
    disk: { total: number; free: number } | null;
    db: { state: string; pingMs: number | null; stats: { collections: number; objects: number; dataSize: number } | null };
};
type Deploy = { id: number; status: string; conclusion: string | null; event: string; createdAt: string; commit: string; sha: string; author: string; url: string };
type Service = { key: string; label: string; enabled: boolean };
type LogLine = { seq: number; at: number; level: 'log' | 'warn' | 'error'; line: string };

const API = import.meta.env.VITE_BACKEND_URL;
const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
const mb = (b: number) => `${Math.round(b / 1024 ** 2)} MB`;
const duration = (sec: number) => {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
const call = async (token: string | null, path: string, init: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    return res.json().catch(() => ({ success: false, message: 'Server did not answer.' }));
};

const Meter = ({ used, total }: { used: number; total: number }) => {
    const pct = total > 0 ? (used / total) * 100 : 0;
    return (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${pct > 85 ? 'bg-[var(--lp-danger)]' : pct > 70 ? 'bg-amber-500' : 'bg-[var(--chart-1)]'}`} style={{ width: `${pct}%` }} />
        </div>
    );
};

const Dot = ({ ok }: { ok: boolean }) => <span className={`size-1.5 shrink-0 rounded-full ${ok ? 'bg-[var(--lp-positive)]' : 'bg-[var(--lp-danger)]'}`} />;

/** Restart and deploy ask for an emailed code first: a stolen session alone cannot take the server down. */
const ConfirmAction = ({ token, action, onDone, onCancel }: { token: string | null; action: 'restart' | 'deploy'; onDone: () => void; onCancel: () => void }) => {
    const [sent, setSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [busy, setBusy] = useState(false);
    const what = action === 'restart' ? 'Restart the backend server' : 'Deploy the latest code on main';

    const send = async () => {
        setBusy(true);
        const json = await call(token, '/api/admin/system/otp', { method: 'POST' });
        setBusy(false);
        if (!json.success) return toast.error(json.message || 'Could not send the code.');
        setSent(true);
        toast.success(json.message);
    };
    const confirm = async () => {
        setBusy(true);
        const json = await call(token, `/api/admin/system/${action}`, { method: 'POST', body: JSON.stringify({ otp }) });
        setBusy(false);
        if (!json.success) return toast.error(json.message || 'Failed.');
        toast.success(json.message);
        onDone();
    };

    return (
        <div className="mt-4 rounded-xl bg-muted/60 p-4">
            <p className="text-sm text-foreground">{what}?</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {action === 'restart'
                    ? 'The portal and app stop answering for about 10 seconds. Transactions in progress may fail.'
                    : 'Takes 2–3 minutes. The server restarts once at the end.'}
            </p>
            {!sent ? (
                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={send} disabled={busy} className={BUTTON}>{busy && <Loader2 size={14} className="animate-spin" />}Email me a code</button>
                    <button type="button" onClick={onCancel} className={BUTTON_QUIET}>Cancel</button>
                </div>
            ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                    <div className="w-40"><input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        autoFocus
                        aria-label="6-digit code"
                        placeholder="6-digit code"
                        className={`${FIELD} lp-figure tracking-widest`}
                    /></div>
                    <button type="button" onClick={confirm} disabled={busy || otp.length !== 6} className={BUTTON}>{busy && <Loader2 size={14} className="animate-spin" />}Confirm</button>
                    <button type="button" onClick={onCancel} className={BUTTON_QUIET}>Cancel</button>
                </div>
            )}
        </div>
    );
};

const LiveLogs = ({ token }: { token: string | null }) => {
    const [lines, setLines] = useState<LogLine[]>([]);
    const [paused, setPaused] = useState(false);
    const [errorsOnly, setErrorsOnly] = useState(false);
    const [filter, setFilter] = useState('');
    const since = useRef(0);
    const box = useRef<HTMLDivElement>(null);
    const stick = useRef(true);

    useEffect(() => {
        if (paused) return;
        let stop = false;
        const poll = async () => {
            const json = await call(token, `/api/admin/system/logs?since=${since.current}`).catch(() => null);
            // A restart starts the counter again: lines below what we have mean a fresh process.
            const fresh: LogLine[] = json?.data?.lines || [];
            if (stop || !fresh.length) return;
            const restarted = fresh[0].seq <= since.current;
            since.current = fresh[fresh.length - 1].seq;
            setLines((prev) => (restarted ? fresh : [...prev, ...fresh]).slice(-1500));
        };
        poll();
        const id = window.setInterval(poll, 3000);
        return () => { stop = true; window.clearInterval(id); };
    }, [token, paused]);

    useEffect(() => {
        if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
    }, [lines]);

    const q = filter.trim().toLowerCase();
    const shown = lines.filter((l) => (!errorsOnly || l.level !== 'log') && (!q || l.line.toLowerCase().includes(q)));

    return (
        <Panel
            title="Live logs"
            description="Server console since the last restart. Refreshes every 3 seconds."
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-48"><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" aria-label="Filter logs" className={`${FIELD} h-9`} /></div>
                    <button type="button" onClick={() => setErrorsOnly(!errorsOnly)} aria-pressed={errorsOnly} className={`${BUTTON_QUIET} h-9 ${errorsOnly ? 'bg-muted' : ''}`}>Errors only</button>
                    <button type="button" onClick={() => setPaused(!paused)} className={`${BUTTON_QUIET} h-9`}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</button>
                </div>
            }
            flush
        >
            {/* A terminal is the content here: monospace lines on a quiet dark surface. */}
            <div
                ref={box}
                onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
                className="h-[420px] overflow-auto rounded-b-2xl bg-[#100f14] p-5 font-mono text-[12px] leading-relaxed text-zinc-300"
            >
                {shown.length === 0 ? (
                    <p className="text-zinc-500">{lines.length ? 'No lines match.' : 'Waiting for logs…'}</p>
                ) : shown.map((l) => (
                    <div key={l.seq} className={`whitespace-pre-wrap break-all ${l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-300' : ''}`}>
                        <span className="select-none text-zinc-600">{new Date(l.at).toLocaleTimeString('en-IN', { hour12: false })}  </span>{l.line}
                    </div>
                ))}
            </div>
        </Panel>
    );
};

const ServerConsole = ({ token }: { token: string | null }) => {
    const health = useApiGet<Health>(token, '/api/admin/system/health');
    const deploys = useApiGet<{ configured: boolean; runs: Deploy[] }>(token, '/api/admin/system/deploys');
    const services = useApiGet<Service[]>(token, '/api/admin/system/services');
    const [confirming, setConfirming] = useState<'restart' | 'deploy' | null>(null);
    const [switching, setSwitching] = useState<string | null>(null);
    const { reload: reloadHealth } = health;
    const { reload: reloadDeploys } = deploys;

    // Health every 15 s; deploy list every 20 s while one is running.
    const running = deploys.data?.runs.some((r) => r.status !== 'completed');
    useEffect(() => {
        const id = window.setInterval(reloadHealth, 15000);
        return () => window.clearInterval(id);
    }, [reloadHealth]);
    useEffect(() => {
        if (!running) return;
        const id = window.setInterval(reloadDeploys, 20000);
        return () => window.clearInterval(id);
    }, [running, reloadDeploys]);

    const toggle = async (s: Service) => {
        setSwitching(s.key);
        const json = await call(token, `/api/admin/system/services/${s.key}`, { method: 'PUT', body: JSON.stringify({ enabled: !s.enabled }) });
        setSwitching(null);
        if (!json.success) return toast.error(json.message || 'Could not change it.');
        toast.success(`${s.label} ${s.enabled ? 'paused for all retailers' : 'is live again'}`);
        services.reload();
    };

    const h = health.data;
    const up = !!h && !health.error;
    const tiles = h ? [
        { label: 'Server', value: up ? 'Online' : 'Not answering', hint: `Up ${duration(h.uptimeSec)} · Node ${h.node.replace('v', '')}`, ok: up },
        { label: 'Database', value: h.db.state === 'connected' ? `${h.db.pingMs ?? '—'} ms` : h.db.state[0].toUpperCase() + h.db.state.slice(1), hint: h.db.stats ? `${h.db.stats.objects.toLocaleString('en-IN')} records · ${mb(h.db.stats.dataSize)}` : 'No stats', ok: h.db.state === 'connected' },
        { label: 'CPU load', value: h.machine.load[0].toFixed(2), hint: `${h.machine.cpus} cores · 1-min average`, ok: h.machine.load[0] < h.machine.cpus, meter: [h.machine.load[0], h.machine.cpus] },
        { label: 'Memory', value: gb(h.machine.totalMem - h.machine.freeMem), hint: `of ${gb(h.machine.totalMem)} · app ${mb(h.process.rss)}`, ok: h.machine.freeMem / h.machine.totalMem > 0.1, meter: [h.machine.totalMem - h.machine.freeMem, h.machine.totalMem] },
        ...(h.disk ? [{ label: 'Disk', value: gb(h.disk.total - h.disk.free), hint: `of ${gb(h.disk.total)} · ${gb(h.disk.free)} free`, ok: h.disk.free / h.disk.total > 0.1, meter: [h.disk.total - h.disk.free, h.disk.total] }] : []),
    ] : [];

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Platform"
                title="Server"
                description={h ? <><span className="lp-figure">{h.machine.hostname}</span> · {h.env}</> : 'Health, logs and controls for the backend.'}
                actions={<button type="button" onClick={reloadHealth} className={BUTTON_QUIET}><RefreshCcw size={14} /> Refresh</button>}
            />

            {health.error && <div className={ALERT_ERROR}>{health.error}</div>}

            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 xl:grid-cols-5">
                    {!h
                        ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-14" /></div>)
                        : tiles.map((t) => (
                            <div key={t.label} className="bg-card p-5">
                                <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Dot ok={t.ok} />{t.label}</p>
                                <p className="lp-figure mt-2 text-[22px] leading-none tracking-[-0.02em] text-foreground">{t.value}</p>
                                <p className="mt-2 truncate text-[12px] text-muted-foreground">{t.hint}</p>
                                {t.meter && <Meter used={t.meter[0]} total={t.meter[1]} />}
                            </div>
                        ))}
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-5">
                <Panel
                    className="xl:col-span-3"
                    title="Deploys"
                    description="Every push to main ships the backend automatically."
                    action={
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setConfirming('restart')} className={BUTTON_QUIET}><RefreshCcw size={14} /> Restart</button>
                            <button type="button" onClick={() => setConfirming('deploy')} disabled={!deploys.data?.configured} className={BUTTON}><Rocket size={14} /> Deploy now</button>
                        </div>
                    }
                >
                    {confirming && (
                        <ConfirmAction
                            key={confirming}
                            token={token}
                            action={confirming}
                            onCancel={() => setConfirming(null)}
                            onDone={() => { setConfirming(null); window.setTimeout(confirming === 'deploy' ? reloadDeploys : reloadHealth, 4000); }}
                        />
                    )}
                    {deploys.data && !deploys.data.configured ? (
                        <p className="mt-1 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                            To deploy and see deploy history from here, add <code className="font-mono text-foreground">GITHUB_TOKEN</code> to the server's <code className="font-mono text-foreground">backend/.env</code>: a fine-grained GitHub token for this repository with <em>Actions: read and write</em>.
                        </p>
                    ) : (
                        <ul className="-my-1">
                            {(deploys.data?.runs || []).map((r) => {
                                const state = r.status !== 'completed' ? 'Running' : r.conclusion === 'success' ? 'Live' : r.conclusion === 'cancelled' ? 'Cancelled' : 'Failed';
                                const tone = state === 'Live' ? 'bg-[var(--lp-positive)]' : state === 'Running' ? 'bg-amber-500 animate-pulse' : state === 'Cancelled' ? 'bg-muted-foreground' : 'bg-[var(--lp-danger)]';
                                return (
                                    <li key={r.id} className="flex items-center gap-3 border-b py-3 last:border-0">
                                        <span className={`size-1.5 shrink-0 rounded-full ${tone}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-foreground">{r.commit || 'Manual deploy'}</p>
                                            <p className="text-[12px] text-muted-foreground">{state} · <span className="lp-figure">{r.sha}</span> · {r.author} · {ago(r.createdAt)}</p>
                                        </div>
                                        <a href={r.url} target="_blank" rel="noreferrer" aria-label="Open on GitHub" className="text-muted-foreground hover:text-foreground"><ExternalLink size={14} /></a>
                                    </li>
                                );
                            })}
                            {deploys.loading && !deploys.data && <li className="py-3"><Skeleton className="h-10" /></li>}
                            {deploys.error && <li className="py-3 text-sm text-[var(--lp-danger)]">{deploys.error}</li>}
                        </ul>
                    )}
                </Panel>

                <Panel className="xl:col-span-2" title="Services" description="Pause one for every retailer, e.g. when a provider is down." flush>
                    <ul>
                        {(services.data || []).map((s) => (
                            <li key={s.key} className="flex min-h-12 items-center justify-between gap-3 border-b px-5 py-2.5 last:border-0">
                                <span className={`text-sm ${s.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}{!s.enabled && ' · paused'}</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={s.enabled}
                                    aria-label={`${s.label} for all retailers`}
                                    disabled={switching === s.key}
                                    onClick={() => toggle(s)}
                                    className={`relative h-5 w-9 flex-none rounded-full transition-colors duration-200 disabled:opacity-50 ${s.enabled ? 'bg-primary' : 'bg-input'}`}
                                >
                                    <span className="absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left] duration-200" style={{ left: s.enabled ? 18 : 2 }} />
                                </button>
                            </li>
                        ))}
                        {services.loading && !services.data && <li className="p-5"><Skeleton className="h-40" /></li>}
                    </ul>
                </Panel>
            </div>

            <LiveLogs token={token} />
        </div>
    );
};

export default ServerConsole;
