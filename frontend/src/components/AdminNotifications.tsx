import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Archive, Bell, CheckCircle2, Info, Loader2, Megaphone, Send, Siren } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SILVER_TILE, ago } from './distributor/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

const KINDS = {
    info: { label: 'Information', icon: Info, cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20' },
    success: { label: 'Success', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' },
    warning: { label: 'Warning', icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' },
    urgent: { label: 'Urgent', icon: Siren, cls: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20' },
} as const;
type Kind = keyof typeof KINDS;
const kindOf = (k: string) => KINDS[(k as Kind)] || KINDS.info;

const EMPTY = { title: '', message: '', kind: 'info', showInTicker: true, expiresAt: '' };

const AdminNotifications = () => {
    const { token } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/notifications`;
    const [items, setItems] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY);

    const load = async () => {
        const res = await axios.get(api, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setItems(res.data.data || []);
    };
    useEffect(() => { if (token) load().catch(() => undefined).finally(() => setLoaded(true)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const publish = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.title.trim() || !form.message.trim()) return toast.error('Enter a title and message');
        setSaving(true);
        try {
            const res = await axios.post(api, form, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { toast.success('Notification published'); setForm(EMPTY); load(); }
        } catch (error: any) { toast.error(error.response?.data?.message || 'Could not publish notification'); }
        finally { setSaving(false); }
    };

    const archive = async (id: string) => {
        try { await axios.delete(`${api}/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setItems((rows) => rows.filter((row) => row._id !== id)); toast.success('Notification archived'); }
        catch { toast.error('Could not archive notification'); }
    };

    const preview = kindOf(form.kind);
    const PreviewIcon = preview.icon;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex items-center gap-4">
                    <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Bell className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
                        <p className="text-sm text-muted-foreground">Announcements every retailer and distributor sees in their bell and Latest Updates ticker.</p>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-5">
                <form onSubmit={publish} className={`${CARD} lg:col-span-3 space-y-5`}>
                    <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${SILVER_TILE}`}><Megaphone className="h-4 w-4" /></div>
                        <h2 className="text-lg font-semibold">New announcement</h2>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between"><label className="text-sm font-medium">Title</label><span className="text-xs text-muted-foreground tabular-nums">{form.title.length}/120</span></div>
                        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="e.g. AEPS maintenance tonight" className={INPUT} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Type</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(Object.keys(KINDS) as Kind[]).map((k) => {
                                const { label, icon: Icon, cls } = KINDS[k];
                                const on = form.kind === k;
                                return (
                                    <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} aria-pressed={on} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${on ? `ring-1 ${cls}` : 'bg-background text-muted-foreground hover:text-foreground'}`}>
                                        <Icon size={15} /> {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between"><label className="text-sm font-medium">Message</label><span className="text-xs text-muted-foreground tabular-nums">{form.message.length}/1000</span></div>
                        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} rows={5} placeholder="Write the announcement…" className={`${INPUT} resize-y`} />
                    </div>
                    <div className="grid gap-4 rounded-2xl border bg-background p-4 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                            <input type="checkbox" checked={form.showInTicker} onChange={(e) => setForm({ ...form, showInTicker: e.target.checked })} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-200" />
                            <span><span className="font-semibold">Show in ticker</span><span className="block text-xs text-muted-foreground">Scrolls across the top of dashboards</span></span>
                        </label>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Expires (optional)</label>
                            <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={`${INPUT} py-2 dark:[color-scheme:dark]`} />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button disabled={saving} className={`${PRIMARY_BUTTON} px-6`}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {saving ? 'Publishing…' : 'Publish'}
                        </button>
                    </div>
                </form>

                <aside className={`${CARD} lg:col-span-2 space-y-4`}>
                    <p className={LABEL}>Preview</p>
                    <div className="rounded-2xl border bg-background p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl p-2 ring-1 ${preview.cls}`}><PreviewIcon size={16} /></div>
                            <div className="min-w-0">
                                <p className="font-semibold">{form.title || 'Your title'}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{form.message || 'Your message appears here, exactly as users will read it.'}</p>
                                <p className="mt-2 text-[11px] text-muted-foreground">Just now</p>
                            </div>
                        </div>
                    </div>
                    {form.showInTicker && (
                        <div className="overflow-hidden rounded-xl border bg-zinc-900 px-3 py-2 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                            <span className="font-bold">LATEST · </span>{form.title || 'Your title'}
                        </div>
                    )}
                </aside>
            </div>

            <section className={`${CARD} p-0 overflow-hidden`}>
                <div className="flex items-center justify-between p-6 pb-4">
                    <h2 className="text-lg font-semibold">Active announcements</h2>
                    <span className={LABEL}>{items.length} live</span>
                </div>
                {!loaded ? (
                    <div className="space-y-3 px-6 pb-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />)}</div>
                ) : items.length === 0 ? (
                    <p className="px-6 pb-10 pt-4 text-center text-sm text-muted-foreground">No active announcements.</p>
                ) : (
                    <ul className="divide-y border-t">
                        {items.map((item) => {
                            const k = kindOf(item.kind);
                            const Icon = k.icon;
                            return (
                                <li key={item._id} className="flex items-start gap-4 px-6 py-4">
                                    <div className={`rounded-xl p-2 ring-1 ${k.cls}`}><Icon size={16} /></div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold">{item.title}</h3>
                                            {item.showInTicker && <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Ticker</span>}
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Published {ago(item.createdAt)}
                                            {item.expiresAt && ` · expires ${new Date(item.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                                        </p>
                                    </div>
                                    <button onClick={() => archive(item._id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600" title="Archive" aria-label={`Archive ${item.title}`}>
                                        <Archive className="h-4 w-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default AdminNotifications;
